/* eslint-disable @typescript-eslint/no-explicit-any -- Report rows are dynamic (field-key -> value) by design. */
import { prisma } from "@/lib/prisma";
import { fieldMap, fieldsFor, type ReportBase, type ReportField } from "./reportCatalog";
import { normalizeProviderName } from "@/lib/providerNameCase";

function displayValue(field: ReportField | undefined, v: any): any {
  if (field?.format === "provider") return normalizeProviderName(v);
  return v;
}

export type ReportFilter = { field: string; op: string; value?: any; value2?: any };
export type ReportAggregation = { field: string; fn: "sum" | "avg" | "count" | "distinct" | "min" | "max" };
export type ReportSort = { field: string; dir: "asc" | "desc" };
export type ReportConfig = {
  base: ReportBase;
  columns: string[];
  filters?: ReportFilter[];
  filterLogic?: "AND" | "OR";
  groupBy?: string[];
  aggregations?: ReportAggregation[];
  sort?: ReportSort[];
  mode?: "detail" | "summary";
  limit?: number;
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

// ---- load flat records (one object keyed by field-key) for the chosen base entity ----
async function loadMatterRecords(): Promise<Record<string, any>[]> {
  const rows = await prisma.claimIndex.findMany({ take: REPORT_ROW_CAP });
  const fields = fieldsFor("matter");
  return rows.map((r: any) => {
    const rec: Record<string, any> = {};
    for (const f of fields) if (f.column) rec[f.key] = (r as any)[f.column];
    return rec;
  });
}

async function loadLawsuitRecords(): Promise<Record<string, any>[]> {
  const [lawsuits, matterRows] = await Promise.all([
    prisma.lawsuit.findMany({ take: REPORT_ROW_CAP }),
    prisma.claimIndex.findMany({
      where: { master_lawsuit_id: { not: null } },
      select: { master_lawsuit_id: true, display_number: true, claim_amount: true, balance_presuit: true },
      take: REPORT_ROW_CAP,
    }),
  ]);
  // Roll up member matters per lawsuit
  const roll = new Map<string, { count: number; claim: number; bal: number; numbers: string[] }>();
  for (const m of matterRows as any[]) {
    const k = str(m.master_lawsuit_id);
    if (!k) continue;
    const agg = roll.get(k) || { count: 0, claim: 0, bal: 0, numbers: [] };
    agg.count += 1;
    agg.claim += num(m.claim_amount) || 0;
    agg.bal += num(m.balance_presuit) || 0;
    if (m.display_number) agg.numbers.push(str(m.display_number));
    roll.set(k, agg);
  }
  const fields = fieldsFor("lawsuit");
  return (lawsuits as any[]).map((l) => {
    const rec: Record<string, any> = {};
    for (const f of fields) if (f.column) rec[f.key] = (l as any)[f.column];
    const agg = roll.get(str(l.masterLawsuitId)) || { count: 0, claim: 0, bal: 0, numbers: [] };
    rec.matterCount = agg.count;
    rec.totalClaimAmount = agg.claim;
    rec.totalBalancePresuit = agg.bal;
    rec.memberMatterNumbers = agg.numbers.join(", ");
    return rec;
  });
}

// ---- filtering ----
function matchesFilter(rec: Record<string, any>, f: ReportFilter, field: ReportField): boolean {
  const raw = rec[f.field];
  if (field.type === "number") {
    const n = num(raw);
    const a = num(f.value);
    const b = num(f.value2);
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
    const s = str(raw).slice(0, 10);
    const a = str(f.value).slice(0, 10);
    const b = str(f.value2).slice(0, 10);
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
  // text / category
  const s = str(raw).toLowerCase();
  const v = str(f.value).toLowerCase();
  switch (f.op) {
    case "is": return s === v;
    case "is_not": return s !== v;
    case "contains": return s.includes(v);
    case "starts_with": return s.startsWith(v);
    case "is_blank": return s.trim() === "";
    case "is_any_of": {
      const list = Array.isArray(f.value) ? f.value.map((x: any) => str(x).toLowerCase()) : [];
      return list.includes(s);
    }
    default: return true;
  }
}

function applyFilters(records: Record<string, any>[], cfg: ReportConfig, fmap: Record<string, ReportField>): Record<string, any>[] {
  const filters = (cfg.filters || []).filter((f) => f.field && fmap[f.field]);
  if (!filters.length) return records;
  const logic = cfg.filterLogic === "OR" ? "OR" : "AND";
  return records.filter((rec) => {
    const results = filters.map((f) => matchesFilter(rec, f, fmap[f.field]));
    return logic === "OR" ? results.some(Boolean) : results.every(Boolean);
  });
}

// ---- sorting ----
function applySort(records: Record<string, any>[], cfg: ReportConfig, fmap: Record<string, ReportField>): Record<string, any>[] {
  const sort = (cfg.sort || []).filter((s) => s.field && fmap[s.field]);
  if (!sort.length) return records;
  const sorted = [...records];
  sorted.sort((ra, rb) => {
    for (const s of sort) {
      const field = fmap[s.field];
      let cmp = 0;
      if (field.type === "number") {
        cmp = (num(ra[s.field]) ?? -Infinity) - (num(rb[s.field]) ?? -Infinity);
      } else {
        cmp = str(ra[s.field]).localeCompare(str(rb[s.field]), undefined, { numeric: true, sensitivity: "base" });
      }
      if (cmp !== 0) return s.dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
  return sorted;
}

// ---- aggregation ----
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
  base: ReportBase;
  mode: "detail" | "summary";
  columns: { key: string; label: string; type: string }[];
  rows: Record<string, any>[];
  grandTotals: Record<string, number | string> | null;
  rowCount: number;
  capped: boolean;
};

export async function runReport(cfg: ReportConfig): Promise<ReportResult> {
  const base: ReportBase = cfg.base === "lawsuit" ? "lawsuit" : "matter";
  const fmap = fieldMap(base);
  let records = base === "lawsuit" ? await loadLawsuitRecords() : await loadMatterRecords();
  const capped = records.length >= REPORT_ROW_CAP;

  records = applyFilters(records, cfg, fmap);
  records = applySort(records, cfg, fmap);

  const aggs = (cfg.aggregations || []).filter((a) => a.field && fmap[a.field]);
  const groupBy = (cfg.groupBy || []).filter((g) => fmap[g]);
  const mode: "detail" | "summary" = cfg.mode === "summary" ? "summary" : "detail";
  const selectedColumns = (cfg.columns || []).filter((c) => fmap[c]);

  // SUMMARY (grouped) mode -> one row per group with aggregations
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
      ...groupBy.map((g) => ({ key: g, label: fmap[g].label, type: fmap[g].type })),
      ...aggs.map((a) => ({ key: `${a.fn}__${a.field}`, label: `${a.fn.toUpperCase()} of ${fmap[a.field].label}`, type: "number" })),
      { key: "__count", label: "Rows", type: "number" },
    ];
    const grandTotals: Record<string, number | string> = { __count: records.length };
    for (const a of aggs) grandTotals[`${a.fn}__${a.field}`] = aggregate(records, a);
    return { base, mode: "summary", columns, rows, grandTotals, rowCount: records.length, capped };
  }

  // DETAIL mode -> selected columns, optional grand totals for aggregated numeric fields
  const columns = selectedColumns.map((c) => ({ key: c, label: fmap[c].label, type: fmap[c].type }));
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
  return { base, mode: "detail", columns, rows, grandTotals, rowCount: records.length, capped };
}
