import fs from "node:fs";

const page = fs.readFileSync("app/admin/ticklers/page.tsx", "utf8");
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
mustInclude("tickler export function", "function exportTicklerResultsXlsx()");
mustInclude("Export XLS button", "Export XLS");
mustInclude("export only when results exist", "Array.isArray(result?.ticklers) && result.ticklers.length > 0");
mustInclude("export filename", "barsh-matters-ticklers-");
mustInclude("uses standard headers", "standardCaseExportHeaders");
mustInclude("exports due value", "formatDate(tickler.dueDate)");
mustInclude("exports type value", "kindLabel(tickler.kind)");
mustInclude("exports matter value", "safeExportCell(tickler.caseData?.matter || tickler.masterLawsuitId || tickler.displayNumber || tickler.matterId)");
mustInclude("exports master lawsuit value", "safeExportCell(tickler.caseData?.masterLawsuit || tickler.masterLawsuitId)");
mustInclude("exports provider caseData", "safeExportCell(tickler.caseData?.provider)");
mustInclude("exports patient caseData", "safeExportCell(tickler.caseData?.patient)");
mustInclude("exports insurer caseData", "safeExportCell(tickler.caseData?.insurer)");
mustInclude("exports claim number caseData", "safeExportCell(tickler.caseData?.claimNumber)");
mustInclude("exports settled with caseData", "safeExportCell(tickler.caseData?.settledWith)");

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

mustNotInclude("old json_to_sheet object export", "XLSX.utils.json_to_sheet");
mustNotInclude("old flatten export helper", "flattenExportObject");
mustNotInclude("all-data filename", "all-data");
mustNotInclude("server write route", 'method: "POST"');
mustNotInclude("delete route", 'method: "DELETE"');
mustNotInclude("run ticklers button", "Run Ticklers");
mustNotInclude("process ticklers button", "Process Ticklers");

if (failures.length) {
  console.error("FAIL: admin tickler XLS export verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: admin tickler results export XLS with exactly the requested ordered columns.");
