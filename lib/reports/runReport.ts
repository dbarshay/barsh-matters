/* eslint-disable @typescript-eslint/no-explicit-any -- Report rows are dynamic (field-key -> value) by design. */
import { prisma } from "@/lib/prisma";
import { fieldMap, REPORT_FIELDS, type ReportField } from "./reportCatalog";
import { normalizeProviderName } from "@/lib/providerNameCase";
import { buildBarshMatterDisplayNumberScopeWhere } from "@/lib/claimIndexQuery";

export type ReportFilter = { field: string; op: string; value?: any; value2?: any };
export type ReportAggregation = { field: string; fn: "sum" | "avg" | "count" | "distinct" | "min" | "max" };
export type ReportSort = { field: string; dir: "asc" | "desc" };
export type ReportConfig = {
  columns: string[];
  filters?: ReportFilter[];
  filterLogic?: "AND" | "OR";
  groupBy?: string[];
  aggregations?: ReportAggregation[];
  sort?: ReportSort[];
  mode?: "detail" | "summary";
  // Top-line quick filters (default "all" / empty = no restriction):
  openClosed?: "all" | "open" | "closed";
  provider?: string; // normalized provider name, or "all"/""
  insurer?: string;  // normalized insurer name, or "all"/""
  caseType?: string; // "all" | "nf" | "wc" | "lien"
  lawsuitBill?: string; // "all" | "lawsuit" | "bill"
};

export const REPORT_ROW_CAP = 50000;

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: any): string {
  return v === null || v === undefined ? "" : String(v);
}
function formatDate(v: any): string {
  const s = str(v);
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : s;
}
function displayValue(field: ReportField | undefined, v: any): any {
  if (field?.format === "provider") return normalizeProviderName(v);
  if (field?.type === "date") return formatDate(v);
  return v;
}
function isClosed(rec: Record<string, any>): boolean {
  return /closed/i.test(`${str(rec.final_status)} ${str(rec.status)}`);
}
function caseTypeMatches(rec: Record<string, any>, sel?: string): boolean {
  if (!sel || sel === "all") return true;
  const ct = str(rec.case_type).toLowerCase();
  if (sel === "nf") return ct.includes("no-fault") || ct.includes("no fault") || ct.includes("nf");
  if (sel === "wc") return ct.includes("work") || ct.includes("comp") || ct.includes("wc");
  if (sel === "lien") return ct.includes("lien");
  return ct === sel.toLowerCase();
}

// Every report is matters joined to their parent lawsuit (blank lawsuit_* when not in a lawsuit).
async function loadRecords(): Promise<Record<string, any>[]> {
  const [matters, lawsuits] = await Promise.all([
    prisma.claimIndex.findMany({ where: buildBarshMatterDisplayNumberScopeWhere(), take: REPORT_ROW_CAP }),
    prisma.lawsuit.findMany({ take: REPORT_ROW_CAP }),
  ]);
  const lawByMaster = new Map<string, any>();
  for (const l of lawsuits as any[]) lawByMaster.set(str(l.masterLawsuitId), l);

  return (matters as any[]).map((m) => {
    const rec: Record<string, any> = {};
    for (const f of REPORT_FIELDS) if (f.column) rec[f.key] = (m as any)[f.column];
    rec.provider_name = str((m as any).client_name) || str((m as any).provider_name);
    const law = lawByMaster.get(str(m.master_lawsuit_id));
    rec.lawsuit_venue = law ? str(law.venue || law.venueSelection || law.venueOther) : "";
    rec.lawsuit_index_aaa = law ? str(law.indexAaaNumber) : "";
    rec.lawsuit_amount_sought = law ? law.amountSought : null;
    rec.lawsuit_amount_basis = law ? str(law.amountSoughtMode) : "";
    rec.lawsuit_notes = law ? str(law.lawsuitNotes) : "";
    rec.lawsuit_created = law ? law.createdAt : null;
    rec.lawsuit_updated = law ? law.updatedAt : null;
    const dosA = formatDate((m as any).dos_start), dosB = formatDate((m as any).dos_end);
    rec.dos_range = dosA && dosB ? (dosA === dosB ? dosA : `${dosA} \u2013 ${dosB}`) : dosA || dosB;
    return rec;
  });
}

