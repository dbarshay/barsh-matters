#!/usr/bin/env node
import fs from "fs";

const files = {
  page: "app/admin/clients/[id]/invoice/page.tsx",
  finalizeRoute: "app/api/admin/clients/[id]/invoice/[invoiceId]/finalize/route.ts",
  detailRoute: "app/api/admin/clients/[id]/invoice/[invoiceId]/route.ts",
  packageJson: "package.json",
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
  if (body.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustNotContain(label, body, needle) {
  if (!body.includes(needle)) pass(`${label}: avoids ${needle}`);
  else fail(`${label}: contains forbidden ${needle}`);
}

function mustNotMatch(label, body, regex, description) {
  if (!regex.test(body)) pass(`${label}: avoids ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY INVOICE STEP 4 FINALIZE OUTPUT SAFETY ===");

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) fail(`missing file ${file}`);
}

const page = text(files.page);
const finalizeRoute = text(files.finalizeRoute);
const detailRoute = text(files.detailRoute);
const pkg = JSON.parse(text(files.packageJson));

mustContain("invoice page", page, "function invoiceReceiptLineCount");
mustContain("invoice page", page, "Frozen invoice lines will remain the invoice review/output source.");
mustContain("invoice page", page, "This will not mutate Clio, ClaimIndex, source costs, documents, email, print, queue, or remittance records.");
mustContain("invoice page", page, "receiptRowsMarkedWithThisInvoiceId");
mustContain("invoice page", page, "await loadInvoiceDetail(invoiceId);");
mustContain("invoice page", page, "setInvoiceDetailVisible(true);");
mustContain("invoice page", page, "frozen invoice line");

const finalizeFunctionMatch = page.match(/async function finalizeInvoice\([\s\S]*?\n  async function voidInvoice/);
if (!finalizeFunctionMatch) {
  fail("invoice page: could not isolate finalizeInvoice function");
} else {
  const finalizeFunction = finalizeFunctionMatch[0];
  mustContain("finalize function", finalizeFunction, "await loadInvoiceDetail(invoiceId);");
  mustContain("finalize function", finalizeFunction, "setInvoiceDetailVisible(true);");
  mustNotContain(
    "finalize function",
    finalizeFunction,
    "setInvoiceDetailVisible(false);"
  );
  mustNotContain(
    "finalize function",
    finalizeFunction,
    "setInvoiceDetail(null);"
  );
}

mustContain("printable invoice", page, "Principal / Interest Received");
mustContain("printable invoice", page, "Costs Received");
mustContain("printable invoice", page, "Total Costs Received");
mustNotContain("printable invoice", page, "<h2>Fees and Costs Expended</h2>");
mustNotContain("printable invoice", page, "Total Received:");
mustNotContain("printable invoice", page, "Total Expended:");
mustContain("printable invoice", page, "Costs Expended");
mustContain("printable invoice", page, "Date of Loss");
mustContain("printable invoice", page, "Date of Service");
mustContain("printable invoice", page, "Check Date");
mustNotContain("printable invoice", page, "Check Dt");
mustContain("printable invoice", page, "print-color-adjust: exact");
mustContain("printable invoice", page, "color: #ffffff");
mustContain("printable invoice", page, "Check Number");
mustContain("printable invoice", page, "Amt. Billed");
mustContain("invoice page", page, 'label: "Amt. Billed", align: "right", headerAlign: "center"');
mustContain("invoice page", page, 'label: "Amt. Received", expendedLabel: "Amount Expended", align: "right", headerAlign: "center"');
mustContain("invoice page", page, 'textAlign: column.headerAlign === "center" ? "center" : column.align === "right" ? "right" : undefined');
mustNotContain("printable invoice", page, '<th class="money">Billed</th>');
mustNotContain("printable invoice", page, '<th class="money">Paid</th>');
mustContain("printable invoice", page, "width: 680px");
mustContain("printable invoice", page, "font-size: 28px");
mustContain("printable invoice", page, "border-top: 4px solid #0f172a");
mustContain("printable invoice", page, "Retainer Fee");
mustContain("printable invoice", page, "Retainer Fee:");
mustNotContain("printable invoice", page, "<span>Retainer: ${safeHtml(money(sectionRetainerTotal(principalInterestLines)))}</span>");
mustNotContain("printable invoice", page, '<th class="money">Retainer</th>');
mustContain("printable invoice", page, "Remit to Provider");
mustContain("printable invoice", page, "invoiceLineDosEnd(line)");
mustContain("printable invoice", page, "printableDos(line)");
mustContain("printable invoice", page, "Word/DOCX is not a delivery format");
mustContain("printable invoice", page, "Print / Save as PDF");
mustContain("printable invoice", page, "BRL Logo");
mustContain("printable invoice", page, "Remittance / Statement of Account");
mustContain("printable invoice", page, "Statement Number:");
mustContain("printable invoice", page, "statement-meta-value");
mustContain("printable invoice", page, "font-size: 18px; font-weight: 900");
mustContain("printable invoice", page, "font-size: 16px; font-weight: 800");
mustContain("printable invoice", page, "Statement Period:");
mustContain("printable invoice", page, "Invoice Date:");
mustContain("printable invoice", page, "normalizedAddressHtml");
mustContain("printable invoice", page, "function normalizeAddressDisplayLine");
mustContain("printable invoice", page, "PO Box");
mustContain("printable invoice", page, "header-center");
mustContain("printable invoice", page, "provider-name");
mustContain("printable invoice", page, "provider-address");
mustNotContain("printable provider address", page, "provider-address { width: 100%; margin-top: 6px; font-size: 12px; font-weight: 700; color: #334155; line-height: 1.35; text-align: center; text-transform: uppercase; }");
mustNotContain("printable invoice", page, '<div class="label">Provider / Client</div>');
mustNotContain("printable invoice", page, '<div class="label">Period / Filters</div>');
mustNotContain("printable invoice", page, "Invoice Lines:");
mustNotContain("printable invoice", page, "Statement Total:");
mustContain("printable invoice", page, "white-space: nowrap;");
mustContain("printable invoice", page, "max-width: 380px");
mustContain("printable invoice", page, 'const statementTitle = "Remittance / Statement of Account";');
mustContain("printable invoice", page, "grid-template-columns: 390px minmax(720px, 1fr) 340px");
mustContain("printable invoice", page, "justify-content: space-between;");
mustContain("printable invoice", page, "height: 170px");
mustContain("printable invoice", page, "text-align: center;");
mustContain("printable invoice", page, "text-align: left;");
mustContain("printable invoice", page, "section-note");
mustContain("printable invoice", page, "font-size: 14px; page-break-inside");
mustContain("printable invoice", page, "padding: 8px 9px");
mustContain("printable invoice", page, "thead { display: table-header-group; }");
mustContain("printable invoice", page, "tfoot { display: table-footer-group; }");
mustContain("printable invoice", page, "background: #64748b");
mustContain("printable invoice", page, "text-align: center; font-weight: 900");
mustNotContain("printable invoice", page, "principalInterestLines.length} line");
mustNotContain("printable invoice", page, "costsReceivedLines.length} line");
mustNotContain("printable invoice", page, "feesCostsExpendedLines.length} line");
mustContain("printable invoice", page, "Net Remit");
mustContain("printable invoice", page, "summaryNetRemitToProvider = summaryPrincipalInterestReceived - summaryRetainerFee");
mustNotContain("printable invoice", page, "A. Principal / Interest Received");
mustNotContain("printable invoice", page, "B. Retainer Fee");
mustNotContain("printable invoice", page, "Net Remit to Provider (A - B)");
mustContain("printable invoice", page, "Principal / Interest Received");
mustContain("printable invoice", page, "Retainer Fee");
mustContain("printable invoice", page, "Net Remit to Provider");
mustNotContain("printable invoice", page, "<div><span>Costs Received</span><span>${safeHtml(money(invoice.filingFeePaymentTotal))}</span></div>");
mustNotContain("printable invoice", page, "<div><span>Costs Expended</span><span>${safeHtml(money(invoice.costsExpendedTotal))}</span></div>");
mustNotContain("printable invoice", page, "<div class=\"total\"><span>Invoice Total</span><span>${safeHtml(money(invoice.invoicePackageTotal))}</span></div>");
mustContain("printable invoice", page, "DOL");
mustContain("printable invoice", page, "DOS");
mustContain("printable invoice", page, "Check #");
mustContain("printable invoice", page, "Total Costs Expended");
mustContain("printable invoice", page, "Retainer Fee:");
mustContain("printable invoice", page, "Date Incurred");
mustContain("invoice review UI", page, 'label: "Retainer Fee", align: "right"');
mustContain("invoice review UI", page, 'expendedLabel: "Date Incurred"');
mustContain("invoice detail UI", page, '<th style={{ ...thStyle, textAlign: "right" }}>Retainer Fee</th>');
mustNotContain("printable invoice", page, "<span>Retainer: ${safeHtml(money(sectionRetainerTotal(principalInterestLines)))}</span>");
mustNotContain("printable invoice", page, '<th class="money">Retainer</th>');
mustNotContain("printable invoice", page, "<th>Matter</th><th>Patient</th><th>DOL</th><th>DOS</th><th>Insurer</th><th>Case</th><th>Type</th><th>Incurred</th><th class=\"money\">Amount</th>");
mustNotContain("invoice review UI", page, 'label: "Retainer",');
mustNotContain("invoice review UI", page, 'expendedLabel: "Incurred"');
mustNotContain("invoice detail UI", page, '<th style={{ ...thStyle, textAlign: "right" }}>Retainer</th>');

mustNotContain("printable invoice", page, "<strong>Receipt Marking</strong>");
mustNotContain("printable invoice", page, "<th>Date</th><th>Matter</th><th>Patient</th><th>Provider</th><th>Description</th><th style=\"text-align:right;\">Amount</th><th style=\"text-align:right;\">Retainer Fee</th>");
mustNotMatch("printable invoice", page, /<div class="total"><span>Invoice Total<\/span><span>[^`]*?<div class="total"><span>Invoice Total<\/span>/, "duplicate printable invoice total block");

mustContain("finalize route", finalizeRoute, "tx.matterPaymentReceipt.updateMany");
mustContain("finalize route", finalizeRoute, "data: { invoiceId: invoice.id }");
mustContain("finalize route", finalizeRoute, "receiptRowsMarkedWithThisInvoiceId");
mustContain("finalize route", finalizeRoute, "does not mutate Clio, ClaimIndex, source costs, documents, email, print, queue, or remittance records");
mustNotMatch("finalize route", finalizeRoute, /clioFetch|from\s+["'][^"']*clio/i, "Clio operational dependency");
mustNotMatch("finalize route", finalizeRoute, /claimIndex\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "ClaimIndex mutation");
mustNotMatch("finalize route", finalizeRoute, /providerClientInvoiceLine\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "ProviderClientInvoiceLine mutation during finalize");

mustContain("detail route", detailRoute, "receiptRowsMarkedWithThisInvoiceId");
mustContain("detail route", detailRoute, "receiptRowsUnmarked");
mustContain("detail route", detailRoute, "receiptMarkDetails");

const expectedScript = "node scripts/verify-invoice-step4-finalize-output-safety.mjs";
if (pkg.scripts?.["verify:invoice-step4-finalize-output-safety"] === expectedScript) {
  pass("package.json: verifier script registered");
} else {
  fail("package.json: verifier script is not registered");
}

if (failures) {
  console.error(`\nRESULT: invoice Step 4 finalize/output safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: invoice Step 4 finalize/output safety PASSED");

mustNotContain("printable invoice", page, '<th class="money">Billed Amount</th>');
mustNotContain("printable invoice", page, '<th class="money">Payment Amount</th>');
