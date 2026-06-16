import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function fail(message) { console.error(`FAIL: ${message}`); process.exit(1); }
function pass(message) { console.log(`PASS: ${message}`); }
function mustContain(label, text, needle) { if (!text.includes(needle)) fail(`${label} missing ${needle}`); pass(label); }
function mustNotContain(label, text, needle) { if (text.includes(needle)) fail(`${label} contains forbidden ${needle}`); pass(label); }

const direct = read("app/matter/[id]/page.tsx");
const master = read("app/matters/page.tsx");
const invoice = read("app/admin/clients/[id]/invoice/page.tsx");
const seed = read("scripts/seed-transaction-reference-options.mjs");

const directBlock = direct.slice(direct.indexOf("const paymentTransactionTypeFallbackOptions"), direct.indexOf("const fallbackPaymentTransactionStatusOptions"));
const masterBlock = master.slice(master.indexOf("const fallbackMasterPaymentTransactionTypeOptions"), master.indexOf("const fallbackMasterPaymentTransactionStatusOptions"));

mustContain("direct internal Voluntary Payment option", directBlock, "Voluntary Payment");
mustContain("direct Interest option", directBlock, "Interest");
mustContain("direct internal PreC option", directBlock, "PreC to Provider");
mustContain("direct displays Voluntary", direct, "return \"Voluntary\";");
mustContain("direct displays Direct Pay to Provider", direct, "Direct Pay to Provider");
mustNotContain("direct active dropdown excludes Attorney Fee", directBlock, "Attorney Fee");
mustNotContain("direct active dropdown excludes filing fee", directBlock, "Filing Fee");
mustNotContain("direct active dropdown excludes service fee", directBlock, "Service Fee");
mustNotContain("direct active dropdown excludes court costs", directBlock, "Other Court");
mustNotContain("direct active dropdown excludes collection", directBlock, "Collection Payment");

mustContain("master internal Collection Payment option", masterBlock, "Collection Payment");
mustContain("master Interest option", masterBlock, "Interest");
mustContain("master Index Fee option", masterBlock, "Index Fee");
mustContain("master Service Fee option", masterBlock, "Service Fee");
mustContain("master Other Court Costs option", masterBlock, "Other Court Costs");
mustContain("master internal PreC option", masterBlock, "PreC to Provider");
mustContain("master Attorney Fee option", masterBlock, "Attorney Fee");
mustNotContain("master active dropdown excludes Filing Fee", masterBlock, "Filing Fee");
mustContain("master displays Collection", master, "return \"Collection\";");
mustContain("master displays Direct Pay to Provider pre-suit", master, "Direct Pay to Provider (Pre-suit)");
mustContain("master direct pay requires one child", master, "Select exactly one child matter for Direct Pay to Provider (Pre-suit).");
mustContain("invoice broad cost filter label", invoice, "All Costs Received (Index, Service, Other)");
mustContain("seed keeps Filing Fee as alias only", seed, "\"Filing Fee\", \"Filing Fee Collected\"");
mustNotContain("seed no Filing Fee displayName", seed, "displayName: \"Filing Fee\"");
mustContain("seed Service Fee displayName", seed, "displayName: \"Service Fee\"");
mustContain("seed direct pay aliases", seed, "Direct Pay to Provider (Pre-suit)");

console.log("PASS: payment types clean taxonomy safety");
