import fs from "node:fs";

const adminPage = fs.readFileSync("app/admin/ticklers/page.tsx", "utf8");
const lawsuitPage = fs.readFileSync("app/lawsuits/page.tsx", "utf8");

const failures = [];

const expectedHeaders = [
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

function mustInclude(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

function assertExactHeaderOrder(label, page) {
  const match = page.match(/const standardCaseExportHeaders = \[([\s\S]*?)\];/);
  if (!match) {
    failures.push(`${label} missing standardCaseExportHeaders`);
    return;
  }

  const headers = [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);

  if (headers.length !== expectedHeaders.length) {
    failures.push(`${label} header count ${headers.length} does not equal expected ${expectedHeaders.length}`);
  }

  expectedHeaders.forEach((header, index) => {
    if (headers[index] !== header) {
      failures.push(`${label} header ${index + 1} expected "${header}" but found "${headers[index] || ""}"`);
    }
  });
}

for (const [label, page] of [
  ["admin tickler", adminPage],
  ["lawsuit search", lawsuitPage],
]) {
  assertExactHeaderOrder(label, page);
  mustInclude(`${label} AOA worksheet export`, page, "XLSX.utils.aoa_to_sheet([headers, ...rows])");
  mustInclude(`${label} row export helper`, page, "function downloadWorkbookRows");
  mustInclude(`${label} write file`, page, "XLSX.writeFile");

  mustNotInclude(`${label} all-data filename`, page, "all-data");
  mustNotInclude(`${label} flattened object export`, page, "flattenExportObject");
  mustNotInclude(`${label} duplicate header Created at end`, page, '"Closed Date",\n  "Created"');
  mustNotInclude(`${label} duplicate header Updated at end`, page, '"Created",\n  "Updated",\n];');
  mustNotInclude(`${label} json object export`, page, "XLSX.utils.json_to_sheet(rows)");
}

if (failures.length) {
  console.error("FAIL: standard XLS export column verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: XLS exports use exactly the requested 20 fields in the requested order.");
