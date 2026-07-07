import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEmailWebhookEnabled, getWebhookClientState } from "@/lib/graph/webhookConfig";
import { processChangedMessage } from "@/lib/graph/webhookMessageSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC Microsoft Graph change-notification receiver (real-time inbound email). Graph calls this
// unauthenticated, so security is: (1) the subscription-creation validation handshake, and (2) the
// clientState secret Graph echoes on every notification, which we verify before doing anything. This
// route only triggers a read+persist of the changed message (via processChangedMessage) — it never
// sends mail, writes Clio, or hard-deletes.
//
// Graph contract:
//   - Subscription validation: POST ?validationToken=... -> echo the token back as text/plain, 200.
//   - Notifications: POST { value: [{ subscriptionId, changeType, clientState, resourceData:{ id } }] }
//     -> respond 202 promptly.

function tokenResponse(token: string) {
  return new NextResponse(token, { status: 200, headers: { "Content-Type": "text/plain" } });
}

// Resolve the owning mailbox for a notification. Graph identifies the mailbox in the resource path by
// the user's OBJECT GUID (not their email), so we look the email up by subscriptionId (which we stored
// with the mailbox at subscribe time). Fall back to parsing the resource if the row is missing.
async function mailboxForNotification(n: any): Promise<string> {
  const subscriptionId = String(n?.subscriptionId || "").trim();
  if (subscriptionId) {
    try {
      const row = await (prisma as any).graphSubscription.findUnique({ where: { subscriptionId } });
      const mb = String(row?.mailboxUserId || "").trim().toLowerCase();
      if (mb.includes("@")) return mb;
    } catch {
      /* fall through */
    }
  }
  const m = /users\/([^/]+)\/messages/i.exec(String(n?.resource || ""));
  return m ? decodeURIComponent(m[1]).trim().toLowerCase() : "";
}

async function handleValidation(req: NextRequest): Promise<NextResponse | null> {
  const token = req.nextUrl.searchParams.get("validationToken");
  if (token !== null) return tokenResponse(token);
  return null;
}

export async function POST(req: NextRequest) {
  // Validation handshake first (Graph sends this on subscription create/renew).
  const validation = await handleValidation(req);
  if (validation) return validation;

  // Always acknowledge quickly so Graph doesn't retry/disable the subscription.
  const ack = NextResponse.json({ ok: true }, { status: 202 });

  if (!isEmailWebhookEnabled()) return ack;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return ack;
  }

  const notifications = Array.isArray(body?.value) ? body.value : [];
  const expectedClientState = getWebhookClientState();

  // De-dupe repeated ids within a batch; process each changed message.
  const seen = new Set<string>();
  for (const n of notifications) {
    const clientState = String(n?.clientState || "");
    // Reject notifications that don't carry our secret (spoofed / stale subscription).
    if (!expectedClientState || clientState !== expectedClientState) continue;

    const graphMessageId = String(n?.resourceData?.id || n?.resourceData?.["@odata.id"] || "").trim();
    const changeType = String(n?.changeType || "").trim();
    // The mailbox owning this message — resolved by subscriptionId (canonical email). Per-user.
    const mailbox = await mailboxForNotification(n);
    if (!graphMessageId || !mailbox) continue;
    const key = `${graphMessageId}:${changeType}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      await processChangedMessage({ graphMessageId, changeType, mailbox });
    } catch {
      /* non-fatal — the backstop cron will reconcile anything a notification misses */
    }
  }

  return ack;
}

// Graph may probe with GET during some flows; echo any validation token, else 200.
export async function GET(req: NextRequest) {
  const validation = await handleValidation(req);
  if (validation) return validation;
  return NextResponse.json({ ok: true, service: "graph-email-webhook" });
}
