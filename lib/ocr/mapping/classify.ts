// Best-effort folder/title classifier: guess which terminal folder + title a scanned document is,
// from its OCR text. Keyword heuristics only — the operator always confirms (never auto-files). Used
// to pre-select the filing form on drop. Returns null when nothing matches confidently.

import type { OcrExtractionResult } from "@/lib/ocr/types";
import { isTitleAllowed } from "@/lib/documents/folderTaxonomy";

export type FolderTitleSuggestion = {
  folderKey: string;
  titleKey: string;
  confidence: number; // 0..1 heuristic
  matched: string; // the keyword that triggered it (for transparency)
};

// Ordered most-specific-first. First rule whose keyword appears in the text wins.
// Ordered most-specific-first. First rule whose keyword appears in the text wins.
// Keyword seeds from the 2026-07-06 sample set (Buckets 1–13); refine against ocr-review-report.md.
const RULES: { keywords: string[]; folderKey: string; titleKey: string; confidence: number }[] = [
  // --- Workers' Comp forms (specific form numbers → high confidence) ---
  { keywords: ["c-8.4", "c8.4", "c 8.4"], folderKey: "workers_comp", titleKey: "c84", confidence: 0.9 },
  { keywords: ["c-8.1", "c8.1", "c 8.1"], folderKey: "workers_comp", titleKey: "c81", confidence: 0.9 },
  { keywords: ["hpj-1", "hpj1"], folderKey: "workers_comp", titleKey: "hpj1", confidence: 0.85 },
  { keywords: ["hp-1", "hp1"], folderKey: "workers_comp", titleKey: "hp1", confidence: 0.8 },

  // --- Denials / EOB / EOR / peer review ---
  { keywords: ["nf-10", "nf 10", "n.f.-10", "denial of claim form"], folderKey: "claim_documents.denials", titleKey: "nf10", confidence: 0.85 },
  { keywords: ["explanation of benefits", "explanation of review", "explanation of reimbursement", " eob ", " eor "], folderKey: "claim_documents.denials", titleKey: "eob_eor", confidence: 0.7 },
  { keywords: ["peer review", "independent medical exam", "ime report", "independent medical examination"], folderKey: "claim_documents.denials", titleKey: "peer_review_ime", confidence: 0.75 },

  // --- Bills: NF-3 (No-Fault verification-of-treatment BILLING form), CMS-1500/HCFA, UB-04 ---
  { keywords: ["nf-3", "nf 3", "n.f.-3", "verification of treatment by attending", "verification of treatment by the attending"], folderKey: "claim_documents.bills", titleKey: "bill", confidence: 0.8 },
  { keywords: ["health insurance claim form", "cms-1500", "cms 1500", "hcfa", "ub-04", "ub 04", "ub04", "itemized bill", "statement of services"], folderKey: "claim_documents.bills", titleKey: "bill", confidence: 0.75 },
  { keywords: ["assignment of benefits", " aob "], folderKey: "claim_documents.bills", titleKey: "aob", confidence: 0.8 },
  { keywords: ["notice of lien", "lien"], folderKey: "claim_documents.bills", titleKey: "liens", confidence: 0.6 },

  // --- Proof of mailing (incl. fax POM / carrier submission) ---
  { keywords: ["proof of mailing", "certificate of mailing", "certified mail", "return receipt", "usps tracking", "fax confirmation", "transmission result", "transmission report", "fax transmission"], folderKey: "claim_documents.bills", titleKey: "proof_of_mailing", confidence: 0.72 },

  // --- Verification requests / responses (carrier delay letters) ---
  { keywords: ["additional verification", "request for verification", "verification is requested", "we require the following", "delay of your claim", "verification request"], folderKey: "claim_documents.verification.requests", titleKey: "request_dated", confidence: 0.62 },
  { keywords: ["response to verification", "enclosed please find the requested"], folderKey: "claim_documents.verification.responses", titleKey: "response_dated", confidence: 0.6 },

  // --- Payments / ledgers ---
  { keywords: ["payment ledger", "remittance advice", "amount paid", "check number", "we have issued payment", "payment voucher"], folderKey: "claim_documents.payments", titleKey: "payment", confidence: 0.6 },

  // --- Reports / medical records (SOAP, operative, imaging, narrative) ---
  { keywords: ["soap note", "progress note", "office note", "operative report", "narrative report", "medical report", "range of motion", "physical therapy", "initial evaluation", "re-evaluation", "mri of", "x-ray report", "history of present illness"], folderKey: "claim_documents.reports", titleKey: "report", confidence: 0.6 },
  { keywords: ["prescription", "referral for", "rx ", "please dispense", "diagnostic testing referral"], folderKey: "claim_documents.reports", titleKey: "prescription", confidence: 0.6 },

  // --- Police / accident ---
  { keywords: ["police report", "police accident report", "mv-104"], folderKey: "claim_documents.miscellaneous", titleKey: "police_report", confidence: 0.75 },

  // --- Arbitration ---
  { keywords: ["arbitration award", "master arbitrator", "award of arbitrator", "american arbitration association"], folderKey: "arbitration.awards", titleKey: "award", confidence: 0.75 },
  { keywords: ["ar1", "ar-1"], folderKey: "arbitration.correspondence_ar1", titleKey: "ar1", confidence: 0.65 },

  // --- Litigation ---
  { keywords: ["affidavit of service", "affirmation of service", "affidavit of mailing"], folderKey: "litigation.pleadings_receipts", titleKey: "affidavit_of_service", confidence: 0.75 },
  { keywords: ["department of financial services", "superintendent of financial services", "designation of the superintendent"], folderKey: "litigation.pleadings_receipts", titleKey: "dfs_receipts", confidence: 0.7 },
  { keywords: ["summons", "verified complaint", "complaint"], folderKey: "litigation.pleadings_receipts", titleKey: "complaint", confidence: 0.6 },
  { keywords: ["verified answer", "answer with affirmative defenses", "defendant's answer", "answer to the complaint"], folderKey: "litigation.pleadings_receipts", titleKey: "answer", confidence: 0.6 },
  { keywords: ["stipulation of settlement"], folderKey: "litigation.stipulations", titleKey: "stip_settlement", confidence: 0.8 },
  { keywords: ["stipulation of discontinuance", "stipulation to withdraw", "stipulation withdrawing"], folderKey: "litigation.stipulations", titleKey: "stip_discontinuance", confidence: 0.75 },
  { keywords: ["notice of trial"], folderKey: "litigation.other_filings", titleKey: "notice_of_trial", confidence: 0.75 },
  { keywords: ["notice of entry"], folderKey: "litigation.other_filings", titleKey: "notice_of_entry", confidence: 0.75 },
  { keywords: ["trial de novo"], folderKey: "litigation.other_filings", titleKey: "demand_trial_de_novo", confidence: 0.8 },
  { keywords: ["default judgment", "judgment"], folderKey: "litigation.judgments", titleKey: "judgment", confidence: 0.6 },
];

export function suggestFolderTitle(result: OcrExtractionResult): FolderTitleSuggestion | null {
  const text = (result.text || "").toLowerCase();
  if (!text.trim()) return null;
  for (const rule of RULES) {
    const hit = rule.keywords.find((k) => text.includes(k));
    if (hit && isTitleAllowed(rule.folderKey, rule.titleKey)) {
      return { folderKey: rule.folderKey, titleKey: rule.titleKey, confidence: rule.confidence, matched: hit };
    }
  }
  return null;
}
