import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Severity = "critical" | "warning" | "info";
type AuditStatus = "pass" | "review";

type SampleRow = {
  matter_id: number;
  display_number: string | null;
  patient_name: string | null;
  provider_name: string | null;
  client_name: string | null;
  insurer_name: string | null;
  claim_number_raw: string | null;
  claim_number_normalized: string | null;
  claim_amount: number | null;
  payment_amount: number | null;
  balance_amount: number | null;
  status: string | null;
  final_status: string | null;
  close_reason: string | null;
  master_lawsuit_id: string | null;
  indexed_at: Date;
  issue_detail?: string;
};

type AuditCheck = {
  id: string;
  label: string;
  severity: Severity;
  status: AuditStatus;
  count: number;
  description: string;
  sampleRows: SampleRow[];
};

type CountBucket = {
  label: string;
  count: number;
};

const SAMPLE_LIMIT = 25;
const STALE_INDEXED_AT_DAYS = 30;

const CLAIM_INDEX_AUDIT_SELECT = {
  matter_id: true,
  display_number: true,
  patient_name: true,
  provider_name: true,
  client_name: true,
  insurer_name: true,
  claim_number_raw: true,
  claim_number_normalized: true,
  claim_amount: true,
  payment_amount: true,
  balance_amount: true,
  status: true,
  final_status: true,
  close_reason: true,
  master_lawsuit_id: true,
  indexed_at: true,
} satisfies Prisma.ClaimIndexSelect;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function isBlankWhere(field: keyof Prisma.ClaimIndexWhereInput): Prisma.ClaimIndexWhereInput {
  return {
    OR: [
      { [field]: null } as Prisma.ClaimIndexWhereInput,
      { [field]: "" } as Prisma.ClaimIndexWhereInput,
    ],
  };
}

function isPresentWhere(field: keyof Prisma.ClaimIndexWhereInput): Prisma.ClaimIndexWhereInput {
  return {
    NOT: [
      { [field]: null } as Prisma.ClaimIndexWhereInput,
      { [field]: "" } as Prisma.ClaimIndexWhereInput,
    ],
  };
}

function rowWithIssueDetail(row: SampleRow, issue_detail: string): SampleRow {
  return { ...row, issue_detail };
}

async function countRows(where: Prisma.ClaimIndexWhereInput): Promise<number> {
  return prisma.claimIndex.count({ where });
}

async function sampleRows(where: Prisma.ClaimIndexWhereInput, take = SAMPLE_LIMIT): Promise<SampleRow[]> {
  return prisma.claimIndex.findMany({
    where,
    select: CLAIM_INDEX_AUDIT_SELECT,
    orderBy: [{ matter_id: "asc" }],
    take,
  });
}

async function claimCheck(
  checks: AuditCheck[],
  config: {
    id: string;
    label: string;
    severity: Severity;
    where: Prisma.ClaimIndexWhereInput;
    description: string;
  }
) {
  const [count, rows] = await Promise.all([
    countRows(config.where),
    sampleRows(config.where),
  ]);

  checks.push({
    id: config.id,
    label: config.label,
    severity: config.severity,
    status: count > 0 ? "review" : "pass",
    count,
    description: config.description,
    sampleRows: rows,
  });
}

function lawsuitOptionsObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function lawsuitFinalStatus(options: Prisma.JsonValue | null): string {
  const obj = lawsuitOptionsObject(options);
  return clean(obj.finalStatus ?? obj.final_status);
}

function isClosedLawsuit(options: Prisma.JsonValue | null): boolean {
  return lower(lawsuitFinalStatus(options)) === "closed";
}

function bucketLabel(value: unknown): string {
  const text = clean(value);
  return text || "(blank)";
}

