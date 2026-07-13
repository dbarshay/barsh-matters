import { NextResponse } from "next/server";
import { getLegacyDocTreeForMatter, getLegacyDocTreeForCase } from "@/lib/legacyDocs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/matters/legacy-docs?matterId=123   (or ?caseId=44521-100016)
// Returns a matter's migrated LawSpades documents grouped by their original folder. Read-only.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const matterId = Number(url.searchParams.get("matterId") || "");
  const caseId = (url.searchParams.get("caseId") || "").trim();
  try {
    const tree = caseId
      ? await getLegacyDocTreeForCase(caseId)
      : Number.isFinite(matterId) && matterId > 0
        ? await getLegacyDocTreeForMatter(matterId)
        : null;
    if (!tree) return NextResponse.json({ ok: false, error: "matterId or caseId is required." }, { status: 400 });
    return NextResponse.json({ ok: true, ...tree });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
