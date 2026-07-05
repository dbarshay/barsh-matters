import { NextRequest, NextResponse } from "next/server";

import { extractDocument } from "@/lib/ocr";
import { persistExtraction } from "@/lib/ocr/persist";
import { suggestFolderTitle, mapOcrToTitleFields } from "@/lib/ocr/mapping";
import { getFolder } from "@/lib/documents/folderTaxonomy";

// OCR-prefill for the filing flow (Phase 4b). Runs the engine on inbound bytes (BEFORE Clio),
// persists the extraction, classifies a suggested folder/title, and prefills that title's fields.
// The operator verifies everything; nothing is auto-filed. Correlation to the eventual Clio doc is
// by fileHash (see OcrExtraction.clioDocumentId backfill).
//
//   POST { base64, contentType?, fileName?, folderKey?, titleKey?, matterId? }
export const maxDuration = 60; // OCR can take a few seconds

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const base64 = String(body.base64 ?? "");
  if (!base64) return NextResponse.json({ ok: false, error: "base64 required." }, { status: 400 });
  const contentType = body.contentType ? String(body.contentType) : undefined;
  const fileName = body.fileName ? String(body.fileName) : undefined;
  const matterId = Number(body.matterId);

  let result;
  try {
    result = await extractDocument({ base64, contentType, fileName }, "layout");
  } catch (err) {
    return NextResponse.json({ ok: false, error: `OCR failed: ${(err as Error).message}` }, { status: 502 });
  }

  const row = await persistExtraction({
    input: { base64, contentType, fileName },
    result,
    mode: "layout",
    sourceType: "scan",
    matterId: Number.isFinite(matterId) && matterId > 0 ? matterId : null,
  });

  const suggestion = suggestFolderTitle(result);

  // Resolve the folder/title to prefill: an explicit folder (drop target) wins; otherwise the
  // classifier's suggestion. Title = explicit → matching suggestion → the folder's first title.
  const folderKey = body.folderKey ? String(body.folderKey) : suggestion?.folderKey;
  let titleKey = body.titleKey ? String(body.titleKey) : undefined;
  if (!titleKey && folderKey) {
    titleKey =
      suggestion && suggestion.folderKey === folderKey
        ? suggestion.titleKey
        : getFolder(folderKey)?.titles[0]?.key;
  }

  const prefill = folderKey && titleKey ? mapOcrToTitleFields(result, folderKey, titleKey) : {};

  return NextResponse.json({
    ok: true,
    ocrExtractionId: row.id,
    fileHash: row.fileHash,
    meanConfidence: result.meanConfidence,
    suggestion,
    folderKey: folderKey ?? null,
    titleKey: titleKey ?? null,
    prefill,
  });
}
