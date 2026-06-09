#!/usr/bin/env node
import fs from "fs";

const files = {
  invoicePage: "app/admin/clients/[id]/invoice/page.tsx",
  globalPage: "app/admin/invoices/page.tsx",
  clientPage: "app/admin/clients/[id]/page.tsx",
};

let failures = 0;

function text(file) {
  return fs.readFileSync(file, "utf8");
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, body, needle) {
  if (body.includes(needle)) pass(`${label} contains ${needle}`);
  else fail(`${label} missing ${needle}`);
}

for (const [label, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) fail(`${label} missing at ${file}`);
}

const invoicePage = text(files.invoicePage);
const globalPage = text(files.globalPage);
const clientPage = text(files.clientPage);

console.log("");
console.log("=== VERIFY PROVIDER CLIENT INVOICE UI LIFECYCLE ===");
mustContain("invoice page", invoicePage, "Provider Client Invoice Workflow");
mustContain("invoice page", invoicePage, "fontSize: 26");
mustContain("invoice page", invoicePage, "ProviderInfoItem");
mustContain("invoice page", invoicePage, "providerIdentityRows");
mustContain("invoice page", invoicePage, "normalizeAddressDisplay");
mustContain("invoice page", invoicePage, "normalizeAddressLineDisplay");
mustContain("invoice page", invoicePage, "titleCaseAddressSegment");
mustContain("invoice page", invoicePage, "providerPercentageRows");
mustContain("invoice page", invoicePage, "providerBillingRows");
mustContain("invoice page", invoicePage, "compactInfoGroupStyle");
mustContain("invoice page", invoicePage, "filterControlStyle");
mustContain("invoice page", invoicePage, "Transaction Type");
mustContain("invoice page", invoicePage, ">Posted</option>");
mustContain("invoice page", invoicePage, ">Voided</option>");
mustContain("invoice page", invoicePage, '<option value="">All</option>');
mustContain("invoice page", invoicePage, '<option value="">All</option>');
mustContain("invoice page", invoicePage, "Collection Payment");
mustContain("invoice page", invoicePage, "Voluntary Payment");
mustContain("invoice page", invoicePage, "compactInfoLabelStyle");
mustContain("invoice page", invoicePage, "WC Principal");
mustContain("invoice page", invoicePage, "WC Interest");
mustContain("invoice page", invoicePage, "Liens Principal");
mustContain("invoice page", invoicePage, "Liens Interest");
mustContain("invoice page", invoicePage, "loadClientDetail");
mustContain("invoice page", invoicePage, "NF Principal");
mustContain("invoice page", invoicePage, "NF Interest");
mustContain("invoice page", invoicePage, "Pull Costs");
mustContain("invoice page", invoicePage, "Remit");
mustContain("invoice page", invoicePage, "1. Preview");
mustContain("invoice page", invoicePage, "2. Review Invoice");
mustContain("invoice page", invoicePage, "Review Invoice");
mustContain("invoice page", invoicePage, "Principal / Interest Payments:");
mustContain("invoice page", invoicePage, "Costs Received:");
mustContain("invoice page", invoicePage, "Costs Expended:");
mustContain("invoice page", invoicePage, "principalInterestPaymentCount");
mustContain("invoice page", invoicePage, "costPaymentCount");
mustContain("invoice page", invoicePage, "feesCostsExpendedCount");
mustContain("invoice page", invoicePage, "feesCostsExpendedTotal");
mustContain("invoice page", invoicePage, "3. Create Draft Invoice");
mustContain("invoice page", invoicePage, "4. Finalize Invoice");
mustContain("invoice page", invoicePage, "Invoice History");
mustContain("invoice page", invoicePage, "Invoice Detail:");
mustContain("invoice page", invoicePage, "Invoice Audit History");
mustContain("invoice page", invoicePage, "Print / Save PDF");
mustContain("invoice page", invoicePage, 'window.open("about:blank", "_blank")');
mustContain("invoice page", invoicePage, "popup.document.open()");
mustContain("invoice page", invoicePage, "popup.focus()");
mustContain("invoice page", invoicePage, "confirmCreateInvoiceDraft");
mustContain("invoice page", invoicePage, "confirmFinalizeInvoice");
mustContain("invoice page", invoicePage, "confirmVoidInvoice");
mustContain("invoice page", invoicePage, "/api/admin/clients/${encodeURIComponent(id)}/invoice/create-preview");
mustContain("invoice page", invoicePage, "/api/admin/clients/${encodeURIComponent(id)}/invoice/create");
mustContain("invoice page", invoicePage, "/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}/finalize");
mustContain("invoice page", invoicePage, "/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}/void");
mustContain("invoice page", invoicePage, "Draft invoice created. Receipt rows are not yet marked as invoiced.");
mustContain("invoice page", invoicePage, "Invoice finalized. Included receipt rows are marked with this invoice ID");
mustContain("invoice page", invoicePage, "Invoice voided. Receipt rows previously marked with this invoice ID were released");