function applyTopLine(records: Record<string, any>[], cfg: ReportConfig): Record<string, any>[] {
  const prov = cfg.provider && cfg.provider !== "all" ? str(cfg.provider).toLowerCase() : "";
  const ins = cfg.insurer && cfg.insurer !== "all" ? str(cfg.insurer).toLowerCase() : "";
  return records.filter((rec) => {
    if (cfg.openClosed === "open" && isClosed(rec)) return false;
    if (cfg.openClosed === "closed" && !isClosed(rec)) return false;
    if (prov && normalizeProviderName(rec.provider_name).toLowerCase() !== prov) return false;
    if (ins && normalizeProviderName(rec.insurer_name).toLowerCase() !== ins) return false;
    if (!caseTypeMatches(rec, cfg.caseType)) return false;
    const inLawsuit = Boolean(str(rec.master_lawsuit_id));
    if (cfg.lawsuitBill === "lawsuit" && !inLawsuit) return false;
    if (cfg.lawsuitBill === "bill" && inLawsuit) return false;
    return true;
  });
}

function matchesFilter(rec: Record<string, any>, f: ReportFilter, field: ReportField): boolean {
  const raw = rec[f.field];
  if (field.type === "number") {
    const n = num(raw), a = num(f.value), b = num(f.value2);
    switch (f.op) {
      case "eq": return n === a;
      case "ne": return n !== a;
      case "gt": return n !== null && a !== null && n > a;
      case "lt": return n !== null && a !== null && n < a;
      case "gte": return n !== null && a !== null && n >= a;
      case "lte": return n !== null && a !== null && n <= a;
      case "between": return n !== null && a !== null && b !== null && n >= a && n <= b;
      default: return true;
    }
  }
  if (field.type === "date") {
    const s = str(raw).slice(0, 10), a = str(f.value).slice(0, 10), b = str(f.value2).slice(0, 10);
    switch (f.op) {
      case "on": return s === a;
      case "before": return s !== "" && a !== "" && s < a;
      case "after": return s !== "" && a !== "" && s > a;
      case "between": return s !== "" && a !== "" && b !== "" && s >= a && s <= b;
      case "last_n_days": {
        const days = num(f.value);
        if (days === null || s === "") return false;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return s >= cutoff.toISOString().slice(0, 10);
      }
      default: return true;
    }
  }
  const s = str(raw).toLowerCase(), v = str(f.value).toLowerCase();
  switch (f.op) {
    case "is": return s === v;
    case "is_not": return s !== v;
    case "contains": return s.includes(v);
    case "starts_with": return s.startsWith(v);
    case "is_blank": return s.trim() === "";
    case "is_any_of": return (Array.isArray(f.value) ? f.value.map((x: any) => str(x).toLowerCase()) : []).includes(s);
    default: return true;
  }
}

function applyFilters(records: Record<string, any>[], cfg: ReportConfig, fmap: Record<string, ReportField>): Record<string, any>[] {
  const filters = (cfg.filters || []).filter((f) => f.field && fmap[f.field]);
  if (!filters.length) return records;
  const logic = cfg.filterLogic === "OR" ? "OR" : "AND";
  return records.filter((rec) => {
    const r = filters.map((f) => matchesFilter(rec, f, fmap[f.field]));
    return logic === "OR" ? r.some(Boolean) : r.every(Boolean);
  });
}

