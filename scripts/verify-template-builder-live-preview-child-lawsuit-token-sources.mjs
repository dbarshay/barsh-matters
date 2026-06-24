import fs from "node:fs";

const resolver = fs.readFileSync("src/lib/templates/template-builder-live-example-preview.ts", "utf8");
const library = fs.readFileSync("src/lib/templates/template-builder-merge-field-library.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

let failed = false;
const pass = (message) => console.log("\x1b[32mPASS\x1b[0m:", message);
const fail = (message) => {
  failed = true;
  console.error("\x1b[31mFAIL\x1b[0m:", message);
};

const has = (source, token, message) => source.includes(token) ? pass(message) : fail(message);
const lacks = (source, token, message) => !source.includes(token) ? pass(message) : fail(message);

for (const token of [
  "{{treatingProvider.name}}",
  "{{claim.amount}}",
  "{{matter.claimNumber}}",
  "{{lawsuit.court}}",
  "{{insurer.hidden_street}}",
  "{{insurer.hidden_city}}",
  "{{insurer.hidden_state}}",
  "{{insurer.hidden_zipcode}}",
]) {
  lacks(library, token, `Library excludes deleted/retired token ${token}`);
  lacks(resolver, token, `Resolver excludes deleted/retired token ${token}`);
}

has(resolver, "findLawsuit", "Resolver detects lawsuit context by Lawsuit source row");
has(resolver, '"masterLawsuitId"', "Resolver looks up lawsuit by master lawsuit id");
has(resolver, "findClaimRowsForLawsuit", "Resolver finds child claim rows for lawsuit context");
has(resolver, '"master_lawsuit_id"', "Resolver links child ClaimIndex rows by master_lawsuit_id");
has(resolver, "findClaimRowForDirect", "Resolver finds direct/non-lawsuit ClaimIndex row");
has(resolver, "directMatterNumber", "Resolver derives direct local matter id from BRL display number");

has(resolver, '"{{matter.billedAmount}}": isLawsuitContext ? DASH : money', "matter.billedAmount renders dash for lawsuit context and money for direct context");
has(resolver, '"{{claim.balance}}": isLawsuitContext ? DASH : money', "claim.balance renders dash for lawsuit context and money for direct context");
has(resolver, '"{{claim.payments}}": isLawsuitContext ? DASH : money', "claim.payments renders dash for lawsuit context and money for direct context");

has(resolver, 'rowValue(claimRow, ["claim_amount", "balance_presuit"])', "matter.billedAmount can use child claim amount/balance_presuit");
has(resolver, 'rowValue(claimRow, ["balance_amount", "balance_presuit"])', "claim.balance can use child balance amount");
has(resolver, 'rowValue(claimRow, ["payment_amount", "payment_voluntary"])', "claim.payments can use child payment amount");

for (const token of [
  "{{insurer.street}}",
  "{{insurer.city}}",
  "{{insurer.state}}",
  "{{insurer.zipcode}}",
]) {
  has(library, token, `Library keeps clean insurer source token ${token}`);
  has(resolver, token, `Resolver maps clean insurer source token ${token}`);
}

has(resolver, "hiddenValue(insurerRow, \"hidden_street\")", "Resolver reads insurer street from hidden source field internally");
has(resolver, "hiddenValue(insurerRow, \"hidden_city\")", "Resolver reads insurer city from hidden source field internally");
has(resolver, "hiddenValue(insurerRow, \"hidden_state\")", "Resolver reads insurer state from hidden source field internally");
has(resolver, "hiddenValue(insurerRow, \"hidden_zipcode\")", "Resolver reads insurer ZIP from hidden source field internally");

for (const token of [
  "{{lawsuit.indexNumber}}",
    "{{court.name}}",
  "{{court.longName1}}",
  "{{court.longName2}}",
  "{{court.street}}",
  "{{court.city}}",
  "{{court.state}}",
  "{{court.zipcode}}",
  "{{lawsuit.adversaryAttorney}}",
  "{{adversaryAttorney.street}}",
  "{{adversaryAttorney.city}}",
  "{{adversaryAttorney.state}}",
  "{{adversaryAttorney.zipcode}}",
  "{{lawsuit.dateFiled}}",
  "{{lawsuit.costs}}",
  "{{lawsuit.balance}}",
  "{{cost.indexFee}}",
  "{{cost.serviceFee}}",
  "{{cost.otherCourtCosts}}",
  "{{cost.total}}",
]) {
  has(resolver, token, `Resolver maps lawsuit/cost token ${token}`);
}

has(resolver, "taxIdFromRow", "Resolver has provider tax ID resolver");
has(resolver, "providerTaxIdResolved", "Resolver reports provider tax ID resolution status");
has(resolver, "insurerAddressResolved", "Resolver reports insurer address resolution status");
has(resolver, 'detailValue(courtRow, "addressStreet")', "Resolver reads court street from court venue details");
has(resolver, 'detailValue(courtRow, "city")', "Resolver reads court city from court venue details");
has(resolver, 'detailValue(courtRow, "state")', "Resolver reads court state from court venue details");
has(resolver, 'hiddenValue(adversaryRow, "hidden_street")', "Resolver reads adversary street from hidden source field internally");
has(resolver, 'hiddenValue(adversaryRow, "hidden_city")', "Resolver reads adversary city from hidden source field internally");
has(resolver, 'hiddenValue(adversaryRow, "hidden_state")', "Resolver reads adversary state from hidden source field internally");
has(resolver, 'hiddenValue(adversaryRow, "hidden_zipcode")', "Resolver reads adversary ZIP from hidden source field internally");
has(resolver, "usedPreviewFallback: false", "Resolver uses no hard-coded preview fallback");

if (pkg.scripts?.["verify:template-builder-live-preview-child-lawsuit-token-sources"] === "node scripts/verify-template-builder-live-preview-child-lawsuit-token-sources.mjs") {
  pass("Package has child/lawsuit source verifier script");
} else {
  fail("Package has child/lawsuit source verifier script");
}

if (failed) {
  console.error("\nChild/lawsuit token source checks failed.");
  process.exit(1);
}

console.log("\nPASS: Template Builder child/lawsuit token source semantics verified for source-backed resolver.");
