import fs from "node:fs";

const resolverPath = "src/lib/templates/template-builder-live-example-preview.ts";
const routePath = "app/api/admin/document-templates/example-preview/route.ts";
const resolver = fs.readFileSync(resolverPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

let failed = false;
const pass = (message) => console.log("\x1b[32mPASS\x1b[0m:", message);
const fail = (message) => {
  failed = true;
  console.error("\x1b[31mFAIL\x1b[0m:", message);
};

const has = (source, token, message) => source.includes(token) ? pass(message) : fail(message);
const lacks = (source, token, message) => !source.includes(token) ? pass(message) : fail(message);

has(route, "resolveTemplateBuilderExamplePreview", "API route calls source-backed resolver");
has(route, "searchParams.get", "API route reads matter search param");
has(route, "NextResponse.json", "API route returns JSON");

has(resolver, "export async function resolveTemplateBuilderExamplePreview", "Live resolver exports resolveTemplateBuilderExamplePreview");
has(resolver, 'from "ClaimIndex"', "Live resolver reads ClaimIndex source rows");
has(resolver, 'from "Lawsuit"', "Live resolver reads Lawsuit source rows");
has(resolver, 'from "ProviderClientInfo"', "Live resolver reads ProviderClientInfo source rows");
has(resolver, 'from "ReferenceEntity"', "Live resolver reads ReferenceEntity source rows");
has(resolver, "findClaimRowsForLawsuit", "Live resolver has lawsuit claim-row lookup");
has(resolver, "findClaimRowForDirect", "Live resolver has direct matter lookup");
has(resolver, "bestProviderRow", "Live resolver resolves provider/client display source");
has(resolver, "bestReferenceRow", "Live resolver resolves reference-source rows");
has(resolver, "taxIdFromRow", "Live resolver keeps provider tax ID source resolution");
has(resolver, "hiddenFields", "Live resolver can read hidden/import source fields internally");

const keptTokens = [
  "{{matter.fileNumber}}",
  "{{matter.providerName}}",
  "{{matter.patientName}}",
  "{{matter.billedAmount}}",
  "{{provider.taxId}}",
  "{{insurer.name}}",
  "{{insurer.street}}",
  "{{insurer.city}}",
  "{{insurer.state}}",
  "{{insurer.zipcode}}",
  "{{claim.number}}",
  "{{claim.dateOfLoss}}",
  "{{claim.dateOfService}}",
  "{{claim.denialReason}}",
  "{{claim.balance}}",
  "{{claim.payments}}",
  "{{lawsuit.indexNumber}}",
  "{{lawsuit.court}}",
  "{{lawsuit.adversaryAttorney}}",
  "{{adversaryAttorney.street}}",
  "{{adversaryAttorney.city}}",
  "{{adversaryAttorney.state}}",
  "{{adversaryAttorney.zipcode}}",
  "{{lawsuit.dateFiled}}",
  "{{lawsuit.amount}}",
  "{{lawsuit.costs}}",
  "{{lawsuit.balance}}",
  "{{cost.indexFee}}",
  "{{cost.serviceFee}}",
  "{{cost.otherCourtCosts}}",
  "{{cost.total}}",
];

for (const token of keptTokens) {
  has(resolver, token, `Live resolver maps kept token ${token}`);
}

for (const token of [
  "{{patient.lastName}}",
  "{{provider.hidden_street}}",
  "{{provider.hidden_city}}",
  "{{provider.hidden_state}}",
  "{{provider.hidden_zipcode}}",
  "{{matter.dateOfService}}",
  "{{claim.dosStart}}",
  "{{claim.dosEnd}}",
  "{{treatingProvider.name}}",
  "{{claim.amount}}",
  "{{matter.claimNumber}}",
  "{{insurer.hidden_street}}",
  "{{insurer.hidden_city}}",
  "{{insurer.hidden_state}}",
  "{{insurer.hidden_zipcode}}",
]) {
  lacks(resolver, token, `Live resolver excludes removed/deleted token ${token}`);
}

has(resolver, "providerTaxIdResolved", "Live resolver reports provider tax ID resolution status");
has(resolver, "insurerAddressResolved", "Live resolver reports insurer address resolution status");
has(resolver, "lawsuitResolved", "Live resolver reports lawsuit diagnostics");
has(resolver, "costResolved", "Live resolver reports cost diagnostics");
has(resolver, "usedPreviewFallback: false", "Live resolver has no preview-only fallback business path");
has(resolver, 'hiddenValue(adversaryRow, "hidden_street")', "Live resolver reads adversary street from source hidden field");
has(resolver, 'hiddenValue(adversaryRow, "hidden_city")', "Live resolver reads adversary city from source hidden field");
has(resolver, 'hiddenValue(adversaryRow, "hidden_state")', "Live resolver reads adversary state from source hidden field");
has(resolver, 'hiddenValue(adversaryRow, "hidden_zipcode")', "Live resolver reads adversary ZIP from source hidden field");

for (const forbidden of [
  "PREVIEW_ONLY_FALLBACK_OUTPUTS",
  "Preview Provider",
  "Preview Patient",
  "Preview Insurer",
  "BRL_202600003",
  "Atlantic Medical & Diagnostic",
  "ATLANTIC MEDICAL & DIAGNOSTIC",
  "Allstate",
  "David Barshay",
  "Angelo Rizzo",
  "1 Main Street",
  "Suite 1",
  "Bronx",
  "10000",
]) {
  lacks(resolver, forbidden, `Live resolver has no hard-coded business value ${forbidden}`);
}

if (pkg.scripts?.["verify:template-builder-live-example-preview-server"] === "node scripts/verify-template-builder-live-example-preview-server.mjs") {
  pass("Package has server verifier script");
} else {
  fail("Package has server verifier script");
}

if (failed) {
  console.error("\nTemplate Builder live example preview server checks failed.");
  process.exit(1);
}

console.log("\nPASS: Template Builder live example preview server wiring aligned with source-backed resolver.");
