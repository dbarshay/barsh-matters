import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { isMatterEmailEnabled, MATTER_EMAIL_DISABLED_MESSAGE } from "@/lib/graph/matterEmailConfig";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getRequestUserMailbox } from "@/lib/graph/userMailbox";
import { resolveMatterContext } from "@/lib/graph/webhookMessageSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enc = encodeURIComponent;

// Unmatched triage: recent INBOUND messages in the logged-in user's own mailbox that BM could NOT tie
// to a matter/lawsuit (no tracked conversation, no BRL_/YYYY.MM.NNNNN number) and that aren't already
// stored. Read-only, live from Graph — these are never persisted until an operator assigns one.
function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function recipEmail(v: any): string {
  return clean(v?.emailAddress?.address || v?.address || v?.email);
}
function recipName(v: any): string {
  return clean(v?.emailAddress?.name || v?.name || recipEmail(v));
}

export async function GET(req: NextRequest) {
  if (!isMatterEmailEnabled()) return NextResponse.json({ ok: false, error: MATTER_EMAIL_DISABLED_MESSAGE }, { status: 403 });
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  const mailbox = getRequestUserMailbox(req);
  if (!mailbox) return NextResponse.json({ ok: true, messages: [] });

  const select = ["id", "conversationId", "subject", "from", "receivedDateTime", "bodyPreview", "hasAttachments", "isRead"].join(",");
  const url = `${graphApiBase()}/users/${enc(mailbox)}/messages?$select=${enc(select)}&$orderby=receivedDateTime%20desc&$top=40`;
  const res = await graphFetchJson({ url, method: "GET" });
  if (!res.ok) return NextResponse.json({ ok: false, error: `Graph lookup failed: ${res.error}` }, { status: 502 });

  const rows: any[] = Array.isArray(res.json?.value) ? res.json.value : [];
  const ids = rows.map((r) => clean(r?.id)).filter(Boolean);
  const storedRows = ids.length ? await prisma.emailMessage.findMany({ where: { graphMessageId: { in: ids } }, select: { graphMessageId: true } }) : [];
  const stored = new Set(storedRows.map((r) => r.graphMessageId));

  const out: any[] = [];
  for (const row of rows) {
    const graphMessageId = clean(row?.id);
    if (!graphMessageId || stored.has(graphMessageId)) continue;
    const fromEmail = recipEmail(row?.from).toLowerCase();
    if (!fromEmail || fromEmail === mailbox) continue; // only inbound (from someone else)
    const conversationId = clean(row?.conversationId);
    const matchText = [clean(row?.subject), clean(row?.bodyPreview)].filter(Boolean).join("\n");
    const ctx = await resolveMatterContext(conversationId, matchText);
    if (ctx) continue; // resolves to a matter/lawsuit — not unmatched
    out.push({
      graphMessageId,
      from: recipName(row?.from),
      fromEmail,
      subject: clean(row?.subject),
      bodyPreview: clean(row?.bodyPreview),
      receivedAt: clean(row?.receivedDateTime),
      hasAttachments: Boolean(row?.hasAttachments),
    });
  }

  return NextResponse.json({ ok: true, count: out.length, messages: out });
}
