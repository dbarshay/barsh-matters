import fs from "fs";

// OCR reference cross-reference + matter prediction: read-only normalization/prediction wired into
// ocr-prefill and the Upload Docs auto-select. Must NOT write to matters (reference-value rule).
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
function forbid(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (text.includes(n)) {
      console.error(`FAIL: ${file} must NOT contain: ${n}`);
      failed = true;
    } else {
      console.log(`PASS: ${file} free of: ${n}`);
    }
  }
}

// 1. Module reuses the existing resolvers + predicts from the strong keys, and predicts only on a strong key.
check("lib/ocr/crossReference.ts", [
  "resolveProvider",
  "resolveCarrier",
  "resolvePatient",
  "normalizeClaimNumber",
  'add(await q({ display_number: e.bmFileNumber }), "file", 100)',
  "predictedMatterId",
  "top.score >= 85",
]);

// 2. READ-ONLY: no writes to the matter index from the cross-reference module.
forbid("lib/ocr/crossReference.ts", [
  "claimIndex.update",
  "claimIndex.create",
  "claimIndex.upsert",
  ".delete(",
]);

// 3. ocr-prefill invokes it and returns crossRef.
check("app/api/documents/ocr-prefill/route.ts", [
  "import { crossReferenceExtraction }",
  "crossReferenceExtraction(prisma",
  "crossRef,",
]);

// 4. Upload Docs auto-selects a strong predicted matter.
check("app/admin/documents/upload/page.tsx", [
  "j.crossRef?.predictedMatterId",
  "setPredictedNote(",
  "Auto-matched to",
]);

if (failed) process.exit(1);
console.log("PASS: OCR cross-reference is read-only and wired end-to-end (normalize + predict matter).");
