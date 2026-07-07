import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized, adminUnauthorizedJson, adminSessionIdentityDiagnostics } from "@/lib/adminAuth";
import { isMatterEmailEnabled, MATTER_EMAIL_DISABLED_MESSAGE } from "@/lib/graph/matterEmailConfig";
import { sendMatterEmail } from "@/lib/graph/matterEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Send a native email from a matter via Microsoft Graph. Flag-gated, admin-only, and requires an
// explicit per-send confirmation (`confirmSend: true`) — never sends silently.
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

export async function POST(req: NextRequest) {
  if (!isMatterEmailEnabled()) {
    return NextResponse.json({ ok: false, error: MATTER_EMAIL_DISABLED_MESSAGE }, { status: 403 });
  }
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (body?.confirmSend !== true) {
    return NextResponse.json(
      { ok: false, error: "Send not confirmed. Set confirmSend=true to send this email." },
      { status: 400 },
    );
  }

  const to = toList(body?.to);
  const cc = toList(body?.cc);
  const subject = String(body?.subject || "").trim();
  const bodyHtml = String(body?.body ?? body?.bodyHtml ?? "");
  if (to.length === 0) return NextResponse.json({ ok: false, error: "At least one recipient (To) is required." }, { status: 400 });
  if (!subject) return NextResponse.json({ ok: false, error: "Subject is required." }, { status: 400 });

  const matterId = Number(body?.matterId);
  let actorEmail: string | null = null;
  try {
    actorEmail = adminSessionIdentityDiagnostics(req)?.email || null;
  } catch {
    actorEmail = null;
  }

  const result = await sendMatterEmail({
    matterId: Number.isFinite(matterId) && matterId > 0 ? matterId : null,
    matterDisplayNumber: body?.matterDisplayNumber ? String(body.matterDisplayNumber) : null,
    masterLawsuitId: body?.masterLawsuitId ? String(body.masterLawsuitId) : null,
    to,
    cc,
    subject,
    bodyHtml,
    actorEmail,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
