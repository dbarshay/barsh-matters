import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Severity = "critical" | "warning" | "info";
type AuditStatus = "pass" | "review";

type ChildPreview = {
  matter_id: number;
  display_number: string | null;
  patient_name: string | null;
  provider_name: string | null;
  client_name: string | null;
  treating_provider: string | null;
  insurer_name: string | null;
  claim_number_raw: string | null;
  claim_number_normalized: string | null;
  claim_amount: number | null;
  payment_amount: number | null;
  balance_amount: number | null;
  bill_number: string | null;
  dos_start: string | null;
  dos_end: string | null;
  date_of_loss: string | null;
  policy_number: string | null;
  denial_reason: string | null;
  final_status: string | null;
  close_reason: string | null;
  master_lawsuit_id: string | null;
  issue_detail?: string;
};

type ReadinessRow = {
  masterLawsuitId: string;
  clioMasterMatterId: number | null;
  clioMasterDisplayNumber: string | null;
  venue: string;
  venueSelection: string;
  venueOther: string;
  selectedCourtDetailsPresent: boolean;
  adversaryAttorney: string;
  selectedAdversaryAttorneyDetailsPresent: boolean;
  indexAaaNumber: string;
  dateFiled: string;
  dateOfLoss: string;
  amountSoughtMode: string;
  amountSought: number | null;
  customAmountSought: number | null;
  childCount: number;
  childDisplayNumbers: string[];
  childMatterIds: number[];
  finalStatus: string;
  closeReason: string;
  issue_detail?: string;
};

type AuditCheck = {
  id: string;
  label: string;
  severity: Severity;
  status: AuditStatus;
  count: number;
  description: string;
  sampleRows: ReadinessRow[];
  sampleChildRows?: ChildPreview[];
};

type CountBucket = {
  label: string;
  count: number;
};

const SAMPLE_LIMIT = 25;

