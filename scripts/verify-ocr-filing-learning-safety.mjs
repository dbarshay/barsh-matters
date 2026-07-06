import fs from "fs";

// OCR human-in-the-loop learning wiring: correction log + per-entity memory that biases suggestions.
let failed = false;
function check(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (!text.includes(n)) {
      console.error(`FAIL: ${file} missing: ${n}`);
      failed = true;
    } else {
      console.log(`PASS: ${file} has: ${n}`);
    }
  }
}

// 1. Schema carries both learning models + the compound-unique memory key.
check("prisma/schema.prisma", [
  "model OcrFilingFeedback {",
  "model OcrEntityDefault {",
  "@@unique([entityType, entityKey, caseType, folderKey, titleKey])",
]);

// 2. Learning lib exposes record + lookup + entity normalizer and never throws into the filing path.
check("lib/ocr/learning.ts", [
  "export function entityKey(",
  "export async function recordFilingFeedback(",
  "export async function getLearnedSuggestion(",
  "MIN_OBSERVATIONS",
]);

// 3. Upload commit records feedback AFTER a successful filing (best-effort).
check("app/api/documents/upload/route.ts", [
  "import { recordFilingFeedback }",
  "await recordFilingFeedback(prisma, {",
  "chosenFolderKey: folderKey,",
]);

// 4. ocr-prefill consults learned memory and only trusts a still-valid terminal folder/title.
check("app/api/documents/ocr-prefill/route.ts", [
  "import { getLearnedSuggestion }",
  "getLearnedSuggestion(prisma",
  "learnedValid",
  "learnedNote",
]);

// 5. Upload page sends learning signals + surfaces the learned note.
check("app/admin/documents/upload/page.tsx", [
  "suggestedFolderKey: pickSuggestion?.folderKey",
  "providerName: ocrProvider",
  "learnedNote",
]);

if (failed) process.exit(1);
console.log("PASS: OCR filing learning (feedback log + per-entity memory bias) is wired end-to-end.");
