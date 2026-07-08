import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { isMatterEmailEnabled, MATTER_EMAIL_DISABLED_MESSAGE } from "@/lib/graph/matterEmailConfig";
import { getRequestUserMailbox } from "@/lib/graph/userMailbox";
import { processChangedMessage, resolveMatterContext } from "@/lib/graph/webhookMessageSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Assign an Unmatched email to a file: operator supplies a file number (Individual Matter "BRL_…" or
// Lawsuit Matter "YYYY.MM.NNNNN"); we resolve it to the matter/lawsuit and persist the message into that
// file (same path as the webhook, with the operator's context forced). Flag-gated + admin.
//   POST { graphMessageId, fileNumber, confirmAssign: true }
export async function POST(req: NextRequest) {
  if (!isMatterEmailEnabled()) return NextResponse.json({ ok: false, error: MATTER_EMAIL_DISABLED_MESSAGE }, { status: 403 });
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const graphMessageId = String(body?.graphMessageId || "").trim();
  const fileNumber = String(body?.fileNumber || "").trim();
  if (!graphMessageId) return NextResponse.json({ ok: false, error: "graphMessageId required." }, { status: 400 });
  if (body?.confirmAssign !== true) return NextResponse.json({ ok: false, error: "Assignment not confirmed. Set confirmAssign=true." }, { status: 400 });

  const mailbox = getRequestUserMailbox(req);
  if (!mailbox) return NextResponse.json({ ok: false, error: "Could not determine your mailbox." }, { status: 403 });

  // Resolve the typed file number to a matter/lawsuit context (no conversation — number-only match).
  const context = await resolveMatterContext("", fileNumber);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Enter a valid Individual Matter (BRL_2026NNNNN) or Lawsuit Matter (YYYY.MM.NNNNN) number." }, { status: 400 });
  }

  const result = await processChangedMessage({ graphMessageId, changeType: "created", mailbox, forceContext: context });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error || "Assign failed." }, { status: 502 });
  return NextResponse.json({ ok: true, assignedTo: { matterId: context.matterId ?? null, matterDisplayNumber: context.matterDisplayNumber ?? null, masterLawsuitId: context.masterLawsuitId ?? null } });
}
