import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function fail(message) { console.error(`FAIL: ${message}`); process.exit(1); }
function pass(message) { console.log(`PASS: ${message}`); }
function mustContain(label, text, needle) { if (!text.includes(needle)) fail(`${label} missing ${needle}`); pass(label); }

const route = read("app/api/admin/clients/[id]/invoice/create-preview/route.ts");
const page = read("app/admin/clients/[id]/invoice/page.tsx");
const adminRoute = read("app/api/admin/clients/[id]/route.ts");

mustContain("create-preview has direct provider classifier", route, "function isDirectProviderPaymentTransactionType");
mustContain("create-preview has direct provider line type", route, '"direct_pay_to_provider"');
mustContain("direct provider excluded from principal interest total", route, 'line.lineType === "receipt"');
mustContain("direct provider total tracked", route, "directProviderPaymentTotal");
mustContain("direct provider retainer tracked", route, "directProviderRetainerFeeTotal");
mustContain("base net remit still deducts all retainer fees", route, "const baseNetRemitToProvider = moneyNumber(principalInterestTotal - retainerFeeTotal);");
mustContain("admin route direct provider filter", adminRoute, "transactionTypeFilter === \"direct_pay_to_provider\"");
mustContain("invoice filter has Direct Payments to Provider", page, '<option value="direct_pay_to_provider">Direct Payments to Provider</option>');
mustContain("invoice page has direct provider preview section", page, "Direct Payments to Provider");
mustContain("direct provider remit impact is negative retainer only", page, "if (isDirectProviderPaymentLine(line)) return -Number(line?.retainerFee || 0);");
mustContain("direct provider printable net remit impact", page, "Net Remit Impact");
mustContain("direct provider display normalized", page, 'return "Direct Pay to Provider";');

console.log("PASS: direct provider remittance treatment safety");