function applySort(records: Record<string, any>[], cfg: ReportConfig, fmap: Record<string, ReportField>): Record<string, any>[] {
  const sort = (cfg.sort || []).filter((s) => s.field && fmap[s.field]);
  if (!sort.length) return records;
  const sorted = [...records];
  sorted.sort((ra, rb) => {
    for (const s of sort) {
      const field = fmap[s.field];
      let cmp = 0;
      if (field.type === "number") cmp = (num(ra[s.field]) ?? -Infinity) - (num(rb[s.field]) ?? -Infinity);
      else cmp = str(ra[s.field]).localeCompare(str(rb[s.field]), undefined, { numeric: true, sensitivity: "base" });
      if (cmp !== 0) return s.dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
  return sorted;
}

function aggregate(records: Record<string, any>[], agg: ReportAggregation): number | string {
  const vals = records.map((r) => r[agg.field]);
  if (agg.fn === "count") return records.length;
  if (agg.fn === "distinct") return new Set(vals.map((v) => str(v))).size;
  const nums = vals.map(num).filter((n): n is number => n !== null);
  if (!nums.length) return 0;
  switch (agg.fn) {
    case "sum": return nums.reduce((a, b) => a + b, 0);
    case "avg": return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min": return Math.min(...nums);
    case "max": return Math.max(...nums);
    default: return 0;
  }
}

export type ReportResult = {
  mode: "detail" | "summary";
  columns: { key: string; label: string; type: string; money?: boolean }[];
  rows: Record<string, any>[];
  grandTotals: Record<string, number | string> | null;
  rowCount: number;
  capped: boolean;
};

export async function runReport(cfg: ReportConfig): Promise<ReportResult> {
  const fmap = fieldMap();
  let records = await loadRecords();
  const capped = records.length >= REPORT_ROW_CAP;

  records = applyTopLine(records, cfg);
  records = applyFilters(records, cfg, fmap);
  records = applySort(records, cfg, fmap);

  const aggs = (cfg.aggregations || []).filter((a) => a.field && fmap[a.field]);
  const groupBy = (cfg.groupBy || []).filter((g) => fmap[g]);
  const mode: "detail" | "summary" = cfg.mode === "summary" ? "summary" : "detail";
  const selectedColumns = (cfg.columns || []).filter((c) => fmap[c]);

  if (groupBy.length && (mode === "summary" || aggs.length)) {
    const groups = new Map<string, Record<string, any>[]>();
    for (const rec of records) {
      const key = groupBy.map((g) => str(rec[g])).join(" ¦ ");
      const arr = groups.get(key) || [];
      arr.push(rec);
      groups.set(key, arr);
    }
    const rows: Record<string, any>[] = [];
    for (const [, groupRecs] of groups) {
      const row: Record<string, any> = {};
      for (const g of groupBy) row[g] = displayValue(fmap[g], groupRecs[0][g]);
      for (const a of aggs) row[`${a.fn}__${a.field}`] = aggregate(groupRecs, a);
      row.__count = groupRecs.length;
      rows.push(row);
    }
    const columns = [
      ...groupBy.map((g) => ({ key: g, label: fmap[g].label, type: fmap[g].type, money: Boolean(fmap[g].money) })),
      ...aggs.map((a) => ({ key: `${a.fn}__${a.field}`, label: `${a.fn.toUpperCase()} of ${fmap[a.field].label}`, type: "number", money: a.fn !== "count" && a.fn !== "distinct" && Boolean(fmap[a.field].money) })),
      { key: "__count", label: "Rows", type: "number", money: false },
    ];
    const grandTotals: Record<string, number | string> = { __count: records.length };
    for (const a of aggs) grandTotals[`${a.fn}__${a.field}`] = aggregate(records, a);
    return { mode: "summary", columns, rows, grandTotals, rowCount: records.length, capped };
  }

  const columns = selectedColumns.map((c) => ({ key: c, label: fmap[c].label, type: fmap[c].type, money: Boolean(fmap[c].money) }));
  const rows = records.map((rec) => {
    const row: Record<string, any> = {};
    for (const c of selectedColumns) row[c] = displayValue(fmap[c], rec[c]);
    return row;
  });
  let grandTotals: Record<string, number | string> | null = null;
  if (aggs.length) {
    grandTotals = {};
    for (const a of aggs) grandTotals[`${a.fn}__${a.field}`] = aggregate(records, a);
  }
  return { mode: "detail", columns, rows, grandTotals, rowCount: records.length, capped };
}
