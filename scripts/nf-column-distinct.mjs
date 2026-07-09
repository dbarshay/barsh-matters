// Generic distinct-value tally for any column of the NF All Closed source spreadsheet.
// Pure compute (no DB). Usage:
//   node scripts/nf-column-distinct.mjs "<xlsx path>" "<header-regex>" "<out csv path>"
// Reads only the matched column (memory-safe over 264k rows). Writes value,count sorted desc.
import { readFileSync, writeFileSync } from "fs";
import * as XLSX from "xlsx";
const [src, headerRe, out] = process.argv.slice(2);
const wb = XLSX.read(readFileSync(src), { type: "buffer", cellDates: false, cellNF: false, cellHTML: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const range = XLSX.utils.decode_range(ws["!ref"]);
const re = new RegExp(headerRe, "i");
let col = -1, hn = "";
for (let c = range.s.c; c <= range.e.c; c++) { const cell = ws[XLSX.utils.encode_cell({ c, r: range.s.r })]; const h = cell ? String(cell.w ?? cell.v ?? "") : ""; if (re.test(h)) { col = c; hn = h; break; } }
if (col < 0) { console.error("no column matching " + headerRe); process.exit(1); }
const counts = new Map(); let blank = 0, total = 0;
for (let r = range.s.r + 1; r <= range.e.r; r++) { total++; const cell = ws[XLSX.utils.encode_cell({ c: col, r })]; const v = cell ? String(cell.w ?? cell.v ?? "").trim() : ""; if (!v) { blank++; continue; } counts.set(v, (counts.get(v) ?? 0) + 1); }
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const esc = (s) => /[",\r\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
writeFileSync(out, [["value", "count"], ...sorted.map(([v, c]) => [v, String(c)])].map(r => r.map(esc).join(",")).join("\n") + "\n", "utf8");
console.log(`Column: "${hn}" (idx ${col})`); console.log(`Total rows: ${total}`); console.log(`Blank: ${blank}`); console.log(`Distinct non-blank: ${sorted.length}`); console.log(`Wrote -> ${out}`);
console.log("\nTop 40:"); for (const [v, c] of sorted.slice(0, 40)) console.log(`${String(c).padStart(7)}  ${v}`);
console.log("\n__DONE__");
