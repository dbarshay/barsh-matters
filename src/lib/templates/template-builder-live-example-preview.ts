import { prisma } from "@/lib/prisma";

type Row = Record<string, unknown>;

export type TemplateBuilderExamplePreviewResult = {
  matter: string;
  resolved: Record<string, string>;
  exampleOutputMap: Record<string, string>;
  diagnostics: {
    matterKey: string;
    context: "child" | "lawsuit";
    providerTaxIdCandidateColumns: string[];
    providerTaxIdResolved: boolean;
    insurerHiddenResolved: Record<string, boolean>;
    lawsuitResolved: Record<string, boolean>;
    costResolved: Record<string, boolean>;
  };
};

const DASH = "—";
const clean = (value: unknown): string => value === null || value === undefined ? "" : String(value).trim();
const present = (value: unknown): boolean => clean(value).length > 0;
const norm = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const quoteIdent = (value: string): string => "\"" + value.replace(/"/g, "\"\"") + "\"";
const quoteLiteral = (value: string): string => "'" + value.replace(/'/g, "''") + "'";

const firstPresent = (...values: unknown[]): string => {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return "";
};

const columnValue = (row: Row | undefined, candidates: string[]): unknown => {
  if (!row) return undefined;
  const normalized = new Map(Object.keys(row).map((key) => [norm(key), key]));
  for (const candidate of candidates) {
    const actual = normalized.get(norm(candidate));
    if (actual && present(row[actual])) return row[actual];
  }
  return undefined;
};

const formatValue = (value: unknown): string => clean(value) || DASH;

const formatMoney = (value: unknown): string => {
  const text = clean(value);
  if (!text) return DASH;
  const numeric = Number(text.replace(/[$,]/g, ""));
  if (!Number.isFinite(numeric)) return text;
  return numeric.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

const formatDate = (value: unknown): string => {
  const text = clean(value);
  if (!text) return DASH;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-US", { timeZone: "UTC" });
};

async function rawRows(sql: string): Promise<Row[]> {
  return await prisma.$queryRawUnsafe<Row[]>(sql);
}

async function safeRawRows(sql: string): Promise<Row[]> {
  try {
    return await rawRows(sql);
  } catch {
    return [];
  }
}

async function tableNames(): Promise<string[]> {
  try {
    const rows = await rawRows("select table_name as name from information_schema.tables where table_schema = 'public' order by table_name");
    return rows.map((row) => clean(row.name)).filter(Boolean);
  } catch {
    const rows = await rawRows("select name from sqlite_master where type = 'table' order by name");
    return rows.map((row) => clean(row.name)).filter(Boolean);
  }
}

async function tableColumns(tableName: string): Promise<string[]> {
  try {
    const rows = await rawRows("select column_name as name from information_schema.columns where table_schema = 'public' and table_name = " + quoteLiteral(tableName) + " order by ordinal_position");
    return rows.map((row) => clean(row.name)).filter(Boolean);
  } catch {
    const rows = await rawRows("pragma table_info(" + quoteLiteral(tableName) + ")");
    return rows.map((row) => clean(row.name)).filter(Boolean);
  }
}

async function findRows(tableName: string, value: string, candidateColumns: string[], limit = 25): Promise<Row[]> {
  if (!value) return [];
  const columns = await tableColumns(tableName);
  const normalized = new Map(columns.map((column) => [norm(column), column]));
  const actualColumns = candidateColumns.map((column) => normalized.get(norm(column))).filter((column): column is string => Boolean(column));
  if (actualColumns.length === 0) return [];
  const where = actualColumns.map((column) => "CAST(" + quoteIdent(column) + " AS TEXT) = " + quoteLiteral(value)).join(" or ");
  return await safeRawRows("select * from " + quoteIdent(tableName) + " where " + where + " limit " + String(limit));
}

function scoreRow(row: Row, preferredColumns: string[]): number {
  return preferredColumns.reduce((score, column) => score + (present(columnValue(row, [column])) ? 1 : 0), 0);
}

const lawsuitKeyColumns = ["lawsuitId", "lawsuit_id", "lawsuitNumber", "lawsuit_number", "masterLawsuitId", "master_lawsuit_id", "master_lawsuit_number", "displayNumber", "display_number", "matterNumber", "matter_number", "fileNumber", "file_number", "brlFileNumber", "brl_file_number", "id"];
const childKeyColumns = ["matterKey", "matter_key", "matterNumber", "matter_number", "displayNumber", "display_number", "fileNumber", "file_number", "brlFileNumber", "brl_file_number", "clioMatterId", "clio_matter_id", "id"];

async function findBestRows(matterKey: string): Promise<{ claimRows: Row[]; lawsuitRows: Row[]; providerRows: Row[]; costRows: Row[]; providerTaxIdCandidateColumns: string[] }> {
  const tables = await tableNames();
  const claimTables = tables.filter((table) => /claimindex|claim|matter/i.test(table));
  const lawsuitTables = tables.filter((table) => /lawsuit|claimindex|matter/i.test(table));
  const providerTables = tables.filter((table) => /providerclientinfo|provider|client/i.test(table));
  const costTables = tables.filter((table) => /cost|fee/i.test(table));

  const claimRows: Row[] = [];
  for (const table of claimTables) claimRows.push(...await findRows(table, matterKey, [...childKeyColumns, ...lawsuitKeyColumns]));

  const lawsuitRows: Row[] = [];
  for (const table of lawsuitTables) lawsuitRows.push(...await findRows(table, matterKey, lawsuitKeyColumns));

  const providerName = firstPresent(columnValue(claimRows[0], ["providerName", "provider", "clientName", "provider_client_name", "Provider"]));
  const insurerName = firstPresent(columnValue(claimRows[0], ["insurerName", "insurer", "insuranceCompany", "insurance_company", "insurance"])) ;

  const providerRows: Row[] = [];
  for (const table of providerTables) providerRows.push(...await findRows(table, providerName || matterKey, ["name", "providerName", "clientName", "displayName", "Provider", "provider"]));

  const costRows: Row[] = [];
  for (const table of costTables) costRows.push(...await findRows(table, matterKey, [...lawsuitKeyColumns, ...childKeyColumns], 250));

  const providerTaxIdCandidateColumns: string[] = [];
  for (const table of providerTables) {
    const columns = await tableColumns(table);
    for (const column of columns) {
      const n = norm(column);
      if (n.includes("tax") || n.includes("tin") || n.includes("ein")) providerTaxIdCandidateColumns.push(table + "." + column);
    }
  }

  return { claimRows, lawsuitRows, providerRows, costRows, providerTaxIdCandidateColumns };
}

function numeric(value: unknown): number {
  const parsed = Number(clean(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function costAmount(row: Row): number {
  return numeric(columnValue(row, ["amount", "amountExpended", "amount_expended", "costAmount", "cost_amount", "feeAmount", "fee_amount", "value"]));
}

function costType(row: Row): string {
  return norm(firstPresent(columnValue(row, ["type", "entryType", "entry_type", "costType", "cost_type", "category", "label", "description", "name"])));
}

function sumCosts(costRows: Row[], include: string[]): number {
  return costRows.reduce((total, row) => {
    const type = costType(row);
    if (include.some((needle) => type.includes(norm(needle)))) return total + costAmount(row);
    return total;
  }, 0);
}

function rowMoney(row: Row | undefined, columns: string[]): string {
  return formatMoney(columnValue(row, columns));
}

function moneyOrDash(value: number): string {
  return value > 0 ? formatMoney(value) : DASH;
}

export async function resolveTemplateBuilderExamplePreview(matterKey: string): Promise<TemplateBuilderExamplePreviewResult> {
  const isLawsuitContext = /^\d{4}\.\d{2}\.\d{5}$/.test(matterKey);
  const { claimRows, lawsuitRows, providerRows, costRows, providerTaxIdCandidateColumns } = await findBestRows(matterKey);

  const childRow = isLawsuitContext ? undefined : claimRows.sort((a, b) => scoreRow(b, ["billedAmount", "claimAmount", "balance", "payments"]) - scoreRow(a, ["billedAmount", "claimAmount", "balance", "payments"]))[0];
  const lawsuitRow = lawsuitRows.sort((a, b) => scoreRow(b, ["indexNumber", "aaaNumber", "court", "adversaryAttorney", "dateFiled", "balance"]) - scoreRow(a, ["indexNumber", "aaaNumber", "court", "adversaryAttorney", "dateFiled", "balance"]))[0] || claimRows[0];
  const providerRow = providerRows[0];

  const providerTaxId = firstPresent(columnValue(providerRow, ["taxId", "tax_id", "tin", "ein", "federalTaxId", "federal_tax_id", "providerTaxId", "provider_tax_id"]));
  const insurerStreet = firstPresent(columnValue(lawsuitRow, ["insurerHiddenStreet", "insurer_hidden_street", "hiddenInsurerStreet", "hidden_insurer_street", "insurerStreet", "insurer_street", "insuranceStreet", "insurance_street", "hidden_street"]));
  const insurerCity = firstPresent(columnValue(lawsuitRow, ["insurerHiddenCity", "insurer_hidden_city", "hiddenInsurerCity", "hidden_insurer_city", "insurerCity", "insurer_city", "insuranceCity", "insurance_city", "hidden_city"]));
  const insurerState = firstPresent(columnValue(lawsuitRow, ["insurerHiddenState", "insurer_hidden_state", "hiddenInsurerState", "hidden_insurer_state", "insurerState", "insurer_state", "insuranceState", "insurance_state", "hidden_state"]));
  const insurerZip = firstPresent(columnValue(lawsuitRow, ["insurerHiddenZipcode", "insurer_hidden_zipcode", "insurerHiddenZip", "insurer_hidden_zip", "hiddenInsurerZipcode", "hidden_insurer_zipcode", "hiddenInsurerZip", "hidden_insurer_zip", "insurerZipcode", "insurer_zipcode", "insurerZip", "insurer_zip", "insuranceZip", "insurance_zip", "hidden_zipcode", "hidden_zip"]));

  const indexFee = sumCosts(costRows, ["index"]) || numeric(columnValue(lawsuitRow, ["indexFee", "index_fee"]));
  const serviceFee = sumCosts(costRows, ["service"]) || numeric(columnValue(lawsuitRow, ["serviceFee", "service_fee"]));
  const otherCosts = sumCosts(costRows, ["other", "court"]) || numeric(columnValue(lawsuitRow, ["otherCourtCosts", "other_court_costs", "otherCosts", "other_costs"]));
  const totalCosts = indexFee + serviceFee + otherCosts;
  const lawsuitBalance = firstPresent(columnValue(lawsuitRow, ["lawsuitBalance", "lawsuit_balance", "balance", "currentBalance", "current_balance", "remainingBalance", "remaining_balance"]));

  const resolved: Record<string, string> = {
    "{{matter.billedAmount}}": isLawsuitContext ? DASH : rowMoney(childRow, ["billedAmount", "billed_amount", "claimAmount", "claim_amount", "amount", "totalBilled", "total_billed"]),
    "{{provider.taxId}}": formatValue(providerTaxId),
    "{{insurer.hidden_street}}": formatValue(insurerStreet),
    "{{insurer.hidden_city}}": formatValue(insurerCity),
    "{{insurer.hidden_state}}": formatValue(insurerState),
    "{{insurer.hidden_zipcode}}": formatValue(insurerZip),
    "{{claim.balance}}": isLawsuitContext ? DASH : rowMoney(childRow, ["claimBalance", "claim_balance", "balance", "currentBalance", "current_balance", "remainingBalance", "remaining_balance"]),
    "{{claim.payments}}": isLawsuitContext ? DASH : rowMoney(childRow, ["paymentTotal", "payment_total", "paymentsTotal", "payments_total", "payments", "paidAmount", "paid_amount", "amountPaid", "amount_paid"]),
    "{{lawsuit.indexNumber}}": formatValue(firstPresent(columnValue(lawsuitRow, ["indexNumber", "index_number", "aaaNumber", "aaa_number", "indexOrAaaNumber", "index_or_aaa_number", "arbitrationIndexNumber", "arbitration_index_number"]))),
    "{{lawsuit.court}}": formatValue(firstPresent(columnValue(lawsuitRow, ["court", "courtName", "court_name", "selectedCourt", "selected_court", "venue"]))),
    "{{lawsuit.adversaryAttorney}}": formatValue(firstPresent(columnValue(lawsuitRow, ["adversaryAttorney", "adversary_attorney", "adversaryAttorneyName", "adversary_attorney_name", "defenseAttorney", "defense_attorney", "opposingAttorney", "opposing_attorney"]))),
    "{{lawsuit.dateFiled}}": formatDate(firstPresent(columnValue(lawsuitRow, ["dateFiled", "date_filed", "filedDate", "filed_date", "filingDate", "filing_date", "indexFiledDate", "index_filed_date"]))),
    "{{lawsuit.costs}}": moneyOrDash(totalCosts),
    "{{lawsuit.balance}}": formatMoney(lawsuitBalance),
    "{{cost.indexFee}}": moneyOrDash(indexFee),
    "{{cost.serviceFee}}": moneyOrDash(serviceFee),
    "{{cost.otherCourtCosts}}": moneyOrDash(otherCosts),
    "{{cost.total}}": moneyOrDash(totalCosts),
  };

  return {
    matter: matterKey,
    resolved,
    exampleOutputMap: resolved,
    diagnostics: {
      matterKey,
      context: isLawsuitContext ? "lawsuit" : "child",
      providerTaxIdCandidateColumns,
      providerTaxIdResolved: Boolean(providerTaxId),
      insurerHiddenResolved: { street: Boolean(insurerStreet), city: Boolean(insurerCity), state: Boolean(insurerState), zipcode: Boolean(insurerZip) },
      lawsuitResolved: {
        indexNumber: resolved["{{lawsuit.indexNumber}}"] !== DASH,
        court: resolved["{{lawsuit.court}}"] !== DASH,
        adversaryAttorney: resolved["{{lawsuit.adversaryAttorney}}"] !== DASH,
        dateFiled: resolved["{{lawsuit.dateFiled}}"] !== DASH,
        balance: resolved["{{lawsuit.balance}}"] !== DASH,
      },
      costResolved: {
        indexFee: resolved["{{cost.indexFee}}"] !== DASH,
        serviceFee: resolved["{{cost.serviceFee}}"] !== DASH,
        otherCourtCosts: resolved["{{cost.otherCourtCosts}}"] !== DASH,
        total: resolved["{{cost.total}}"] !== DASH,
      },
    },
  };
}
