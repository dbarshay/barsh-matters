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
const RULES: { keywords: string[]; folderKey: string; titleKey: string; confidence: number }[] = [
  { keywords: ["nf-10", "nf 10", "denial of claim"], folderKey: "claim_documents.denials", titleKey: "nf10", confidence: 0.8 },
  { keywords: ["explanation of benefits", "explanation of review", "eob", "eor"], folderKey: "claim_documents.denials", titleKey: "eob_eor", confidence: 0.7 },
  { keywords: ["peer review", "independent medical exam", "ime report"], folderKey: "claim_documents.denials", titleKey: "peer_review_ime", confidence: 0.7 },
  { keywords: ["assignment of benefits", "aob"], folderKey: "claim_documents.bills", titleKey: "aob", confidence: 0.75 },
  { keywords: ["proof of mailing", "certificate of mailing"], folderKey: "claim_documents.bills", titleKey: "proof_of_mailing", confidence: 0.75 },
  { keywords: ["lien"], folderKey: "claim_documents.bills", titleKey: "liens", confidence: 0.6 },
  { keywords: ["prescription", "rx "], folderKey: "claim_documents.reports", titleKey: "prescription", confidence: 0.6 },
  { keywords: ["health insurance claim form", "cms-1500", "cms 1500", "hcfa", "ub-04", "ub 04", "itemized bill", "statement of services"], folderKey: "claim_documents.bills", titleKey: "bill", confidence: 0.7 },
  { keywords: ["police report", "accident report", "mv-104"], folderKey: "claim_documents.miscellaneous", titleKey: "police_report", confidence: 0.7 },
  // Arbitration / litigation
  { keywords: ["arbitration award", "master arbitrator", "award of arbitrator"], folderKey: "arbitration.awards", titleKey: "award", confidence: 0.75 },
  { keywords: ["summons", "verified complaint", "complaint"], folderKey: "litigation.pleadings_receipts", titleKey: "complaint", confidence: 0.6 },
  { keywords: ["verified answer", "answer with affirmative defenses"], folderKey: "litigation.pleadings_receipts", titleKey: "answer", confidence: 0.6 },
  { keywords: ["affidavit of service", "affirmation of service"], folderKey: "litigation.pleadings_receipts", titleKey: "affidavit_of_service", confidence: 0.7 },
  { keywords: ["stipulation of settlement"], folderKey: "litigation.stipulations", titleKey: "stip_settlement", confidence: 0.8 },
  { keywords: ["stipulation of discontinuance"], folderKey: "litigation.stipulations", titleKey: "stip_discontinuance", confidence: 0.8 },
  { keywords: ["notice of trial"], folderKey: "litigation.other_filings", titleKey: "notice_of_trial", confidence: 0.75 },
  { keywords: ["notice of entry"], folderKey: "litigation.other_filings", titleKey: "notice_of_entry", confidence: 0.75 },
  { keywords: ["trial de novo"], folderKey: "litigation.other_filings", titleKey: "demand_trial_de_novo", confidence: 0.8 },
  { keywords: ["judgment"], folderKey: "litigation.judgments", titleKey: "judgment", confidence: 0.6 },
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
