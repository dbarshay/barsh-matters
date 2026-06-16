import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function fail(message) { console.error(`FAIL: ${message}`); process.exit(1); }
function pass(message) { console.log(`PASS: ${message}`); }
function mustContain(label, text, needle) { if (!text.includes(needle)) fail(`${label} missing ${needle}`); pass(label); }
function mustNotContain(label, text, needle) { if (text.includes(needle)) fail(`${label} contains forbidden ${needle}`); pass(label); }

const page = read("app/admin/clients/[id]/page.tsx");
const invoicePage = read("app/admin/clients/[id]/invoice/page.tsx");

mustContain("workflow panel type includes attorney fees", page, '"attorney_fees"');
mustContain("button marker", page, 'data-barsh-attorney-fee-report-button="true"');
mustContain("panel marker", page, 'data-barsh-attorney-fee-report-panel="true"');
mustContain("button label", page, "Attorney Fee Report");
mustContain("panel copy non-remittance", page, "Attorney Fee is a separate non-remittance payment type.");
mustContain("filters local attorney fee rows", page, 'transactionType || "").trim().toLowerCase() === "attorney fee"');
mustContain("attorney fee csv rows", page, "attorneyFeeCsvRows");
mustContain("attorney fee active total", page, "attorneyFeeReportTotals.activeTotal");
mustContain("attorney fee export", page, "Attorney Fee Report.csv");
mustContain("attorney fee table amount", page, "{money(row.amount)}");
mustNotContain("invoice page must not add Attorney Fee filter", invoicePage, '<option value="Attorney Fee">Attorney Fee</option>');

console.log("PASS: attorney fee report panel safety");
