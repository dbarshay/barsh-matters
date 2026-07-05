// Headless test of the Phase 4a OCR→field logic (classifier + title-field prefill). Pure — no DB,
// no Azure, no real documents. Uses synthetic OcrExtractionResult objects.
//
//   npx tsx scripts/test-ocr-prefill.ts

import type { OcrExtractionResult, OcrKeyValue } from "@/lib/ocr/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function mk(text: string, keyValues: OcrKeyValue[]): OcrExtractionResult {
  return { provider: "stub", model: "test", text, pageCount: 1, keyValues, tables: [], meanConfidence: 0.8 };
}

async function main() {
  const { suggestFolderTitle, mapOcrToTitleFields } = await import("@/lib/ocr/mapping");

  console.log("Classifier:");
  const denial = mk(
    "STATE FARM INSURANCE — NF-10 DENIAL OF CLAIM FORM. Date of denial 07/03/2026.",
    [{ key: "Date", value: "07/03/2026", confidence: 0.9 }],
  );
  const s1 = suggestFolderTitle(denial);
  check("NF-10 → denials/nf10", s1?.folderKey === "claim_documents.denials" && s1?.titleKey === "nf10", JSON.stringify(s1));

  const aob = mk("ASSIGNMENT OF BENEFITS (AOB) executed by the patient.", []);
  const s2 = suggestFolderTitle(aob);
  check("AOB → bills/aob", s2?.folderKey === "claim_documents.bills" && s2?.titleKey === "aob", JSON.stringify(s2));

  const award = mk(
    "AMERICAN ARBITRATION ASSOCIATION — AWARD OF ARBITRATOR. The arbitrator finds in favor of the applicant.",
    [
      { key: "Date of award", value: "07/02/2026", confidence: 0.92 },
      { key: "Principal", value: "$5,000.00", confidence: 0.88 },
      { key: "Interest", value: "$200.00", confidence: 0.85 },
    ],
  );
  const s3 = suggestFolderTitle(award);
  check("award → arbitration.awards/award", s3?.folderKey === "arbitration.awards" && s3?.titleKey === "award", JSON.stringify(s3));

  const nothing = mk("Some unrelated correspondence text with no known keywords.", []);
  check("no keyword → null suggestion", suggestFolderTitle(nothing) === null);

  console.log("Title-field prefill:");
  const awardFields = mapOcrToTitleFields(award, "arbitration.awards", "award");
  check("award date prefilled", awardFields.date?.value === "07/02/2026", awardFields.date?.value);
  check("award outcome inferred = Win", awardFields.outcome?.value === "Win", awardFields.outcome?.value);
  check("award principal = 5000", awardFields.principal?.value === "5000", awardFields.principal?.value);
  check("award interest = 200", awardFields.interest?.value === "200", awardFields.interest?.value);
  check("award attorneys_fees blank (not present)", awardFields.attorneys_fees?.value === "");

  const req = mk("Verification request letter.", [{ key: "Request date", value: "06/15/2026", confidence: 0.9 }]);
  const reqFields = mapOcrToTitleFields(req, "claim_documents.verification.requests", "request_dated");
  check("request_dated date prefilled", reqFields.date?.value === "06/15/2026", reqFields.date?.value);

  // Date fallback: no labeled date, but a date in text.
  const corr = mk("Court correspondence dated 05/09/2026 regarding the motion.", []);
  const corrFields = mapOcrToTitleFields(corr, "litigation.court_correspondence", "court_correspondence");
  check("court corr date via text fallback", corrFields.date?.value === "05/09/2026" && corrFields.date?.source === "regex:text", JSON.stringify(corrFields.date));

  console.log(`\n${failed === 0 ? "✅ ALL PASS" : "❌ FAILURES"} — ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
