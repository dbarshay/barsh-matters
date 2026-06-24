import fs from "node:fs";

const resolver = fs.readFileSync("src/lib/templates/template-builder-live-example-preview.ts", "utf8");
const library = fs.readFileSync("src/lib/templates/template-builder-merge-field-library.ts", "utf8");
const buildPage = fs.readFileSync("app/admin/document-templates/build/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

let failed = false;
const pass = (message) => console.log("\x1b[32mPASS\x1b[0m:", message);
const fail = (message) => {
  failed = true;
  console.error("\x1b[31mFAIL\x1b[0m:", message);
};

const has = (source, token, message) => source.includes(token) ? pass(message) : fail(message);
const lacks = (source, token, message) => !source.includes(token) ? pass(message) : fail(message);

const approvedTokens = [
  "{{insurer.street}}",
  "{{insurer.city}}",
  "{{insurer.state}}",
  "{{insurer.zipcode}}",
  "{{provider.taxId}}",
  "{{claim.number}}",
  "{{lawsuit.adversaryAttorney}}",
  "{{adversaryAttorney.street}}",
  "{{adversaryAttorney.city}}",
  "{{adversaryAttorney.state}}",
  "{{adversaryAttorney.zipcode}}",
];

for (const token of approvedTokens) {
  has(library, token, `Merge-field library keeps approved token ${token}`);
  has(resolver, token, `Resolver maps approved token ${token}`);
}

const retiredUserFacingTokens = [
  "{{insurer.hidden_street}}",
  "{{insurer.hidden_city}}",
  "{{insurer.hidden_state}}",
  "{{insurer.hidden_zipcode}}",
  "{{matter.claimNumber}}",
];

for (const token of retiredUserFacingTokens) {
  lacks(library, token, `Merge-field library excludes retired token ${token}`);
  lacks(buildPage, token, `Build Template UI excludes retired token ${token}`);
}

has(resolver, "hidden_street", "Resolver may read hidden street source fields internally");
has(resolver, "hidden_city", "Resolver may read hidden city source fields internally");
has(resolver, "hidden_state", "Resolver may read hidden state source fields internally");
has(resolver, "hidden_zipcode", "Resolver may read hidden ZIP source fields internally");

lacks(resolver, "{{insurer.hidden_street}}", "Resolver does not expose retired hidden street token");
lacks(resolver, "{{insurer.hidden_city}}", "Resolver does not expose retired hidden city token");
lacks(resolver, "{{insurer.hidden_state}}", "Resolver does not expose retired hidden state token");
lacks(resolver, "{{insurer.hidden_zipcode}}", "Resolver does not expose retired hidden ZIP token");
lacks(resolver, "{{matter.claimNumber}}", "Resolver excludes duplicative matter claim-number token");

for (const forbidden of [
  "PREVIEW-",
  "Preview Provider",
  "Preview Patient",
  "Preview Court",
  "Preview Insurer",
  "BRL_202600003",
  "Atlantic Medical & Diagnostic",
  "ATLANTIC MEDICAL & DIAGNOSTIC",
  "Allstate",
  "David Barshay",
  "Angelo Rizzo",
  "123444/2026",
  "1111/2025",
  "Martyn, Smith",
  "Rothenberg",
  "1 Main Street",
  "Suite 1",
  "Bronx",
  "10000",
]) {
  lacks(resolver, forbidden, `Resolver has no hard-coded runtime business value ${forbidden}`);
}

has(resolver, 'from "ClaimIndex"', "Resolver reads ClaimIndex source rows");
has(resolver, 'from "Lawsuit"', "Resolver reads Lawsuit source rows");
has(resolver, 'from "ProviderClientInfo"', "Resolver reads ProviderClientInfo source rows");
has(resolver, 'from "ReferenceEntity"', "Resolver reads ReferenceEntity source rows");
has(resolver, "usedPreviewFallback: false", "Resolver has no preview-only business fallback path");
has(resolver, 'hiddenValue(adversaryRow, "hidden_street")', "Resolver reads adversary street from source hidden field");
has(resolver, 'hiddenValue(adversaryRow, "hidden_city")', "Resolver reads adversary city from source hidden field");
has(resolver, 'hiddenValue(adversaryRow, "hidden_state")', "Resolver reads adversary state from source hidden field");
has(resolver, 'hiddenValue(adversaryRow, "hidden_zipcode")', "Resolver reads adversary ZIP from source hidden field");

if (pkg.scripts?.["verify:template-builder-source-backed-field-values"] === "node scripts/verify-template-builder-source-backed-field-values.mjs") {
  pass("Package has source-backed field verifier script");
} else {
  fail("Package has source-backed field verifier script");
}

if (failed) process.exit(1);
console.log("\nPASS: Template Builder source-backed field value contract verified.");
