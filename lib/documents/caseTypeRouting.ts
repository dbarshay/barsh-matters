// Case-type-aware folder routing. The OCR classifier can only tell the document TYPE (a Bill looks the
// same on a No-Fault or a Workers' Comp matter). The FOLDER depends on the matter's case type:
// Workers' Comp matters file into the flat Workers' Comp folder; No-Fault/Arbitration into Claim
// Documents. This maps a classifier suggestion (Claim Documents folder + title) to the WC folder for
// WC matters, using the parallel titles added to the Workers' Comp folder.

import { type CaseType, isTitleAllowed } from "@/lib/documents/folderTaxonomy";

/** Normalize free-text case type (e.g. ClaimIndex.case_type "No-Fault" | "Workers Compensation"). */
export function normalizeCaseType(raw: string | null | undefined): CaseType | null {
  const s = String(raw || "").toLowerCase();
  if (!s) return null;
  if (s.includes("work") || s.includes("comp") || s === "wc") return "wc";
  if (s.includes("arbitr")) return "arbitration";
  if (s.includes("no-fault") || s.includes("no fault") || s.includes("nofault") || s.includes("pip")) return "no_fault";
  return null;
}

// Claim Documents (folder|title) → Workers' Comp title, for WC matters. Only the document types that
// exist in both places are remapped; anything else is left where the classifier put it.
const WC_REMAP: Record<string, string> = {
  "claim_documents.bills|bill": "bill",
  "claim_documents.bills|billing_letter": "billing_letter",
  "claim_documents.bills|aob": "aob",
  "claim_documents.bills|proof_of_mailing": "proof_of_mailing",
  "claim_documents.reports|report": "report",
  "claim_documents.denials|eob_eor": "eob_eor",
  "claim_documents.verification.requests|request_dated": "verification_request",
  "claim_documents.verification.responses|response_dated": "verification_response",
};

/** Route a suggested folder/title to the case-type-correct folder. WC matters → Workers' Comp. */
export function resolveFolderForCaseType(
  folderKey: string,
  titleKey: string,
  caseType: CaseType | null,
): { folderKey: string; titleKey: string; remapped: boolean } {
  if (caseType === "wc") {
    const mapped = WC_REMAP[`${folderKey}|${titleKey}`];
    if (mapped && isTitleAllowed("workers_comp", mapped)) {
      return { folderKey: "workers_comp", titleKey: mapped, remapped: true };
    }
  }
  return { folderKey, titleKey, remapped: false };
}
