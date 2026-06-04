import fs from "node:fs";

const page = fs.readFileSync("app/lawsuits/page.tsx", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");
const failures = [];

function mustInclude(label, needle) {
  if (!page.includes(needle) && !pkg.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, needle) {
  if (page.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

mustInclude("xlsx dependency", '"xlsx"');
mustInclude("xlsx import", 'import * as XLSX from "xlsx";');
mustInclude("standard ordered header constant", "const standardCaseExportHeaders =");
mustInclude("AOA export helper", "function downloadWorkbookRows");
mustInclude("AOA worksheet export", "XLSX.utils.aoa_to_sheet([headers, ...rows])");
mustInclude("book append sheet", "XLSX.utils.book_append_sheet");
mustInclude("write file", "XLSX.writeFile");
mustInclude("lawsuit search export function", "function exportSearchResultsXlsx()");
mustInclude("Export XLS button", "Export XLS");
mustInclude("only when groups exist", "groups.length > 0");
mustInclude("export filename", "barsh-matters-lawsuit-search-results-");
mustInclude("uses standard headers", "standardCaseExportHeaders");
mustInclude("exports claim value", "safeExportCell(getClaimNumber(group))");
mustInclude("exports matter value", "displayNumber(matter)");
mustInclude("exports patient value", 'safeExportCell(val(matter, "patientName", "patient_name"))');
mustInclude("exports provider value", 'safeExportCell(val(matter, "client_name", "clientName", "provider_name", "providerName"))');
mustInclude("exports insurer value", "safeExportCell(insurerName(matter))");
mustInclude("exports adversary attorney value", "safeExportCell(adversaryAttorneyName(matter))");
mustInclude("exports master lawsuit value", "safeExportCell(masterId(matter))");

const match = page.match(/const standardCaseExportHeaders = \[([\s\S]*?)\];/);
const expected = [
  "Due",
  "Type",
  "Created",
  "Updated",
  "Matter",
  "Master Lawsuit",
  "Provider",
  "Patient",
  "Insurer",
  "Adversary Attorney",
  "Claim Number",
  "Date of Loss",
  "Court",
  "Index Number",
  "Date Filed",
  "Settled Date",
  "Settled With",
  "Denial Reason",
  "Status",
  "Closed Reason",
  "Closed Date",
];

if (!match) {
  failures.push("missing standardCaseExportHeaders array");
} else {
  const headers = [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
  if (headers.length !== expected.length) {
    failures.push(`expected ${expected.length} XLS headers but found ${headers.length}`);
  }
  expected.forEach((header, index) => {
    if (headers[index] !== header) {
      failures.push(`header ${index + 1} expected "${header}" but found "${headers[index] || ""}"`);
    }
  });
}

const exportStart = page.indexOf("function exportSearchResultsXlsx()");
const exportEnd = page.indexOf("\n  function ", exportStart + 1);
const exportWindow = exportStart >= 0
  ? page.slice(exportStart, exportEnd > exportStart ? exportEnd : page.length)
  : "";

if (!exportWindow) failures.push("missing export function window");
if (exportWindow.includes("fetch(")) failures.push("export function must not call fetch");
if (exportWindow.includes('method: "POST"') || exportWindow.includes("method: 'POST'")) failures.push("export function must not perform POST");
if (exportWindow.includes('method: "DELETE"') || exportWindow.includes("method: 'DELETE'")) failures.push("export function must not perform DELETE");
if (exportWindow.includes('method: "PATCH"') || exportWindow.includes("method: 'PATCH'")) failures.push("export function must not perform PATCH");

mustNotInclude("old json_to_sheet object export", "XLSX.utils.json_to_sheet");
mustNotInclude("old flatten export helper", "flattenExportObject");
mustNotInclude("all-data filename", "all-data");
mustNotInclude("server-side export route", "/api/export");
mustNotInclude("XLS export API route", "/api/xls");

if (failures.length) {
  console.error("FAIL: lawsuit search XLS export verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: lawsuit aggregation search results export XLS with exactly the requested ordered columns.");
