import fs from "node:fs";

const resolver = fs.readFileSync("src/lib/templates/template-builder-live-example-preview.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

let failed = false;
const pass = (message) => console.log("\x1b[32mPASS\x1b[0m:", message);
const fail = (message) => {
  failed = true;
  console.error("\x1b[31mFAIL\x1b[0m:", message);
};

const has = (token, message) => resolver.includes(token) ? pass(message) : fail(message);
const lacks = (token, message) => !resolver.includes(token) ? pass(message) : fail(message);

has("safeRawRows", "Resolver has safe raw SQL helper");
has("catch", "Resolver catches query failures and degrades safely");
has('from "ClaimIndex"', "Resolver reads ClaimIndex source rows");
has('from "Lawsuit"', "Resolver reads Lawsuit source rows");
has('from "ProviderClientInfo"', "Resolver reads ProviderClientInfo source rows");
has('from "ReferenceEntity"', "Resolver reads ReferenceEntity source rows");
has('"master_lawsuit_id"', "Resolver finds child claim rows by master lawsuit id");
has('"masterLawsuitId"', "Resolver finds lawsuit rows by master lawsuit id");
has("directMatterNumber", "Resolver derives direct local matter id from BRL display number");
has("bestProviderRow", "Resolver resolves provider/client metadata from source rows");
has("bestReferenceRow", "Resolver resolves insurer/reference metadata from source rows");
has("hiddenFields", "Resolver reads hidden/source fields only as internal source data");
has("usedPreviewFallback: false", "Resolver does not use preview-only fallback business values");
has('"{{insurer.street}}"', "Resolver exposes clean insurer street token");
has('"{{insurer.city}}"', "Resolver exposes clean insurer city token");
has('"{{insurer.state}}"', "Resolver exposes clean insurer state token");
has('"{{insurer.zipcode}}"', "Resolver exposes clean insurer ZIP token");

for (const forbidden of [
  "PREVIEW_ONLY_FALLBACK_OUTPUTS",
  "Preview Provider",
  "Preview Patient",
  "Preview Insurer",
  "BRL_202600003",
  '"{{insurer.hidden_street}}"',
  '"{{insurer.hidden_city}}"',
  '"{{insurer.hidden_state}}"',
  '"{{insurer.hidden_zipcode}}"',
  '"{{matter.claimNumber}}"',
]) {
  lacks(forbidden, `Resolver excludes obsolete token/path ${forbidden}`);
}

if (pkg.scripts?.["verify:template-builder-live-preview-postgres-resolver"] === "node scripts/verify-template-builder-live-preview-postgres-resolver.mjs") {
  pass("Package has PostgreSQL/source-backed resolver verifier");
} else {
  fail("Package has PostgreSQL/source-backed resolver verifier");
}

if (failed) process.exit(1);
console.log("\nPASS: Template Builder source-backed PostgreSQL resolver verified.");
