import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function clean(value: unknown): string {
  return String(value || "").trim();
}

function detailText(details: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = clean(details[key]);
    if (value) return value;
  }
  return "";
}


function upper(value: unknown): string {
  return clean(value).toUpperCase();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown): number {
  return Math.round(num(value) * 100) / 100;
}

function moneyOption(value: unknown): number {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
  }
  return money(value);
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function isMasterRow(row: any): boolean {
  return upper(row.description).startsWith("MASTER LAWSUIT");
}

function isMultiplePlaceholder(value: unknown): boolean {
  const v = upper(value);
  return !v || v === "MULTIPLE" || v === "MULTIPLE PATIENT" || v === "MULTIPLE PATIENTS" || v === "MULTIPLE PROVIDERS";
}

function deriveField(masterValue: unknown, childValues: unknown[], label: string, warnings: string[]) {
  const master = clean(masterValue);
  const childUnique = uniqueStrings(childValues);

  if (childUnique.length > 1) {
    warnings.push(`${label}: multiple child values detected.`);
  }

  if (master && !isMultiplePlaceholder(master)) {
    if (childUnique.length > 0 && !childUnique.includes(master)) {
      warnings.push(`${label}: master value differs from child value(s).`);
    }

    return {
      value: master,
      source: "master",
      values: childUnique,
    };
  }

  if (childUnique.length === 0) {
    warnings.push(`${label}: missing on master and children.`);
    return {
      value: "",
      source: "missing",
      values: [],
    };
  }

  if (childUnique.length === 1) {
    return {
      value: childUnique[0],
      source: "children",
      values: childUnique,
    };
  }

  return {
    value: `MULTIPLE ${label.toUpperCase()}`,
    source: "children-multiple",
    values: childUnique,
  };
}


function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function compactObject(value: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => {
      if (v === null || v === undefined) return false;
      if (typeof v === "string" && !v.trim()) return false;
      if (Array.isArray(v) && v.length === 0) return false;
      if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return false;
      return true;
    })
  );
}

function referenceSummary(entity: any | null) {
  if (!entity) return null;
  const details = asRecord(entity.details);
  const hidden = asRecord(details._hiddenImportFields);

  return {
    id: entity.id,
    type: entity.type,
    displayName: entity.displayName,
    normalizedName: entity.normalizedName,
    notes: entity.notes || "",
    source: entity.source || "",
    details,
    hiddenDetails: hidden,
  };
}

function findReferenceEntity(entities: any[], type: string, value: unknown) {
  const wanted = clean(value).toLowerCase();
  if (!wanted) return null;

  return (
    entities.find((entity) => {
      const displayName = clean(entity.displayName).toLowerCase();
      const normalizedName = clean(entity.normalizedName).toLowerCase();
      return entity.type === type && (displayName === wanted || normalizedName === wanted);
    }) || null
  );
}

async function loadDocumentReferenceData(args: {
  providerName: string;
  patientName: string;
  insurerName: string;
  courtName: string;
  treatingProviderNames: string[];
}) {
  const lookupValues = uniqueStrings([
    args.providerName,
    args.patientName,
    args.insurerName,
    args.courtName,
    ...args.treatingProviderNames,
  ]);

  if (lookupValues.length === 0) {
    return {
      provider: null,
      patient: null,
      insurer: null,
      court: null,
      treatingProviders: [],
      lookupValues,
    };
  }

  const entities = await prisma.referenceEntity.findMany({
    where: {
      active: true,
      type: {
        in: ["provider_client", "patient", "insurer_company", "court_venue", "treating_provider"],
      },
      displayName: {
        in: lookupValues,
      },
    },
    select: {
      id: true,
      type: true,
      displayName: true,
      normalizedName: true,
      notes: true,
      details: true,
      source: true,
    },
  });

  const treatingProviders = uniqueStrings(args.treatingProviderNames)
    .map((name) => referenceSummary(findReferenceEntity(entities, "treating_provider", name)))
    .filter(Boolean);

  return {
    provider: referenceSummary(findReferenceEntity(entities, "provider_client", args.providerName)),
    patient: referenceSummary(findReferenceEntity(entities, "patient", args.patientName)),
    insurer: referenceSummary(findReferenceEntity(entities, "insurer_company", args.insurerName)),
    court: referenceSummary(findReferenceEntity(entities, "court_venue", args.courtName)),
    treatingProviders,
    lookupValues,
  };
}