function mapBuckets<T extends Record<string, unknown>>(rows: T[], key: keyof T): CountBucket[] {
  return rows
    .map((row) => ({
      label: bucketLabel(row[key]),
      count: Number((row as any)._count?._all ?? 0),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

async function groupCountByClaimIndexField(field: "status" | "final_status" | "close_reason"): Promise<CountBucket[]> {
  const rows = await prisma.claimIndex.groupBy({
    by: [field],
    _count: { _all: true },
    orderBy: { _count: { [field]: "desc" } },
  });

  return mapBuckets(rows as any[], field);
}

export async function GET() {
  try {
    const checks: AuditCheck[] = [];
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - STALE_INDEXED_AT_DAYS * 24 * 60 * 60 * 1000);

    const [
      totalRows,
      linkedRows,
      lawsuits,
      statusCounts,
      finalStatusCounts,
      closeReasonCounts,
      missingDisplayCount,
      missingClaimRawCount,
      missingClaimNormalizedCount,
      missingPatientCount,
      missingProviderIdentityCount,
      missingInsurerCount,
      invalidFinalStatusRows,
      paymentCandidateRows,
      linkedMasterRows,
    ] = await Promise.all([
      prisma.claimIndex.count(),
      prisma.claimIndex.count({ where: isPresentWhere("master_lawsuit_id") }),
      prisma.lawsuit.findMany({
        select: {
          masterLawsuitId: true,
          lawsuitOptions: true,
          clioMasterMatterId: true,
          clioMasterDisplayNumber: true,
        },
        orderBy: { masterLawsuitId: "asc" },
      }),
      groupCountByClaimIndexField("status"),
      groupCountByClaimIndexField("final_status"),
      groupCountByClaimIndexField("close_reason"),
      countRows(isBlankWhere("display_number")),
      countRows(isBlankWhere("claim_number_raw")),
      countRows(isBlankWhere("claim_number_normalized")),
      countRows(isBlankWhere("patient_name")),
      countRows({
        AND: [
          isBlankWhere("provider_name"),
          isBlankWhere("client_name"),
          isBlankWhere("treating_provider"),
        ],
      }),
      countRows(isBlankWhere("insurer_name")),
      sampleRows({
        AND: [
          isPresentWhere("final_status"),
          { final_status: { notIn: ["Open", "Closed", ""] } },
        ],
      }, 500),
      prisma.claimIndex.findMany({
        where: {
          AND: [
            { payment_amount: { not: null } },
            { claim_amount: { not: null } },
          ],
        },
        select: CLAIM_INDEX_AUDIT_SELECT,
        orderBy: [{ matter_id: "asc" }],
      }),
      prisma.claimIndex.findMany({
        where: isPresentWhere("master_lawsuit_id"),
        select: CLAIM_INDEX_AUDIT_SELECT,
        orderBy: [{ matter_id: "asc" }],
      }),
    ]);

    checks.push({
      id: "missing-display-number",
      label: "Missing display_number",
      severity: "critical",
      status: missingDisplayCount > 0 ? "review" : "pass",
      count: missingDisplayCount,
      description: "Display number is required for reliable UI search, restore review, export, and user-facing matter identification.",
      sampleRows: await sampleRows(isBlankWhere("display_number")),
    });

    const duplicateGroups = await prisma.claimIndex.groupBy({
      by: ["display_number"],
      where: isPresentWhere("display_number"),
      _count: { _all: true },
    });

    const duplicateDisplayNumbers = duplicateGroups
      .filter((group) => clean(group.display_number) && group._count._all > 1)
      .map((group) => clean(group.display_number));

    const duplicateRows = duplicateDisplayNumbers.length
      ? await prisma.claimIndex.findMany({
          where: { display_number: { in: duplicateDisplayNumbers.slice(0, 100) } },
          select: CLAIM_INDEX_AUDIT_SELECT,
          orderBy: [{ display_number: "asc" }, { matter_id: "asc" }],
          take: SAMPLE_LIMIT,
        })
      : [];

    checks.push({
      id: "duplicate-display-number",
      label: "Duplicate display_number",
      severity: "critical",
      status: duplicateDisplayNumbers.length > 0 ? "review" : "pass",
      count: duplicateGroups
        .filter((group) => clean(group.display_number) && group._count._all > 1)
        .reduce((sum, group) => sum + group._count._all, 0),
      description: "Duplicate display numbers undermine matter identity, CSV review, document targeting, and restore confidence.",
      sampleRows: duplicateRows.map((row) =>
        rowWithIssueDetail(
          row,
          `Duplicate display_number ${clean(row.display_number)} appears ${
            duplicateGroups.find((group) => clean(group.display_number) === clean(row.display_number))?._count._all ?? 0
          } time(s).`
        )
      ),
    });

    checks.push({
      id: "missing-claim-number-raw",
      label: "Missing claim_number_raw",
      severity: "warning",
      status: missingClaimRawCount > 0 ? "review" : "pass",
      count: missingClaimRawCount,
      description: "Raw claim number gaps reduce claim-level search confidence.",
      sampleRows: await sampleRows(isBlankWhere("claim_number_raw")),
    });

    checks.push({
      id: "missing-claim-number-normalized",
      label: "Missing claim_number_normalized",
      severity: "warning",
      status: missingClaimNormalizedCount > 0 ? "review" : "pass",
      count: missingClaimNormalizedCount,
      description: "Normalized claim number gaps reduce matching consistency across import/search workflows.",
      sampleRows: await sampleRows(isBlankWhere("claim_number_normalized")),
    });

    checks.push({
      id: "missing-patient-name",
      label: "Missing patient_name",
      severity: "critical",
      status: missingPatientCount > 0 ? "review" : "pass",
      count: missingPatientCount,
      description: "Patient name is a core search, restore, and document-generation field.",
      sampleRows: await sampleRows(isBlankWhere("patient_name")),
    });

    checks.push({
      id: "missing-provider-identity",
      label: "Missing provider/client identity",
      severity: "critical",
      status: missingProviderIdentityCount > 0 ? "review" : "pass",
      count: missingProviderIdentityCount,
      description: "Rows are flagged only when provider_name, client_name, and treating_provider are all blank.",
      sampleRows: await sampleRows({
        AND: [
          isBlankWhere("provider_name"),
          isBlankWhere("client_name"),
          isBlankWhere("treating_provider"),
        ],
      }),
    });

    checks.push({
      id: "missing-insurer-name",
      label: "Missing insurer_name",
      severity: "warning",
      status: missingInsurerCount > 0 ? "review" : "pass",
      count: missingInsurerCount,
      description: "Insurer gaps reduce insurance-company filtering and document merge confidence.",
      sampleRows: await sampleRows(isBlankWhere("insurer_name")),
    });

    checks.push({
      id: "invalid-final-status",
      label: "final_status outside Open/Closed/blank policy",
      severity: "critical",
      status: invalidFinalStatusRows.length > 0 ? "review" : "pass",
      count: invalidFinalStatusRows.length,
      description: "Final Status should remain Open, Closed, or blank under the current workflow policy.",
      sampleRows: invalidFinalStatusRows.slice(0, SAMPLE_LIMIT),
    });

    await claimCheck(checks, {
      id: "closed-without-close-reason",
      label: "final_status = Closed but missing close_reason",
      severity: "critical",
      where: {
        AND: [
          { final_status: "Closed" },
          isBlankWhere("close_reason"),
        ],
      },
      description: "Closed rows should preserve the workflow reason selected when the matter/lawsuit was closed.",
    });

    await claimCheck(checks, {
      id: "close-reason-without-closed-final-status",
      label: "close_reason present but final_status is not Closed",
      severity: "critical",
      where: {
        AND: [
          isPresentWhere("close_reason"),
          { NOT: { final_status: "Closed" } },
        ],
      },
      description: "A close reason without Closed final status indicates inconsistent close-workflow state.",
    });

    const knownMasterIds = new Set(lawsuits.map((lawsuit) => lawsuit.masterLawsuitId));
    const linkedRowsMissingLocalMaster = linkedMasterRows.filter(
      (row) => clean(row.master_lawsuit_id) && !knownMasterIds.has(clean(row.master_lawsuit_id))
    );

    checks.push({
      id: "missing-local-lawsuit-for-master-link",
      label: "Rows with master_lawsuit_id but no matching local Lawsuit",
      severity: "critical",
      status: linkedRowsMissingLocalMaster.length > 0 ? "review" : "pass",
      count: linkedRowsMissingLocalMaster.length,
      description: "A ClaimIndex child link should resolve to a local Lawsuit.masterLawsuitId for grouping, restore review, and document-generation context.",
      sampleRows: linkedRowsMissingLocalMaster
        .slice(0, SAMPLE_LIMIT)
        .map((row) => rowWithIssueDetail(row, `No local Lawsuit row found for ${clean(row.master_lawsuit_id)}.`)),
    });

    const closedMasterIds = new Set(
      lawsuits
        .filter((lawsuit) => isClosedLawsuit(lawsuit.lawsuitOptions))
        .map((lawsuit) => lawsuit.masterLawsuitId)
    );

    const linkedToClosedMasterButOpen = linkedMasterRows.filter(
      (row) =>
        closedMasterIds.has(clean(row.master_lawsuit_id)) &&
        lower(row.final_status) !== "closed"
    );

    checks.push({
      id: "child-linked-to-closed-lawsuit-not-closed",
      label: "Child rows linked to a closed lawsuit but not marked Closed",
      severity: "critical",
      status: linkedToClosedMasterButOpen.length > 0 ? "review" : "pass",
      count: linkedToClosedMasterButOpen.length,
      description: "When a local lawsuit is closed, linked child ClaimIndex rows should also reflect Closed final status.",
      sampleRows: linkedToClosedMasterButOpen
        .slice(0, SAMPLE_LIMIT)
        .map((row) => rowWithIssueDetail(row, `Linked local lawsuit ${clean(row.master_lawsuit_id)} has lawsuitOptions finalStatus Closed.`)),
    });

    await claimCheck(checks, {
      id: "negative-claim-amount",
      label: "Negative claim_amount",
      severity: "critical",
      where: { claim_amount: { lt: 0 } },
      description: "Negative claim amounts are inconsistent with claim-value and document-generation review.",
    });

    await claimCheck(checks, {
      id: "negative-balance-amount",
      label: "Negative balance_amount",
      severity: "warning",
      where: { balance_amount: { lt: 0 } },
      description: "Negative balances may be possible only in unusual overpayment/reversal scenarios and should be reviewed.",
    });

    const paymentExceedsClaimRows = paymentCandidateRows.filter((row) => {
      const payment = Number(row.payment_amount);
      const claim = Number(row.claim_amount);
      return Number.isFinite(payment) && Number.isFinite(claim) && payment > claim;
    });

    checks.push({
      id: "payment-greater-than-claim",
      label: "payment_amount greater than claim_amount",
      severity: "warning",
      status: paymentExceedsClaimRows.length > 0 ? "review" : "pass",
      count: paymentExceedsClaimRows.length,
      description: "This is flagged for review only. It is not automatically wrong because reversals, settlements, or imported payment conventions may explain it.",
      sampleRows: paymentExceedsClaimRows.slice(0, SAMPLE_LIMIT),
    });

    await claimCheck(checks, {
      id: "missing-claim-amount",
      label: "Missing claim_amount",
      severity: "critical",
      where: { claim_amount: null },
      description: "Claim Amount is the source financial field for UI review and downstream balance/payment confidence.",
    });

    await claimCheck(checks, {
      id: "stale-indexed-at",
      label: `indexed_at older than ${STALE_INDEXED_AT_DAYS} days`,
      severity: "info",
      where: { indexed_at: { lt: staleThreshold } },
      description: "Stale indexed_at is informational because the ClaimIndex may remain valid even when records have not changed recently.",
    });

    checks.push({
      id: "missing-indexed-at",
      label: "Missing indexed_at",
      severity: "info",
      status: "pass",
      count: 0,
      description: "Schema inspection shows indexed_at is non-nullable with a default, so missing indexed_at is not expected through Prisma.",
      sampleRows: [],
    });

    const criticalIssues = checks
      .filter((check) => check.severity === "critical")
      .reduce((sum, check) => sum + check.count, 0);
    const warningIssues = checks
      .filter((check) => check.severity === "warning")
      .reduce((sum, check) => sum + check.count, 0);
    const infoIssues = checks
      .filter((check) => check.severity === "info")
      .reduce((sum, check) => sum + check.count, 0);

    return NextResponse.json({
      ok: true,
      readOnly: true,
      sourceOfTruth: "ClaimIndex/local Barsh Matters plus local Lawsuit metadata",
      generatedAt: now.toISOString(),
      staleIndexedAtDays: STALE_INDEXED_AT_DAYS,
      summary: {
        totalRows,
        linkedRows,
        localLawsuitCount: lawsuits.length,
        closedLocalLawsuitCount: closedMasterIds.size,
        checksRun: checks.length,
        checksWithFindings: checks.filter((check) => check.count > 0).length,
        criticalIssues,
        warningIssues,
        infoIssues,
      },
      counts: {
        status: statusCounts,
        finalStatus: finalStatusCounts,
        closeReason: closeReasonCounts,
        masterLawsuitPresence: [
          { label: "Linked to master_lawsuit_id", count: linkedRows },
          { label: "No master_lawsuit_id", count: totalRows - linkedRows },
        ],
      },
      checks,
      safety:
        "Read-only Admin ClaimIndex data-quality audit. This route only reads prisma.claimIndex and prisma.lawsuit. It does not update ClaimIndex, restore data, call Clio, generate documents, send email, print, queue, or write the database.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        readOnly: true,
        error: err?.message || "Admin ClaimIndex data-quality audit failed.",
      },
      { status: 500 }
    );
  }
}
