import { prisma } from "@/lib/prisma";

type Row = Record<string, unknown>;

export type TemplateBuilderExamplePreviewDiagnostics = {
  requestedMatter: string;
  context: "lawsuit" | "direct" | "unknown";
  usedPreviewFallback: false;
  liveRowCounts: {
    claimRows: number;
    lawsuitRows: number;
    providerRows: number;
    costRows: number;
  };
  providerTaxIdResolved: boolean;
  insurerAddressResolved: boolean;
  lawsuitResolved: boolean;
  costResolved: boolean;
};

export type TemplateBuilderExamplePreviewResult = {
  matter: string;
  requestedMatter: string;
  exampleOutputMatter: string;
  exampleOutputMap: Record<string, string>;
  diagnostics: TemplateBuilderExamplePreviewDiagnostics;
};

const DASH = "—";

const clean = (value: unknown): string => String(value ?? "").trim();

const normalizeKey = (value: unknown): string =>
  clean(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

const quoteIdent = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const quoteLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

async function safeRawRows(sql: string): Promise<Row[]> {
  try {
    return await prisma.$queryRawUnsafe<Row[]>(sql);
  } catch {
    return [];
  }
}

function rowValue(row: Row | undefined | null, keys: string[]): unknown {
  if (!row) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      if (value !== null && value !== undefined && clean(value) !== "") return value;
    }
  }
  return undefined;
}

function firstPresent(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== null && value !== undefined && clean(value) !== "") return value;
  }
  return undefined;
}

function formatValue(value: unknown): string {
  const text = clean(value);
  return text || DASH;
}

function parseJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function hiddenFields(details: unknown): Record<string, unknown> {
  const parsed = parseJson(details);
  const hidden = parsed._hiddenImportFields;
  return hidden && typeof hidden === "object" && !Array.isArray(hidden) ? hidden as Record<string, unknown> : {};
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = clean(value).replace(/[$,]/g, "");
  if (!text || text === DASH) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: unknown): string {
  const parsed = numberValue(value);
  if (parsed === null) return DASH;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parsed);
}

function dateDisplay(value: unknown): string {
  const text = clean(value);
  if (!text) return DASH;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return text;
}

function uniqueNonEmpty(rows: Row[], keys: string[]): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = clean(rowValue(row, keys));
    if (value) values.add(value);
  }
  return [...values];
}

function commonValue(rows: Row[], keys: string[]): string {
  const values = uniqueNonEmpty(rows, keys);
  return values.length === 1 ? values[0] : "";
}

function displayNameFromSource(value: unknown): string {
  return formatValue(value);
}

function directMatterNumber(matterKey: string): number | null {
  const match = matterKey.match(/^BRL_(\d{4})(\d{5})$/);
  if (!match) return null;
  return Number(match[2]);
}

async function findLawsuit(matterKey: string): Promise<Row | undefined> {
  const rows = await safeRawRows(
    `select * from "Lawsuit" where "masterLawsuitId" = ${quoteLiteral(matterKey)} limit 1`
  );
  return rows[0];
}

async function findClaimRowsForLawsuit(matterKey: string): Promise<Row[]> {
  return await safeRawRows(
    `select * from "ClaimIndex" where "master_lawsuit_id" = ${quoteLiteral(matterKey)} order by "matter_id" asc limit 100`
  );
}

async function findClaimRowForDirect(matterKey: string): Promise<Row | undefined> {
  const sequence = directMatterNumber(matterKey);
  const clauses = [
    `"display_number" = ${quoteLiteral(matterKey)}`,
    `CAST("matter_id" AS TEXT) = ${quoteLiteral(matterKey)}`
  ];
  if (sequence !== null) clauses.push(`"matter_id" = ${900000000 + sequence}`);
  const rows = await safeRawRows(
    `select * from "ClaimIndex" where ${clauses.join(" or ")} order by "matter_id" asc limit 1`
  );
  return rows[0];
}

async function allProviderRows(): Promise<Row[]> {
  return await safeRawRows(
    `select pci.*, re."displayName" as "referenceDisplayName", re."normalizedName" as "referenceNormalizedName", re."details" as "referenceDetails"
     from "ProviderClientInfo" pci
     left join "ReferenceEntity" re on re."id" = pci."referenceEntityId"
     limit 500`
  );
}

async function allReferenceRows(): Promise<Row[]> {
  return await safeRawRows(
    `select * from "ReferenceEntity" limit 5000`
  );
}

function bestProviderRow(providerName: string, rows: Row[]): Row | undefined {
  const target = normalizeKey(providerName);
  if (!target) return undefined;

  const exact = rows.find((row) =>
    normalizeKey(rowValue(row, ["displayNameSnapshot", "referenceDisplayName", "displayName"])) === target ||
    normalizeKey(rowValue(row, ["referenceNormalizedName", "normalizedName"])) === target
  );
  if (exact) return exact;

  return rows.find((row) => {
    const candidate = normalizeKey(rowValue(row, ["displayNameSnapshot", "referenceDisplayName", "displayName"]));
    return candidate.includes(target) || target.includes(candidate);
  });
}

