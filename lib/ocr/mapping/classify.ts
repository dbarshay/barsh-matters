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
// Ordered most-specific-first. First rule whose keyword matches (as a whole token — word-boundary,
// so "lien" won't fire inside "client") wins. Litigation pleadings sit ABOVE bills because a
// summons/complaint recites "assignment of benefits" and would otherwise be mis-tagged AOB.
// Keyword seeds from the 2026-07-06 sample set (Buckets 1–13); refine against ocr-review-report.md.
const RULES: { keywords: string[]; folderKey: string; titleKey: string; confidence: number }[] = [
  // --- Workers' Comp forms (specific form numbers → high confidence) ---
  { keywords: ["c-8.4", "c8.4", "c 8.4"], folderKey: "workers_comp", titleKey: "c84", confidence: 0.9 },
  { keywords: ["c-8.1", "c8.1", "c 8.1"], folderKey: "workers_comp", titleKey: "c81", confidence: 0.9 },
  { keywords: ["hpj-1", "hpj1"], folderKey: "workers_comp", titleKey: "hpj1", confidence: 0.85 },
  { keywords: ["hp-1", "hp1"], folderKey: "workers_comp", titleKey: "hp1", confidence: 0.8 },

  // --- Litigation pleadings (ABOVE bills so S/C recitals don't hit AOB) ---
  // Motions FIRST (a motion packet contains an AOS page that would otherwise win). NOTE: defaults to
  // DEFENDANT's motion (carrier motions dominate these files) — operator flips if it's ours.
  { keywords: ["notice of motion", "motion to strike", "motion to compel", "motion for summary judgment", "affirmation in support of"], folderKey: "litigation.motions", titleKey: "defendants_motion", confidence: 0.55 },
  { keywords: ["verified answer", "answer with affirmative defenses", "answer to the complaint", "defendant's verified answer"], folderKey: "litigation.pleadings_receipts", titleKey: "answer", confidence: 0.68 },
  { keywords: ["affidavit of service", "affirmation of service", "affidavit of mailing"], folderKey: "litigation.pleadings_receipts", titleKey: "affidavit_of_service", confidence: 0.78 },
  { keywords: ["dfs receipt", "designation of superintendent", "designation of the superintendent", "superintendent as agent for service"], folderKey: "litigation.pleadings_receipts", titleKey: "dfs_receipts", confidence: 0.7 },
  { keywords: ["summons", "verified complaint", "summons and complaint"], folderKey: "litigation.pleadings_receipts", titleKey: "complaint", confidence: 0.7 },
  { keywords: ["stipulation of settlement"], folderKey: "litigation.stipulations", titleKey: "stip_settlement", confidence: 0.8 },
  { keywords: ["stipulation of discontinuance", "stipulation to withdraw", "stipulation withdrawing"], folderKey: "litigation.stipulations", titleKey: "stip_discontinuance", confidence: 0.75 },
  { keywords: ["notice of trial"], folderKey: "litigation.other_filings", titleKey: "notice_of_trial", confidence: 0.75 },
  { keywords: ["notice of entry"], folderKey: "litigation.other_filings", titleKey: "notice_of_entry", confidence: 0.75 },
  { keywords: ["trial de novo"], folderKey: "litigation.other_filings", titleKey: "demand_trial_de_novo", confidence: 0.8 },
  { keywords: ["default judgment", "judgment entered", "money judgment", "clerk's judgment"], folderKey: "litigation.judgments", titleKey: "judgment", confidence: 0.6 },

  // --- Arbitration (specific — "american arbitration association" alone appears in denial appeal-rights) ---
  { keywords: ["arbitration award", "master arbitrator", "award of arbitrator", "aaa case no"], folderKey: "arbitration.awards", titleKey: "award", confidence: 0.75 },
  { keywords: ["ar-1", "ar1"], folderKey: "arbitration.correspondence_ar1", titleKey: "ar1", confidence: 0.6 },

  // --- Denials / EOB / EOR ---
  { keywords: ["nf-10", "nf 10", "n.f.-10", "denial of claim form"], folderKey: "claim_documents.denials", titleKey: "nf10", confidence: 0.85 },
  { keywords: ["explanation of benefits", "explanation of review", "explanation of reimbursement", "eob", "eor"], folderKey: "claim_documents.denials", titleKey: "eob_eor", confidence: 0.7 },

  // --- Proof of mailing (ABOVE bills — fax-ack/POM docs mention "aob" and would mis-file as AOB) ---
  { keywords: ["proof of mailing", "proof of submission", "pom id", "certificate of mailing", "certified mail", "return receipt", "usps tracking", "fax confirmation", "transmission result", "transmission report", "fax acknowledge", "fax acknowledgment"], folderKey: "claim_documents.bills", titleKey: "proof_of_mailing", confidence: 0.74 },

  // --- Bills: NF-3, CMS-1500/HCFA, UB-04, superbill ---
  { keywords: ["nf-3", "nf 3", "n.f.-3", "verification of treatment by attending", "verification of treatment by the attending"], folderKey: "claim_documents.bills", titleKey: "bill", confidence: 0.8 },
  { keywords: ["health insurance claim form", "cms-1500", "cms 1500", "hcfa", "ub-04", "ub 04", "ub04", "superbill", "super bill", "encounter form", "charge slip", "fee slip", "itemized bill", "statement of services", "procedure description", "acpt asnt", "accept assignment"], folderKey: "claim_documents.bills", titleKey: "bill", confidence: 0.75 },
  { keywords: ["assignment of benefits", "aob"], folderKey: "claim_documents.bills", titleKey: "aob", confidence: 0.78 },
  { keywords: ["notice of lien"], folderKey: "claim_documents.bills", titleKey: "liens", confidence: 0.55 },

  // --- Billing letters (our cover/transmittal/resubmission letters to carriers → Bills) ---
  // ABOVE verification: these letters often say "additional verification" but are OUR enclosure letters.
  { keywords: [
    // BRL's own cover/transmittal letter template (unique phrasing so its legal boilerplate about
    // "peer review report" / "additional verification" doesn't mis-route it to denials/verification).
    "this office has been retained by the above-referenced provider",
    "retained by the above-referenced provider concerning the attached claim",
    "please direct all correspondence concerning this matter directly to our office",
    "payable to the medical provider and sent to our office",
    // Explicit enclosure / resubmission language.
    "enclosed please find the enclosed bill", "enclosed please find our bill", "we are enclosing the bill",
    "we are resubmitting", "resubmission of", "please reconsider", "kindly remit", "enclosed is our billing",
  ], folderKey: "claim_documents.bills", titleKey: "billing_letter", confidence: 0.6 },

  // --- Verification requests / responses (carrier-side; below billing letters) ---
  { keywords: ["additional verification", "request for verification", "verification is requested", "delay of your claim", "verification request"], folderKey: "claim_documents.verification.requests", titleKey: "request_dated", confidence: 0.62 },
  { keywords: ["in response to your request for verification", "in response to your verification request", "in response to your request for additional verification", "enclosed is the requested verification", "requested verification is enclosed", "response to verification"], folderKey: "claim_documents.verification.responses", titleKey: "response_dated", confidence: 0.62 },

  // BRL billing cover letter, low-priority letterhead catch (below verification so a verification
  // RESPONSE — also on our letterhead — is classified first). Catches the alternate ATT template.
  { keywords: ["brlfirm.com", "brl attorneys", "info@brlfirm"], folderKey: "claim_documents.bills", titleKey: "billing_letter", confidence: 0.5 },

  // --- Payments / ledgers ---
  { keywords: ["payment ledger", "remittance advice", "amount paid", "check number", "payment voucher"], folderKey: "claim_documents.payments", titleKey: "payment", confidence: 0.6 },

  // --- Reports / medical records ---
  { keywords: ["soap note", "progress note", "office note", "operative report", "narrative report", "medical report", "range of motion", "initial evaluation", "re-evaluation", "mri of", "x-ray report", "history of present illness", "hpi", "chief complaint", "review of systems", "assessment and plan", "physical examination"], folderKey: "claim_documents.reports", titleKey: "report", confidence: 0.6 },
  { keywords: ["prescription", "referral for", "please dispense", "diagnostic testing referral", "doctors written order", "doctor's written order", "written order", "orthosis prescribed", "orthosis", "durable medical equipment", "dispense as written"], folderKey: "claim_documents.reports", titleKey: "prescription", confidence: 0.6 },

  // --- Peer review / IME (LOW priority + tightened — "peer review" alone over-fires on letters) ---
  { keywords: ["peer review report", "peer reviewer", "independent medical examination", "ime report", "independent radiology review"], folderKey: "claim_documents.denials", titleKey: "peer_review_ime", confidence: 0.7 },

  // --- Police / accident ---
  { keywords: ["police report", "police accident report", "mv-104"], folderKey: "claim_documents.miscellaneous", titleKey: "police_report", confidence: 0.75 },

  // Insurance ID card / policy declaration page → Miscellaneous.
  { keywords: ["insurance identification card", "insurance id card", "owner's policy of liability insurance", "policy of liability insurance", "declarations page", "declaration page", "dec page", "policy declarations"], folderKey: "claim_documents.miscellaneous", titleKey: "declaration_page", confidence: 0.6 },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-token match (word boundaries) so short keywords like "lien"/"aob" don't fire inside words. */
function hasKeyword(text: string, kw: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRe(kw)}([^a-z0-9]|$)`, "i").test(text);
}

export function suggestFolderTitle(result: OcrExtractionResult): FolderTitleSuggestion | null {
  const text = (result.text || "").toLowerCase();
  if (!text.trim()) return null;
  for (const rule of RULES) {
    const hit = rule.keywords.find((k) => hasKeyword(text, k));
    if (hit && isTitleAllowed(rule.folderKey, rule.titleKey)) {
      return { folderKey: rule.folderKey, titleKey: rule.titleKey, confidence: rule.confidence, matched: hit };
    }
  }
  return null;
}
