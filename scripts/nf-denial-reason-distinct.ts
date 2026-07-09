// Tally distinct DenialReasons values (with row counts) from the NF All Closed source spreadsheet,
// so the reference seed can alias-map every variant. Read-only; writes one CSV.
//
// Usage: npx tsx scripts/nf-denial-reason-distinct.ts "/path/to/NF All Closed.xlsx"
//   (defaults to "./NF All Closed.xlsx" if no path given)
//
// Output: docs/nf-denial-reason-distinct.csv  ->  columns: value,count  (sorted by count desc)
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import * as XLSX from "xlsx";

const inputPath = resolve(process.cwd(), process.argv[2] || "NF All Closed.xlsx");
if (!existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}\nPass the path: npx tsx scripts/nf-denial-reason-distinct.ts "/path/to/NF All Closed.xlsx"`);
  process.exit(1);
}

const wb = XLSX.read(readFileSync(inputPath), { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false }) as Record<string, unknown>[];

if (rows.length === 0) {
  console.error("No data rows found in first sheet.");
  process.exit(1);
}

// Locate the denial column by header (index 1 is `DenialReasons`, but match defensively).
const headers = Object.keys(rows[0]);
const denialHeader =
  headers.find((h) => /denial\s*reason/i.test(h)) ||
  headers.find((h) => /denial/i.test(h));
if (!denialHeader) {
  console.error(`No denial-reason column found. Headers were:\n${headers.join(" | ")}`);
  process.exit(1);
}

const counts = new Map<string, number>();
let blank = 0;
for (const row of rows) {
  const raw = String(row[denialHeader] ?? "").trim();
  if (raw === "") {
    blank++;
    continue;
  }
  counts.set(raw, (counts.get(raw) ?? 0) + 1);
}

const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const out = [["value", "count"], ...sorted.map(([v, c]) => [v, String(c)])];
const outPath = resolve(process.cwd(), "docs/nf-denial-reason-distinct.csv");
writeFileSync(outPath, out.map((r) => r.map(csvCell).join(",")).join("\n") + "\n", "utf8");

console.log(`Source column: "${denialHeader}"`);
console.log(`Total data rows: ${rows.length}`);
console.log(`Blank/empty denial values: ${blank}`);
console.log(`Distinct non-blank values: ${sorted.length}`);
console.log(`Wrote → ${outPath}`);
console.log(`\nTop 25 by count:`);
for (const [v, c] of sorted.slice(0, 25)) console.log(`  ${String(c).padStart(7)}  ${v}`);