function bestReferenceRow(name: string, rows: Row[]): Row | undefined {
  const target = normalizeKey(name);
  if (!target) return undefined;

  const exact = rows.find((row) =>
    normalizeKey(rowValue(row, ["displayName"])) === target ||
    normalizeKey(rowValue(row, ["normalizedName"])) === target
  );
  if (exact) return exact;

  return rows.find((row) => {
    const candidate = normalizeKey(rowValue(row, ["displayName", "normalizedName"]));
    return candidate.includes(target) || target.includes(candidate);
  });
}

function taxIdFromRow(row: Row | undefined): string {
  if (!row) return DASH;

  const direct = firstPresent(
    rowValue(row, ["taxId", "tax_id", "tin", "ein", "federalTaxId", "federal_tax_id"]),
  );
  if (direct) return formatValue(direct);

  for (const detailsKey of ["details", "referenceDetails"]) {
    const hidden = hiddenFields(row[detailsKey]);
    for (const [key, value] of Object.entries(hidden)) {
      const normalized = normalizeKey(key);
      if (
        normalized.includes("tax") ||
        normalized.includes("tin") ||
        normalized.includes("ein") ||
        normalized.includes("federal")
      ) {
        return formatValue(value);
      }
    }
  }

  return DASH;
}

function hiddenValue(row: Row | undefined, key: string): string {
  if (!row) return DASH;
  const hidden = hiddenFields(row.details);
  return formatValue(hidden[key]);
}

function optionValue(options: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      const value = options[key];
      if (clean(value)) return value;
    }
  }
  return undefined;
}

function costNumber(options: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = numberValue(optionValue(options, [key]));
    if (parsed !== null) return parsed;
  }
  return null;
}

