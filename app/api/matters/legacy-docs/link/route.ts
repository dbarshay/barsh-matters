import { NextResponse } from "next/server";
import { getLegacyDoc, generateLegacySasUrl, logLegacyDocAccess } from "@/lib/legacyDocs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/matters/legacy-docs/link  { docId, actorName? }
// Mints a short-lived Azure SAS URL for one legacy document, logs the access, and returns the URL.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const docId = String(body?.docId || "").trim();
  const actorName = String(body?.actorName || "").trim() || null;
  if (!docId) return NextResponse.json({ ok: false, error: "docId is required." }, { status: 400 });
  try {
    const doc = await getLegacyDoc(docId);
    if (!doc || !doc.blobKey) {
      return NextResponse.json({ ok: false, error: "Document not found or not stored yet." }, { status: 404 });
    }
    const url = await generateLegacySasUrl(doc.blobKey, doc.fileName);
    await logLegacyDocAccess(docId, doc.caseId, doc.fileName, actorName);
    return NextResponse.json({ ok: true, url, fileName: doc.fileName });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