console.log("");
console.log("=== VERIFY GLOBAL INVOICE SEARCH UI ===");
mustContain("global page", globalPage, "Global Invoice Search");
mustContain("global page", globalPage, "Provider-Level Reporting");
mustContain("global page", globalPage, "/api/admin/invoices?");
mustContain("global page", globalPage, "Client Invoice Page");
mustContain("client page", clientPage, "Global Invoice Search");

if (invoicePage.includes("Source of truth: Main Client Info Page / ProviderClientInfo")) {
  console.error("FAIL: invoice page still contains source-of-truth explanatory copy");
  failures += 1;
} else {
  console.log("PASS: invoice page source-of-truth explanatory copy removed");
}

if (invoicePage.includes("Edit Main Client Info")) {
  console.error("FAIL: invoice page still contains Edit Main Client Info link");
  failures += 1;
} else {
  console.log("PASS: invoice page does not expose provider/client editing from invoice workflow");
}

if (invoicePage.includes("Provider / Client Info")) {
  console.error("FAIL: invoice page still contains Provider / Client Info label");
  failures += 1;
} else {
  console.log("PASS: invoice page Provider / Client Info label removed");
}

if (invoicePage.includes('{ label: "Name", value: clientDetail?.displayName')) {
  console.error("FAIL: invoice page still contains repeated provider Name row");
  failures += 1;
} else {
  console.log("PASS: invoice page repeated provider Name row removed");
}

if (invoicePage.includes("Posting Context") || invoicePage.includes("postingContext") || invoicePage.includes("All posting contexts")) {
  console.error("FAIL: invoice page still contains Posting Context filter");
  failures += 1;
} else {
  console.log("PASS: invoice page Posting Context filter removed");
}

for (const stale of [
  "const [checkNumber",
  "setCheckNumber",
  'query.set("checkNumber"',
  "value={checkNumber}",
  "onChange={(event) => setCheckNumber",
]) {
  if (invoicePage.includes(stale)) {
    console.error(`FAIL: invoice page still contains Check Number filter/state marker: ${stale}`);
    failures += 1;
  }
}
console.log("PASS: invoice page Check Number filter removed while display columns may remain");

if (invoicePage.includes("Admin mode: include already-invoiced receipt rows for diagnostics") || invoicePage.includes("Admin review mode is active") || invoicePage.includes("includeAlreadyInvoiced") || invoicePage.includes("confirmIncludeAlreadyInvoiced") || invoicePage.includes('<option value="active">active</option>')) {
  console.error("FAIL: invoice page still contains Active/Admin preview UI remnants");
  failures += 1;
} else {
  console.log("PASS: invoice page Active/Admin preview UI removed");
}

if (invoicePage.includes('<option value="Filing Fee Collected">Filing Fee Collected</option>')) {
  console.error("FAIL: invoice page still contains Filing Fee Collected transaction-type option");
  failures += 1;
} else {
  console.log("PASS: invoice page Filing Fee Collected transaction-type option removed");
}

if (invoicePage.includes("Other Court Fees Collected")) {
  console.error("FAIL: invoice page still contains Other Court Fees Collected transaction-type option");
  failures += 1;
} else {
  console.log("PASS: invoice page Other Court Fees Collected transaction-type option removed");
}

if (invoicePage.includes("Receipt Rows") || invoicePage.includes("Excluded Already Invoiced") || invoicePage.includes("Included Already Invoiced") || invoicePage.includes("Package Total")) {
  console.error("FAIL: invoice page still contains removed old review summary labels");
  failures += 1;
} else {
  console.log("PASS: invoice page old review summary labels removed");
}

if (failures) {
  console.error(`\nFAILURES=${failures}`);
  process.exit(1);
}

console.log("\nPASS: provider client invoice UI lifecycle verifier passed");
