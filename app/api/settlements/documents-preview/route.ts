import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function money(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }

  const parsed = Number(clean(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function safeFilePart(value: unknown): string {
  return clean(value)
    .replace(/[\/\\:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function todayPathPart() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function uniqueClean(values: unknown[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function firstOrMultiple(values: unknown[], fallback = "") {
  const unique = uniqueClean(values);
  if (unique.length === 0) return fallback;
  if (unique.length === 1) return unique[0];
  return "MULTIPLE";
}

function safetySettlementDocumentsPreview() {
  return {
    action: "settlement-documents-preview",
    localFirst: true,
    sourceOfTruth: "barsh-matters-local",
    dryRun: true,
    previewOnly: true,
    readOnly: true,
    clioRecordsChanged: false,
    databaseRecordsChanged: false,
    documentsGenerated: false,
    printQueueChanged: false,
    persistentFilesCreated: false,
    mattersClosed: false,
    calendarEventsCreated: false,
    emailsSent: false,
    settlementWritebackPerformed: false,
  };
}

export async function GET(req: NextRequest) {
  try {
    const masterLawsuitId = clean(req.nextUrl.searchParams.get("masterLawsuitId"));
    const settlementRecordId = clean(req.nextUrl.searchParams.get("settlementRecordId"));

    if (!masterLawsuitId && !settlementRecordId) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-documents-preview",
          localFirst: true,
          sourceOfTruth: "barsh-matters-local",
          dryRun: true,
          error: "Missing masterLawsuitId or settlementRecordId.",
          safety: safetySettlementDocumentsPreview(),
        },
        { status: 400 }
      );
    }

    const settlementRecord = await prisma.localSettlementRecord.findFirst({
      where: {
        ...(settlementRecordId ? { id: settlementRecordId } : { masterLawsuitId }),
        voided: false,
      },
      orderBy: {
        recordedAt: "desc",
      },
      include: {
        rows: {
          orderBy: [
            { displayNumber: "asc" },
            { matterId: "asc" },
          ],
        },
      },
    });

    const warnings: string[] = [];
    const blockingErrors: string[] = [];

    if (!settlementRecord) {
      blockingErrors.push("No active Barsh Matters local settlement record found.");
    }

    const rows = settlementRecord?.rows || [];

    if (settlementRecord && rows.length === 0) {
      blockingErrors.push("Local settlement record has no settlement rows.");
    }

    if (settlementRecord && !clean(settlementRecord.paymentExpectedDate)) {
      warnings.push("Local settlement record has no Payment Due Date.");
    }

    const provider = firstOrMultiple(rows.map((row) => row.provider), "Provider");
    const patient = firstOrMultiple(rows.map((row) => row.patient), "Patient");
    const insurer = firstOrMultiple(rows.map((row) => row.insurer), "Insurer");
    const claimNumber = firstOrMultiple(rows.map((row) => row.claimNumber), "No Claim");

    const effectiveMasterLawsuitId = clean(settlementRecord?.masterLawsuitId) || masterLawsuitId || settlementRecordId;
    const baseName = `${safeFilePart(effectiveMasterLawsuitId)} - ${safeFilePart(provider)} aao ${safeFilePart(patient)} v ${safeFilePart(insurer)} - Claim ${safeFilePart(claimNumber)}`;
    const folderPath = `Settlements/${todayPathPart()}/${safeFilePart(effectiveMasterLawsuitId)}`;

    const plannedDocuments = [
      {
        key: "settlement-summary",
        label: "Settlement Summary",
        filename: `${baseName} - Settlement Summary.docx`,
        status: blockingErrors.length === 0 ? "ready-local-settlement-route-docx" : "blocked",
        availableNow: blockingErrors.length === 0,
        generationEndpoint: "/api/settlements/settlement-summary",
        routeOnly: true,
        sourceOfTruth: "barsh-matters-local",
        requiresFinalizationBeforeDelivery: true,
      },
      {
        key: "provider-remittance-breakdown",
        label: "Provider Remittance Breakdown",
        filename: `${baseName} - Provider Remittance Breakdown.docx`,
        status: blockingErrors.length === 0 ? "ready-local-settlement-route-docx" : "blocked",
        availableNow: blockingErrors.length === 0,
        generationEndpoint: "/api/settlements/provider-remittance-breakdown",
        routeOnly: true,
        sourceOfTruth: "barsh-matters-local",
        requiresFinalizationBeforeDelivery: true,
      },
      {
        key: "attorney-fee-breakdown",
        label: "Attorney Fee Breakdown",
        filename: `${baseName} - Attorney Fee Breakdown.docx`,
        status: blockingErrors.length === 0 ? "ready-local-settlement-route-docx" : "blocked",
        availableNow: blockingErrors.length === 0,
        generationEndpoint: "/api/settlements/attorney-fee-breakdown",
        routeOnly: true,
        sourceOfTruth: "barsh-matters-local",
        requiresFinalizationBeforeDelivery: true,
      },
    ];

    return NextResponse.json({
      ok: blockingErrors.length === 0,
      action: "settlement-documents-preview",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      dryRun: true,
      previewOnly: true,
      masterLawsuitId: effectiveMasterLawsuitId,
      settlementRecordId: settlementRecord?.id || settlementRecordId || null,
      folderPath,
      plannedDocuments,
      settlementSummary: settlementRecord
        ? {
            id: settlementRecord.id,
            status: settlementRecord.status,
            settledWith: settlementRecord.settledWith,
            settlementDate: settlementRecord.settlementDate,
            paymentExpectedDate: settlementRecord.paymentExpectedDate,
            provider,
            patient,
            insurer,
            claimNumber,
            rowCount: settlementRecord.rowCount || rows.length,
            grossSettlementAmount: money(settlementRecord.grossSettlementAmount),
            principal: money(settlementRecord.allocatedSettlementTotal),
            interest: money(settlementRecord.interestAmountTotal),
            attorneyFee: money(settlementRecord.totalFee),
            providerNet: money(settlementRecord.providerNetTotal),
            providerPrincipalNet: money(settlementRecord.providerPrincipalNetTotal),
            providerInterestNet: money(settlementRecord.providerInterestNetTotal),
          }
        : null,
      rows: rows.map((row) => ({
        id: row.id,
        matterId: row.matterId,
        displayNumber: row.displayNumber,
        provider: row.provider,
        patient: row.patient,
        insurer: row.insurer,
        claimNumber: row.claimNumber,
        billNumber: row.billNumber,
        dosStart: row.dosStart,
        dosEnd: row.dosEnd,
        denialReason: row.denialReason,
        claimAmount: money(row.claimAmount),
        principal: money(row.allocatedSettlement),
        interest: money(row.interestAmount),
        attorneyFee: money(row.totalFee),
        providerNet: money(row.providerNet),
      })),
      validation: {
        canGenerateSettlementDocuments: blockingErrors.length === 0,
        blockingErrors,
        warnings,
      },
      safety: safetySettlementDocumentsPreview(),
      note:
        "Preview-only local settlement document plan.  This route reads Barsh Matters LocalSettlementRecord and LocalSettlementRow only.  It does not read Clio settlement values, write Clio, generate documents, create files, create drafts, change the print queue, close matters, or send email.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "settlement-documents-preview",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        dryRun: true,
        previewOnly: true,
        error: error?.message || "Local settlement documents preview failed.",
        safety: safetySettlementDocumentsPreview(),
      },
      { status: 500 }
    );
  }
}