export async function GET(req: NextRequest) {
  const masterLawsuitId = clean(req.nextUrl.searchParams.get("masterLawsuitId"));

  if (!masterLawsuitId) {
    return NextResponse.json(
      { ok: false, error: "Missing masterLawsuitId" },
      { status: 400 }
    );
  }

  const lawsuit = await prisma.lawsuit.findUnique({
    where: { masterLawsuitId },
    select: {
      id: true,
      masterLawsuitId: true,
      claimNumber: true,
      lawsuitMatters: true,
      sharedFolderPath: true,
      venue: true,
      venueSelection: true,
      venueOther: true,
      indexAaaNumber: true,
      lawsuitNotes: true,
      lawsuitOptions: true,
      amountSoughtMode: true,
      amountSought: true,
      customAmountSought: true,
      amountSoughtBreakdown: true,
      clioMasterMatterId: true,
      clioMasterDisplayNumber: true,
      clioMasterMatterDescription: true,
      clioMasterMappedAt: true,
      clioMasterMappingSource: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const rawRows = await prisma.claimIndex.findMany({
    where: { master_lawsuit_id: masterLawsuitId },
    orderBy: [
      { display_number: "asc" },
      { matter_id: "asc" },
    ],
  });

  const rows = rawRows
    .map((row: any) => ({
      ...row,
      isMaster: isMasterRow(row),
      is_master: isMasterRow(row),
    }))
    .sort((a: any, b: any) => {
      if (a.isMaster && !b.isMaster) return -1;
      if (!a.isMaster && b.isMaster) return 1;
      return clean(a.display_number).localeCompare(clean(b.display_number));
    });

  const masterRows = rows.filter((row: any) => row.isMaster);
  const childRows = rows.filter((row: any) => !row.isMaster);

  const warnings: string[] = [];
  const blockingErrors: string[] = [];
  const hasMappedClioMasterMatter =
    Boolean(lawsuit?.clioMasterMatterId) || Boolean(clean(lawsuit?.clioMasterDisplayNumber));

  if (rows.length === 0) blockingErrors.push("No ClaimIndex rows found for MASTER_LAWSUIT_ID.");
  if (masterRows.length === 0 && !hasMappedClioMasterMatter) {
    blockingErrors.push("No master matter found for MASTER_LAWSUIT_ID.");
  }
  if (masterRows.length > 1) blockingErrors.push("Multiple master matters found for MASTER_LAWSUIT_ID.");
  if (childRows.length === 0) blockingErrors.push("No child bill matters found for MASTER_LAWSUIT_ID.");

  const master = masterRows[0] || null;

  const provider = deriveField(
    master?.client_name || master?.provider_name,
    childRows.map((row: any) => row.client_name || row.provider_name),
    "provider",
    warnings
  );

  const patient = deriveField(
    master?.patient_name,
    childRows.map((row: any) => row.patient_name),
    "patient",
    warnings
  );

  const insurer = deriveField(
    master?.insurer_name,
    childRows.map((row: any) => row.insurer_name),
    "insurer",
    warnings
  );

  const claimNumber = deriveField(
    master?.claim_number_raw || master?.claim_number_normalized,
    childRows.map((row: any) => row.claim_number_raw || row.claim_number_normalized),
    "claim number",
    warnings
  );

  const indexAaaNumber = deriveField(
    lawsuit?.indexAaaNumber || master?.index_aaa_number,
    childRows.map((row: any) => row.index_aaa_number),
    "index/AAA number",
    warnings
  );

  const lawsuitOptions = asRecord(lawsuit?.lawsuitOptions);
  const selectedCourtDetails = lawsuitOptions.selectedCourtDetails || null;
  const dateOfLoss = clean(lawsuitOptions.dateOfLoss);
  const dateFiled = clean(lawsuitOptions.dateFiled);
  const indexFee = moneyOption(lawsuitOptions.indexFee ?? lawsuitOptions.filingFee);
  const serviceFee = moneyOption(lawsuitOptions.serviceFee);
  const otherCourtFees = moneyOption(lawsuitOptions.otherCourtFees ?? lawsuitOptions.otherCourtCosts);
  const courtCostsTotal =
    moneyOption(lawsuitOptions.courtCostsTotal) || money(indexFee + serviceFee + otherCourtFees);
  const treatingProviderNames = uniqueStrings(childRows.map((row: any) => row.treating_provider));

  const referenceData = await loadDocumentReferenceData({
    providerName: provider.value,
    patientName: patient.value,
    insurerName: insurer.value,
    courtName: lawsuit?.venue || "",
    treatingProviderNames,
  });

  const courtReferenceDetails =
    selectedCourtDetails ||
    referenceData.court?.details ||
    null;

  const lawsuitAny = lawsuit as any;
  const adversaryAttorneyDetails =
    lawsuitAny?.selectedAdversaryAttorneyDetails &&
    typeof lawsuitAny.selectedAdversaryAttorneyDetails === "object" &&
    !Array.isArray(lawsuitAny.selectedAdversaryAttorneyDetails)
      ? (lawsuitAny.selectedAdversaryAttorneyDetails as Record<string, any>)
      : {};
  const adversaryAttorneyName =
    clean(lawsuitAny?.adversaryAttorney) ||
    detailText(adversaryAttorneyDetails, [
      "displayName",
      "display_name",
      "displayFirmName",
      "display_firm_name",
      "firmName",
      "firm_name",
      "name",
    ]);
  const adversaryAttorneyFirmName =
    detailText(adversaryAttorneyDetails, [
      "firmName",
      "firm_name",
      "displayFirmName",
      "display_firm_name",
      "displayName",
      "display_name",
      "name",
    ]) || adversaryAttorneyName;

  const templateFields = compactObject({
    adversaryAttorney: adversaryAttorneyName,
    adversaryAttorneyName,
    adversaryAttorneyFirmName,
    masterLawsuitId,
    providerName: provider.value,
    patientName: patient.value,
    insurerName: insurer.value,
    claimNumber: claimNumber.value,
    courtName: lawsuit?.venue || "",
    courtSelection: lawsuit?.venueSelection || "",
    courtOther: lawsuit?.venueOther || "",
    courtDetails: courtReferenceDetails,
    indexAaaNumber: indexAaaNumber.value,
    dateOfLoss,
    dateFiled,
    indexFee,
    serviceFee,
    otherCourtFees,
    courtCostsTotal,
    treatingProviderNames,
  });

  const documentData = {
    readyForTemplates: true,
    generatesDocuments: false,
    localOnly: true,
    clioCorrectnessDependency: false,
    sources: {
      lawsuitUiFields: !!lawsuit,
      claimIndex: rows.length > 0,
      referenceData: true,
      clio: false,
    },
    uiFields: {
      adversaryAttorney: adversaryAttorneyName,
      adversaryAttorneyName,
      adversaryAttorneyFirmName,
      uiAdversaryAttorneyName: adversaryAttorneyName,
      courtName: lawsuit?.venue || "",
      courtSelection: lawsuit?.venueSelection || "",
      courtOther: lawsuit?.venueOther || "",
      selectedCourtDetails,
      indexAaaNumber: indexAaaNumber.value,
      dateOfLoss,
      dateFiled,
      indexFee,
      serviceFee,
      otherCourtFees,
      courtCostsTotal,
    },
    claimIndexFields: {
      providerName: provider.value,
      patientName: patient.value,
      insurerName: insurer.value,
      claimNumber: claimNumber.value,
      treatingProviderNames,
    },
    referenceData: {
      ...referenceData,
      adversaryAttorney: {
        name: adversaryAttorneyName,
        firmName: adversaryAttorneyFirmName,
        details: adversaryAttorneyDetails,
      },
      adversaryAttorneyDetails,
    },
    templateFields,
  };

  if (!lawsuit) {
    warnings.push("No local Lawsuit row found for MASTER_LAWSUIT_ID; packet is using ClaimIndex-derived metadata only.");
  }

  const amountSought = lawsuit
    ? {
        mode: lawsuit.amountSoughtMode,
        amount: money(lawsuit.amountSought),
        customAmount: lawsuit.customAmountSought === null ? null : money(lawsuit.customAmountSought),
        breakdown: lawsuit.amountSoughtBreakdown,
      }
    : {
        mode: "balance_presuit",
        amount: null,
        customAmount: null,
        breakdown: null,
      };

  const childMatters = childRows.map((row: any) => ({
    matterId: row.matter_id,
    displayNumber: row.display_number,
    description: row.description,
    providerName: row.client_name || row.provider_name || "",
    patientName: row.patient_name || "",
    insurerName: row.insurer_name || "",
    claimNumber: row.claim_number_raw || row.claim_number_normalized || "",
    billNumber: row.bill_number || "",
    claimAmount: money(row.claim_amount),
    settledAmount: money(row.settled_amount),
    settledWith: row.settled_with || null,
    allocatedSettlement: money(row.allocated_settlement),
    interestAmount: money(row.interest_amount),
    principalFee: money(row.principal_fee),
    interestFee: money(row.interest_fee),
    totalFee: money(row.total_fee),
    providerNet: money(row.provider_net),
    providerPrincipalNet: money(row.provider_principal_net),
    providerInterestNet: money(row.provider_interest_net),
    overdueDays: row.overdue_days === null || row.overdue_days === undefined ? null : num(row.overdue_days),
    paymentVoluntary: money(row.payment_voluntary),
    balancePresuit: money(row.balance_presuit),
    balanceAmount: money(row.balance_amount),
    dosStart: row.dos_start || "",
    dosEnd: row.dos_end || "",
    denialReason: row.denial_reason || "",
    indexAaaNumber: row.index_aaa_number || "",
    status: row.status || "",
  }));

  const totals = {
    billCount: childMatters.length,
    claimAmountTotal: money(childMatters.reduce((sum, row) => sum + num(row.claimAmount), 0)),
    settledAmountTotal: money(childMatters.reduce((sum, row) => sum + num(row.settledAmount), 0)),
    allocatedSettlementTotal: money(childMatters.reduce((sum, row) => sum + num(row.allocatedSettlement), 0)),
    interestAmountTotal: money(childMatters.reduce((sum, row) => sum + num(row.interestAmount), 0)),
    principalFeeTotal: money(childMatters.reduce((sum, row) => sum + num(row.principalFee), 0)),
    interestFeeTotal: money(childMatters.reduce((sum, row) => sum + num(row.interestFee), 0)),
    totalFeeTotal: money(childMatters.reduce((sum, row) => sum + num(row.totalFee), 0)),
    providerNetTotal: money(childMatters.reduce((sum, row) => sum + num(row.providerNet), 0)),
    providerPrincipalNetTotal: money(childMatters.reduce((sum, row) => sum + num(row.providerPrincipalNet), 0)),
    providerInterestNetTotal: money(childMatters.reduce((sum, row) => sum + num(row.providerInterestNet), 0)),
    paymentVoluntaryTotal: money(childMatters.reduce((sum, row) => sum + num(row.paymentVoluntary), 0)),
    balancePresuitTotal: money(childMatters.reduce((sum, row) => sum + num(row.balancePresuit), 0)),
    balanceAmountTotal: money(childMatters.reduce((sum, row) => sum + num(row.balanceAmount), 0)),
  };

  const packet = {
    masterLawsuitId,
    generatedAt: new Date().toISOString(),

    metadata: {
      provider,
      patient,
      insurer,
      claimNumber,
      indexAaaNumber,
      venue: {
        value: lawsuit?.venue || "",
        selection: lawsuit?.venueSelection || "",
        other: lawsuit?.venueOther || "",
        source: lawsuit?.venue ? "lawsuit" : "missing",
      },
      lawsuitNotes: lawsuit?.lawsuitNotes || "",
      lawsuitOptions,
      documentData,
      amountSought,
      caption: {
        providerName: provider.value,
        patientName: patient.value,
        insurerName: insurer.value,
        claimNumber: claimNumber.value,
      },
    },

    lawsuit: lawsuit
      ? {
          id: lawsuit.id,
          masterLawsuitId: lawsuit.masterLawsuitId,
          claimNumber: lawsuit.claimNumber,
          lawsuitMatters: lawsuit.lawsuitMatters,
          sharedFolderPath: lawsuit.sharedFolderPath,
          venue: lawsuit.venue,
          venueSelection: lawsuit.venueSelection,
          venueOther: lawsuit.venueOther,
          indexAaaNumber: lawsuit.indexAaaNumber,
          lawsuitNotes: lawsuit.lawsuitNotes,
          lawsuitOptions: lawsuit.lawsuitOptions,
          amountSoughtMode: lawsuit.amountSoughtMode,
          amountSought: lawsuit.amountSought,
          customAmountSought: lawsuit.customAmountSought,
          amountSoughtBreakdown: lawsuit.amountSoughtBreakdown,
          clioMasterMatterId: lawsuit.clioMasterMatterId,
          clioMasterDisplayNumber: lawsuit.clioMasterDisplayNumber,
          clioMasterMatterDescription: lawsuit.clioMasterMatterDescription,
          clioMasterMappedAt: lawsuit.clioMasterMappedAt,
          clioMasterMappingSource: lawsuit.clioMasterMappingSource,
          createdAt: lawsuit.createdAt,
          updatedAt: lawsuit.updatedAt,
        }
      : null,

    masterMatter: lawsuit?.clioMasterMatterId
      ? {
          ...(master || {}),
          matterId: lawsuit.clioMasterMatterId,
          id: lawsuit.clioMasterMatterId,
          displayNumber: lawsuit.clioMasterDisplayNumber || master?.display_number || masterLawsuitId,
          display_number: lawsuit.clioMasterDisplayNumber || master?.display_number || masterLawsuitId,
          description: lawsuit.clioMasterMatterDescription || master?.description || "",
          localMasterLawsuitId: masterLawsuitId,
          mappingSource: lawsuit.clioMasterMappingSource || "lawsuit.clio-master-mapping",
          mappedAt: lawsuit.clioMasterMappedAt || null,
          source: "lawsuit.clio-master-mapping",
        }
      : master
      ? {
          matterId: master.matter_id,
          displayNumber: master.display_number,
          description: master.description,
          providerName: master.client_name || master.provider_name || "",
          patientName: master.patient_name || "",
          insurerName: master.insurer_name || "",
          claimNumber: master.claim_number_raw || master.claim_number_normalized || "",
          indexAaaNumber: master.index_aaa_number || "",
          status: master.status || "",
        }
      : null,

    childMatters,
    totals,

    validation: {
      warnings,
      blockingErrors,
      canGenerate: blockingErrors.length === 0,
      hasClaimIndexMasterMatter: masterRows.length > 0,
      hasMappedClioMasterMatter,
    },

    refresh: {
      skipped: true,
      reason: "local-document-packet-no-clio-refresh",
      clioCorrectnessDependency: false,
      seedCount: 0,
      refreshedMatterCount: 0,
      refreshedMatterIds: [],
      errorCount: 0,
      errors: [],
    },
  };

  return NextResponse.json({
    ok: blockingErrors.length === 0,
    packet,
  });
}