const LAWSUIT_SELECT = {
  id: true,
  masterLawsuitId: true,
  claimNumber: true,
  lawsuitMatters: true,
  venue: true,
  venueSelection: true,
  venueOther: true,
  indexAaaNumber: true,
  lawsuitNotes: true,
  lawsuitOptions: true,
  amountSoughtMode: true,
  amountSought: true,
  customAmountSought: true,
  clioMasterMatterId: true,
  clioMasterDisplayNumber: true,
  clioMasterMatterDescription: true,
  clioMasterMappedAt: true,
  clioMasterMappingSource: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LawsuitSelect;

const CHILD_SELECT = {
  matter_id: true,
  display_number: true,
  patient_name: true,
  client_name: true,
  insurer_name: true,
  provider_name: true,
  treating_provider: true,
  claim_number_raw: true,
  claim_number_normalized: true,
  claim_amount: true,
  payment_amount: true,
  balance_amount: true,
  bill_number: true,
  dos_start: true,
  dos_end: true,
  denial_reason: true,
  policy_number: true,
  date_of_loss: true,
  master_lawsuit_id: true,
  close_reason: true,
  final_status: true,
} satisfies Prisma.ClaimIndexSelect;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function bucketLabel(value: unknown): string {
  return clean(value) || "(blank)";
}

function optionsObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function hasObject(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function amountPositive(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function displayProvider(row: ChildPreview): string {
  return clean(row.provider_name || row.client_name || row.treating_provider);
}

function displayClaimNumber(row: ChildPreview): string {
  return clean(row.claim_number_raw || row.claim_number_normalized);
}

function lawsuitFinalStatus(options: Record<string, unknown>): string {
  return clean(options.finalStatus ?? options.final_status);
}

function lawsuitCloseReason(options: Record<string, unknown>): string {
  return clean(options.closeReason ?? options.close_reason);
}

function lawsuitVenue(lawsuit: Prisma.LawsuitGetPayload<{ select: typeof LAWSUIT_SELECT }>, options: Record<string, unknown>): string {
  return clean(options.venueSelection || options.venue || lawsuit.venueSelection || lawsuit.venue);
}

function lawsuitIndexAaa(lawsuit: Prisma.LawsuitGetPayload<{ select: typeof LAWSUIT_SELECT }>, options: Record<string, unknown>): string {
  return clean(options.indexAaaNumber || lawsuit.indexAaaNumber);
}

function normalizeReadinessRow(
  lawsuit: Prisma.LawsuitGetPayload<{ select: typeof LAWSUIT_SELECT }>,
  children: ChildPreview[]
): ReadinessRow {
  const options = optionsObject(lawsuit.lawsuitOptions);
  const venue = clean(options.venue || lawsuit.venue);
  const venueSelection = clean(options.venueSelection || lawsuit.venueSelection);
  const venueOther = clean(options.venueOther || lawsuit.venueOther);
  const amountSoughtMode = clean(options.amountSoughtMode || lawsuit.amountSoughtMode || "balance_presuit");
  const customAmountSoughtRaw = options.customAmountSought ?? lawsuit.customAmountSought;
  const amountSoughtRaw = lawsuit.amountSought;

  return {
    masterLawsuitId: lawsuit.masterLawsuitId,
    clioMasterMatterId: lawsuit.clioMasterMatterId,
    clioMasterDisplayNumber: lawsuit.clioMasterDisplayNumber,
    venue,
    venueSelection,
    venueOther,
    selectedCourtDetailsPresent: hasObject(options.selectedCourtDetails),
    adversaryAttorney: clean(options.adversaryAttorney),
    selectedAdversaryAttorneyDetailsPresent: hasObject(options.selectedAdversaryAttorneyDetails),
    indexAaaNumber: lawsuitIndexAaa(lawsuit, options),
    dateFiled: clean(options.dateFiled),
    dateOfLoss: clean(options.dateOfLoss),
    amountSoughtMode,
    amountSought: amountSoughtRaw == null ? null : Number(amountSoughtRaw),
    customAmountSought: customAmountSoughtRaw == null || clean(customAmountSoughtRaw) === "" ? null : Number(customAmountSoughtRaw),
    childCount: children.length,
    childDisplayNumbers: children.map((child) => clean(child.display_number)).filter(Boolean),
    childMatterIds: children.map((child) => child.matter_id),
    finalStatus: lawsuitFinalStatus(options),
    closeReason: lawsuitCloseReason(options),
  };
}

function withDetail(row: ReadinessRow, issue_detail: string): ReadinessRow {
  return { ...row, issue_detail };
}

function childWithDetail(row: ChildPreview, issue_detail: string): ChildPreview {
  return { ...row, issue_detail };
}

function addCheck(checks: AuditCheck[], config: Omit<AuditCheck, "status">) {
  checks.push({
    ...config,
    status: config.count > 0 ? "review" : "pass",
    sampleRows: config.sampleRows.slice(0, SAMPLE_LIMIT),
    sampleChildRows: config.sampleChildRows?.slice(0, SAMPLE_LIMIT),
  });
}

function countBuckets(values: string[]): CountBucket[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = bucketLabel(value);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function optionCourtName(row: ReadinessRow): string {
  return row.venueSelection || row.venue || row.venueOther;
}

export async function GET() {
  try {
    const generatedAt = new Date();

    const [
      lawsuits,
      storedTemplateCount,
      storedTemplateVersionCount,
      storedMergeFieldCount,
      finalizationCount,
      printQueueCount,
    ] = await Promise.all([
      prisma.lawsuit.findMany({
        select: LAWSUIT_SELECT,
        orderBy: { masterLawsuitId: "asc" },
      }),
      prisma.documentTemplate.count().catch(() => 0),
      prisma.documentTemplateVersion.count().catch(() => 0),
      prisma.documentTemplateMergeField.count().catch(() => 0),
      prisma.documentFinalization.count().catch(() => 0),
      prisma.documentPrintQueueItem.count().catch(() => 0),
    ]);

    const childrenByMaster = new Map<string, ChildPreview[]>();

    for (const lawsuit of lawsuits) {
      const children = await prisma.claimIndex.findMany({
        where: { master_lawsuit_id: lawsuit.masterLawsuitId },
        select: CHILD_SELECT,
        orderBy: { matter_id: "asc" },
      });
      childrenByMaster.set(lawsuit.masterLawsuitId, children);
    }

    const rows = lawsuits.map((lawsuit) => normalizeReadinessRow(lawsuit, childrenByMaster.get(lawsuit.masterLawsuitId) || []));
    const allChildren = [...childrenByMaster.values()].flat();
    const checks: AuditCheck[] = [];

    const noChildren = rows.filter((row) => row.childCount === 0);
    addCheck(checks, {
      id: "no-linked-child-matters",
      label: "No linked child matters",
      severity: "critical",
      count: noChildren.length,
      description: "Document generation requires at least one linked ClaimIndex child matter for the master lawsuit.",
      sampleRows: noChildren,
    });

    const noMasterClioShell = rows.filter((row) => !row.clioMasterMatterId && !clean(row.clioMasterDisplayNumber));
    addCheck(checks, {
      id: "missing-master-clio-shell",
      label: "Missing mapped master Clio shell",
      severity: "critical",
      count: noMasterClioShell.length,
      description: "Final PDF upload and external document viewing require a mapped master Clio shell.",
      sampleRows: noMasterClioShell,
    });

    const partialMasterClioShell = rows.filter(
      (row) => (!!row.clioMasterMatterId && !clean(row.clioMasterDisplayNumber)) || (!row.clioMasterMatterId && !!clean(row.clioMasterDisplayNumber))
    );
    addCheck(checks, {
      id: "partial-master-clio-shell",
      label: "Partial mapped master Clio shell",
      severity: "warning",
      count: partialMasterClioShell.length,
      description: "The master shell mapping should ideally preserve both clioMasterMatterId and clioMasterDisplayNumber.",
      sampleRows: partialMasterClioShell,
    });

    const missingVenue = rows.filter((row) => !optionCourtName(row));
    addCheck(checks, {
      id: "missing-venue",
      label: "Missing venue/court selection",
      severity: "critical",
      count: missingVenue.length,
      description: "Venue/court selection is required for summons, complaint, bill schedule, and packet metadata.",
      sampleRows: missingVenue,
    });

    const missingCourtDetails = rows.filter((row) => optionCourtName(row) && !row.selectedCourtDetailsPresent);
    addCheck(checks, {
      id: "missing-selected-court-details",
      label: "Missing selectedCourtDetails",
      severity: "warning",
      count: missingCourtDetails.length,
      description: "Court display text exists, but selectedCourtDetails is missing; document captions/addresses may be less complete.",
      sampleRows: missingCourtDetails,
    });

    const otherVenueMissing = rows.filter((row) => lower(row.venueSelection || row.venue) === "other" && !clean(row.venueOther));
    addCheck(checks, {
      id: "other-venue-missing-text",
      label: "Venue is Other but venueOther is blank",
      severity: "critical",
      count: otherVenueMissing.length,
      description: "Other venue selections need the user-entered venue text for document generation.",
      sampleRows: otherVenueMissing,
    });

    const missingAdversary = rows.filter((row) => !row.adversaryAttorney);
    addCheck(checks, {
      id: "missing-adversary-attorney",
      label: "Missing adversary attorney",
      severity: "warning",
      count: missingAdversary.length,
      description: "Adversary attorney data is useful for captions, service, cover letters, and delivery workflows.",
      sampleRows: missingAdversary,
    });

    const missingAdversaryDetails = rows.filter((row) => row.adversaryAttorney && !row.selectedAdversaryAttorneyDetailsPresent);
    addCheck(checks, {
      id: "missing-adversary-attorney-details",
      label: "Missing selectedAdversaryAttorneyDetails",
      severity: "warning",
      count: missingAdversaryDetails.length,
      description: "Adversary attorney name exists, but structured address/contact details are missing.",
      sampleRows: missingAdversaryDetails,
    });

    const invalidAmountMode = rows.filter((row) => !["balance_presuit", "claim_amount", "custom"].includes(row.amountSoughtMode));
    addCheck(checks, {
      id: "invalid-amount-sought-mode",
      label: "Invalid amountSoughtMode",
      severity: "critical",
      count: invalidAmountMode.length,
      description: "Document amount selection should be balance_presuit, claim_amount, or custom.",
      sampleRows: invalidAmountMode,
    });

    const customMissing = rows.filter((row) => row.amountSoughtMode === "custom" && !amountPositive(row.customAmountSought));
    addCheck(checks, {
      id: "custom-amount-missing",
      label: "Custom amount mode missing customAmountSought",
      severity: "critical",
      count: customMissing.length,
      description: "Custom amount mode needs a positive customAmountSought.",
      sampleRows: customMissing,
    });

    const missingIndexAaaForFiled = rows.filter((row) => row.dateFiled && !row.indexAaaNumber);
    addCheck(checks, {
      id: "filed-lawsuit-missing-index-aaa",
      label: "dateFiled present but index/AAA number missing",
      severity: "warning",
      count: missingIndexAaaForFiled.length,
      description: "Filed lawsuits should generally preserve the index/AAA number for filed document captions.",
      sampleRows: missingIndexAaaForFiled,
    });

    const missingPatientChildren = allChildren.filter((child) => !clean(child.patient_name));
    addCheck(checks, {
      id: "child-missing-patient",
      label: "Child matter missing patient name",
      severity: "critical",
      count: missingPatientChildren.length,
      description: "Patient name is required for document captions and bill schedules.",
      sampleRows: [],
      sampleChildRows: missingPatientChildren.map((child) => childWithDetail(child, "Missing patient_name.")),
    });

    const missingProviderChildren = allChildren.filter((child) => !displayProvider(child));
    addCheck(checks, {
      id: "child-missing-provider",
      label: "Child matter missing provider/client",
      severity: "critical",
      count: missingProviderChildren.length,
      description: "Provider/client identity is required for captions, bill schedules, and claim grouping.",
      sampleRows: [],
      sampleChildRows: missingProviderChildren.map((child) => childWithDetail(child, "Missing provider_name/client_name/treating_provider.")),
    });

    const missingInsurerChildren = allChildren.filter((child) => !clean(child.insurer_name));
    addCheck(checks, {
      id: "child-missing-insurer",
      label: "Child matter missing insurer",
      severity: "critical",
      count: missingInsurerChildren.length,
      description: "Insurer is required for captions and claim presentation.",
      sampleRows: [],
      sampleChildRows: missingInsurerChildren.map((child) => childWithDetail(child, "Missing insurer_name.")),
    });

    const missingClaimNumberChildren = allChildren.filter((child) => !displayClaimNumber(child));
    addCheck(checks, {
      id: "child-missing-claim-number",
      label: "Child matter missing claim number",
      severity: "warning",
      count: missingClaimNumberChildren.length,
      description: "Claim number improves document packet clarity and matching.",
      sampleRows: [],
      sampleChildRows: missingClaimNumberChildren.map((child) => childWithDetail(child, "Missing claim_number_raw/claim_number_normalized.")),
    });

    const missingClaimAmountChildren = allChildren.filter((child) => child.claim_amount == null);
    addCheck(checks, {
      id: "child-missing-claim-amount",
      label: "Child matter missing claim amount",
      severity: "critical",
      count: missingClaimAmountChildren.length,
      description: "Claim Amount is required for bill schedules and amount-sought calculations.",
      sampleRows: [],
      sampleChildRows: missingClaimAmountChildren.map((child) => childWithDetail(child, "Missing claim_amount.")),
    });

    const missingDosChildren = allChildren.filter((child) => !clean(child.dos_start) && !clean(child.dos_end));
    addCheck(checks, {
      id: "child-missing-date-of-service",
      label: "Child matter missing date of service",
      severity: "warning",
      count: missingDosChildren.length,
      description: "Date of service is important for bill schedules and claim presentation.",
      sampleRows: [],
      sampleChildRows: missingDosChildren.map((child) => childWithDetail(child, "Missing dos_start/dos_end.")),
    });

    const missingBillNumberChildren = allChildren.filter((child) => !clean(child.bill_number));
    addCheck(checks, {
      id: "child-missing-bill-number",
      label: "Child matter missing bill number",
      severity: "info",
      count: missingBillNumberChildren.length,
      description: "Bill number is useful when available, but may not be required for every document.",
      sampleRows: [],
      sampleChildRows: missingBillNumberChildren.map((child) => childWithDetail(child, "Missing bill_number.")),
    });

    const templateRepositoryEmpty = storedTemplateCount <= 0;
    addCheck(checks, {
      id: "no-local-document-templates",
      label: "No local document templates",
      severity: "critical",
      count: templateRepositoryEmpty ? 1 : 0,
      description: "Document generation depends on the local Barsh Matters template repository.",
      sampleRows: templateRepositoryEmpty ? rows.slice(0, 1).map((row) => withDetail(row, "No DocumentTemplate rows found.")) : [],
    });

    const templateVersionsEmpty = storedTemplateVersionCount <= 0;
    addCheck(checks, {
      id: "no-local-template-versions",
      label: "No local document template versions",
      severity: "critical",
      count: templateVersionsEmpty ? 1 : 0,
      description: "Stored template versions are needed to select and generate documents from the local repository.",
      sampleRows: templateVersionsEmpty ? rows.slice(0, 1).map((row) => withDetail(row, "No DocumentTemplateVersion rows found.")) : [],
    });

    const noFinalizedDocuments = finalizationCount <= 0;
    addCheck(checks, {
      id: "no-finalized-document-history",
      label: "No finalized document history",
      severity: "info",
      count: noFinalizedDocuments ? 1 : 0,
      description: "Informational only. No finalized document history exists yet, or no finalizations have been recorded locally.",
      sampleRows: noFinalizedDocuments ? rows.slice(0, 1).map((row) => withDetail(row, "No DocumentFinalization rows found.")) : [],
    });

    const criticalIssues = checks.filter((check) => check.severity === "critical").reduce((sum, check) => sum + check.count, 0);
    const warningIssues = checks.filter((check) => check.severity === "warning").reduce((sum, check) => sum + check.count, 0);
    const infoIssues = checks.filter((check) => check.severity === "info").reduce((sum, check) => sum + check.count, 0);

    return NextResponse.json({
      ok: true,
      readOnly: true,
      sourceOfTruth: "Local Lawsuit, ClaimIndex, DocumentTemplate, DocumentFinalization, and DocumentPrintQueueItem tables",
      generatedAt: generatedAt.toISOString(),
      summary: {
        localLawsuitCount: rows.length,
        linkedChildMatterCount: allChildren.length,
        localDocumentTemplateCount: storedTemplateCount,
        localDocumentTemplateVersionCount: storedTemplateVersionCount,
        localDocumentTemplateMergeFieldCount: storedMergeFieldCount,
        finalizedDocumentRecordCount: finalizationCount,
        printQueueItemCount: printQueueCount,
        checksRun: checks.length,
        checksWithFindings: checks.filter((check) => check.count > 0).length,
        criticalIssues,
        warningIssues,
        infoIssues,
      },
      counts: {
        venue: countBuckets(rows.map((row) => row.venueSelection || row.venue)),
        amountSoughtMode: countBuckets(rows.map((row) => row.amountSoughtMode)),
        adversaryAttorney: countBuckets(rows.map((row) => row.adversaryAttorney)),
        masterClioShellMapping: [
          { label: "Mapped master Clio shell", count: rows.filter((row) => row.clioMasterMatterId || clean(row.clioMasterDisplayNumber)).length },
          { label: "No mapped master Clio shell", count: rows.filter((row) => !row.clioMasterMatterId && !clean(row.clioMasterDisplayNumber)).length },
        ],
        selectedCourtDetails: [
          { label: "Has selectedCourtDetails", count: rows.filter((row) => row.selectedCourtDetailsPresent).length },
          { label: "Missing selectedCourtDetails", count: rows.filter((row) => !row.selectedCourtDetailsPresent).length },
        ],
        adversaryAttorneyDetails: [
          { label: "Has selectedAdversaryAttorneyDetails", count: rows.filter((row) => row.selectedAdversaryAttorneyDetailsPresent).length },
          { label: "Missing selectedAdversaryAttorneyDetails", count: rows.filter((row) => !row.selectedAdversaryAttorneyDetailsPresent).length },
        ],
      },
      checks,
      safety:
        "Read-only Admin Document Generation Readiness Audit. This route only reads local Prisma tables. It does not call Clio, call Graph, create working documents, generate documents, finalize documents, upload documents, send email, print, queue, restore data, update records, delete records, or write the database.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        readOnly: true,
        error: err?.message || "Admin Document Generation Readiness Audit failed.",
      },
      { status: 500 }
    );
  }
}
