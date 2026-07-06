import { NextRequest, NextResponse } from "next/server";

import { extractDocument } from "@/lib/ocr";
import { persistExtraction } from "@/lib/ocr/persist";
import { suggestFolderTitle, mapOcrToTitleFields, mapBillToIntakeFields } from "@/lib/ocr/mapping";
import { getFolder, findTitle } from "@/lib/documents/folderTaxonomy";
import { getLearnedSuggestion } from "@/lib/ocr/learning";
import { prisma } from "@/lib/prisma";

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

  const classifierSuggestion = suggestFolderTitle(result);

  // Identity read off the document (needed both for entity memory and matter auto-suggest).
  const intake = mapBillToIntakeFields(result);

  // Learned memory: if this document's provider/carrier has a dominant historical filing, prefer it
  // over the keyword classifier. Case type isn't known yet (matter not picked), so use agnostic memory.
  let learned: Awaited<ReturnType<typeof getLearnedSuggestion>> = null;
  try {
    learned = await getLearnedSuggestion(prisma, {
      providerName: intake.providerName.value,
      insurerName: intake.insurerName.value,
      caseType: null,
    });
  } catch {
    learned = null;
  }
  // Only trust learned memory that still resolves to a valid terminal folder/title.
  const learnedValid =
    learned && getFolder(learned.folderKey)?.terminal && findTitle(learned.folderKey, learned.titleKey)
      ? learned
      : null;

  const suggestion = learnedValid
    ? {
        folderKey: learnedValid.folderKey,
        titleKey: learnedValid.titleKey,
        confidence: 0.85,
        matched: `learned:${learnedValid.entityType}(${learnedValid.count})`,
      }
    : classifierSuggestion;
  const learnedNote = learnedValid
    ? `Pre-selected from ${learnedValid.count} prior filing${learnedValid.count === 1 ? "" : "s"} for this ${learnedValid.entityType === "provider" ? "provider" : "carrier"}.`
    : null;

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

  // Identity fields (patient/claim/etc.) for matter auto-suggestion + entity memory in the flow.
  const identity = {
    patientName: intake.patientName.value || null,
    claimNumber: intake.claimNumber.value || null,
    policyNumber: intake.policyNumber.value || null,
    insurerName: intake.insurerName.value || null,
    providerName: intake.providerName.value || null,
    dateOfLoss: intake.dateOfLoss.value || null,
  };

  return NextResponse.json({
    ok: true,
    ocrExtractionId: row.id,
    fileHash: row.fileHash,
    meanConfidence: result.meanConfidence,
    suggestion,
    classifierSuggestion,
    learned: learnedValid
      ? { folderKey: learnedValid.folderKey, titleKey: learnedValid.titleKey, count: learnedValid.count, entityType: learnedValid.entityType }
      : null,
    learnedNote,
    folderKey: folderKey ?? null,
    titleKey: titleKey ?? null,
    prefill,
    identity,
  });
}
