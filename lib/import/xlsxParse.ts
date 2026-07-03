import * as XLSX from "xlsx";

// Parse the first sheet of an xlsx (base64) into an array of row objects keyed by the header row.
// `raw: false` yields formatted strings (dates/numbers as displayed); `defval: ""` fills blanks.
export function parseSheetToObjects(base64: string): Record<string, unknown>[] {
  const buf = Buffer.from(base64, "base64");
  const wb = XLSX.read(buf, { type: "buffer" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: false }) as Record<string, unknown>[];
}
