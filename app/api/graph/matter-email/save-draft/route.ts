import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized, adminUnauthorizedJson, adminSessionIdentityDiagnostics } from "@/lib/adminAuth";
import { isMatterEmailEnabled, MATTER_EMAIL_DISABLED_MESSAGE } from "@/lib/graph/matterEmailConfig";
import { saveMatterEmailDraft } from "@/lib/graph/matterEmail";
import { getRequestUserMailbox } from "@/lib/graph/userMailbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Save a compose as a REAL draft in the firm mailbox's Outlook Drafts folder (Graph create-message, no
// send). Flag-gated + admin-only. Mirrors Outlook — the draft genuinely lives in Outlook Drafts.
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

export async function POST(req: NextRequest) {
  if (!isMatterEmailEnabled()) return NextResponse.json({ ok: false, error: MATTER_EMAIL_DISABLED_MESSAGE }, { status: 403 });
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const to = toList(body?.to);
  const cc = toList(body?.cc);
  const subject = String(body?.subject || "").trim();
  const bodyHtml = String(body?.body ?? body?.bodyHtml ?? "");
  if (!subject && !bodyHtml && to.length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to save — add a recipient, subject, or body." }, { status: 400 });
  }

  const matterId = Number(body?.matterId);
  const resolvedMatterId = Number.isFinite(matterId) && matterId > 0 ? matterId : null;
  const matterDisplayNumber = body?.matterDisplayNumber ? String(body.matterDisplayNumber) : null;
  const masterLawsuitId = body?.masterLawsuitId ? String(body.masterLawsuitId) : null;

  let actorEmail: string | null = null;
  try {
    actorEmail = adminSessionIdentityDiagnostics(req)?.email || null;
  } catch {
    actorEmail = null;
  }

  const userMailbox = getRequestUserMailbox(req);
  if (!userMailbox) return NextResponse.json({ ok: false, error: "Could not determine your mailbox. Sign in with your own account." }, { status: 403 });

  const result = await saveMatterEmailDraft({
    mailboxUserId: userMailbox,
    matterId: resolvedMatterId,
    matterDisplayNumber,
    masterLawsuitId,
    to,
    cc,
    subject,
    bodyHtml,
    actorEmail,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