export async function resolveTemplateBuilderExamplePreview(matterKey: string): Promise<TemplateBuilderExamplePreviewResult> {
  const requestedMatter = clean(matterKey) || "2026.06.00011";

  const lawsuitRow = await findLawsuit(requestedMatter);
  const isLawsuitContext = Boolean(lawsuitRow);

  const claimRows = isLawsuitContext
    ? await findClaimRowsForLawsuit(requestedMatter)
    : [
        await findClaimRowForDirect(requestedMatter)
      ].filter(Boolean) as Row[];

  const claimRow = claimRows[0];
  const options = parseJson(rowValue(lawsuitRow, ["lawsuitOptions"]));

  const providerSourceName = commonValue(claimRows, ["provider_name", "client_name"]) || clean(rowValue(claimRow, ["provider_name", "client_name"]));
  const insurerSourceName = commonValue(claimRows, ["insurer_name"]) || clean(rowValue(claimRow, ["insurer_name"]));

  const providerRows = await allProviderRows();
  const providerRow = bestProviderRow(providerSourceName, providerRows);

  const referenceRows = await allReferenceRows();
  const insurerRow = bestReferenceRow(insurerSourceName, referenceRows);
  const adversarySourceName = isLawsuitContext
    ? clean(optionValue(options, ["adversaryAttorney", "adversaryAttorneyName"]))
    : "";
  const adversaryRow = bestReferenceRow(adversarySourceName, referenceRows);

  const filingFee = costNumber(options, ["filingFeeEntryAmount", "filingFee", "indexFee", "indexFeeEntryAmount"]);
  const serviceFee = costNumber(options, ["serviceFeeEntryAmount", "serviceFee"]);
  const otherCourtCosts = costNumber(options, ["otherCourtCostsEntryAmount", "otherCourtCosts"]);
  const costParts = [filingFee, serviceFee, otherCourtCosts].filter((value): value is number => value !== null);
  const costTotal = costParts.length ? costParts.reduce((sum, value) => sum + value, 0) : null;

  const lawsuitAmount = rowValue(lawsuitRow, ["amountSought", "customAmountSought"]);
  const lawsuitBalance = numberValue(lawsuitAmount);

  const map: Record<string, string> = {
    "{{matter.fileNumber}}": isLawsuitContext
      ? formatValue(rowValue(lawsuitRow, ["masterLawsuitId"]) || requestedMatter)
      : formatValue(rowValue(claimRow, ["display_number"]) || requestedMatter),
    "{{matter.providerName}}": displayNameFromSource(firstPresent(
      rowValue(providerRow, ["displayNameSnapshot", "referenceDisplayName", "displayName"]),
      providerSourceName
    )),
    "{{matter.patientName}}": formatValue(commonValue(claimRows, ["patient_name"]) || rowValue(claimRow, ["patient_name"])),
    "{{matter.billedAmount}}": isLawsuitContext ? DASH : money(rowValue(claimRow, ["claim_amount", "balance_presuit"])),

    "{{provider.taxId}}": taxIdFromRow(providerRow),

    "{{insurer.name}}": formatValue(insurerSourceName),
    "{{insurer.street}}": hiddenValue(insurerRow, "hidden_street"),
    "{{insurer.city}}": hiddenValue(insurerRow, "hidden_city"),
    "{{insurer.state}}": hiddenValue(insurerRow, "hidden_state"),
    "{{insurer.zipcode}}": hiddenValue(insurerRow, "hidden_zipcode"),

    "{{claim.number}}": isLawsuitContext
      ? formatValue(rowValue(lawsuitRow, ["claimNumber"]) || commonValue(claimRows, ["claim_number_raw", "claim_number_normalized"]))
      : formatValue(rowValue(claimRow, ["claim_number_raw", "claim_number_normalized"])),
    "{{claim.dateOfLoss}}": dateDisplay(isLawsuitContext ? commonValue(claimRows, ["date_of_loss"]) : rowValue(claimRow, ["date_of_loss"])),
    "{{claim.dateOfService}}": isLawsuitContext ? DASH : dateDisplay(rowValue(claimRow, ["dos_start", "dos_end"])),
    "{{claim.denialReason}}": isLawsuitContext ? formatValue(commonValue(claimRows, ["denial_reason"])) : formatValue(rowValue(claimRow, ["denial_reason"])),
    "{{claim.balance}}": isLawsuitContext ? DASH : money(rowValue(claimRow, ["balance_amount", "balance_presuit"])),
    "{{claim.payments}}": isLawsuitContext ? DASH : money(rowValue(claimRow, ["payment_amount", "payment_voluntary"])),

    "{{lawsuit.indexNumber}}": isLawsuitContext ? formatValue(rowValue(lawsuitRow, ["indexAaaNumber"]) || optionValue(options, ["indexAaaNumber"])) : DASH,
    "{{lawsuit.court}}": isLawsuitContext ? formatValue(optionValue(options, ["venueSelection", "venue"])) : DASH,
    "{{lawsuit.adversaryAttorney}}": isLawsuitContext ? formatValue(optionValue(options, ["adversaryAttorney"])) : DASH,
    "{{adversaryAttorney.street}}": isLawsuitContext ? hiddenValue(adversaryRow, "hidden_street") : DASH,
    "{{adversaryAttorney.city}}": isLawsuitContext ? hiddenValue(adversaryRow, "hidden_city") : DASH,
    "{{adversaryAttorney.state}}": isLawsuitContext ? hiddenValue(adversaryRow, "hidden_state") : DASH,
    "{{adversaryAttorney.zipcode}}": isLawsuitContext ? hiddenValue(adversaryRow, "hidden_zipcode") : DASH,
    "{{lawsuit.dateFiled}}": isLawsuitContext ? dateDisplay(optionValue(options, ["dateFiled"])) : DASH,
    "{{lawsuit.amount}}": isLawsuitContext ? money(lawsuitAmount) : DASH,
    "{{lawsuit.costs}}": isLawsuitContext ? money(costTotal) : DASH,
    "{{lawsuit.balance}}": isLawsuitContext && lawsuitBalance !== null ? money(lawsuitBalance + (costTotal ?? 0)) : DASH,

    "{{cost.indexFee}}": isLawsuitContext ? money(filingFee) : DASH,
    "{{cost.serviceFee}}": isLawsuitContext ? money(serviceFee) : DASH,
    "{{cost.otherCourtCosts}}": isLawsuitContext ? money(otherCourtCosts) : DASH,
    "{{cost.total}}": isLawsuitContext ? money(costTotal) : DASH,
  };

  return {
    matter: requestedMatter,
    requestedMatter,
    exampleOutputMatter: requestedMatter,
    exampleOutputMap: map,
    diagnostics: {
      requestedMatter,
      context: isLawsuitContext ? "lawsuit" : claimRow ? "direct" : "unknown",
      usedPreviewFallback: false,
      liveRowCounts: {
        claimRows: claimRows.length,
        lawsuitRows: lawsuitRow ? 1 : 0,
        providerRows: providerRow ? 1 : 0,
        costRows: costParts.length,
      },
      providerTaxIdResolved: map["{{provider.taxId}}"] !== DASH,
      insurerAddressResolved: [
        map["{{insurer.street}}"],
        map["{{insurer.city}}"],
        map["{{insurer.state}}"],
        map["{{insurer.zipcode}}"],
      ].some((value) => value !== DASH),
      lawsuitResolved: Boolean(lawsuitRow),
      costResolved: costParts.length > 0,
    },
  };
}
