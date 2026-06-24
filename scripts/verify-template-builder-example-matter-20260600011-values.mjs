import fs from "node:fs";

const buildPagePath = "app/admin/document-templates/build/page.tsx";
const resolverPath = "src/lib/templates/template-builder-live-example-preview.ts";
const libraryPath = "src/lib/templates/template-builder-merge-field-library.ts";
const pkgPath = "package.json";

const buildPage = fs.readFileSync(buildPagePath, "utf8");
const resolver = fs.readFileSync(resolverPath, "utf8");
const library = fs.readFileSync(libraryPath, "utf8");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

let failed = false;
const pass = (message) => console.log("\x1b[32mPASS\x1b[0m:", message);
const fail = (message) => {
  failed = true;
  console.error("\x1b[31mFAIL\x1b[0m:", message);
};

const has = (source, token, message) => source.includes(token) ? pass(message) : fail(message);
const lacks = (source, token, message) => !source.includes(token) ? pass(message) : fail(message);

has(buildPage, "2026.06.00011", "Build Template keeps 2026.06.00011 lawsuit example option");
has(resolver, "findClaimRowsForLawsuit", "Resolver keeps lawsuit child-row lookup");
has(resolver, 'from "Lawsuit"', "Resolver reads Lawsuit source rows");
has(resolver, "bestReferenceRow", "Resolver keeps ReferenceEntity source lookup");
has(resolver, "usedPreviewFallback: false", "Resolver reports no preview fallback");

const populatedTokens = [
  "{{matter.fileNumber}}",
  "{{matter.providerName}}",
  "{{matter.patientName}}",
  "{{claim.number}}",
  "{{claim.dateOfLoss}}",
  "{{insurer.name}}",
  "{{insurer.street}}",
  "{{insurer.city}}",
  "{{insurer.state}}",
  "{{insurer.zipcode}}",
  "{{lawsuit.indexNumber}}",
  "{{court.name}}",
  "{{court.longName1}}",
  "{{court.longName2}}",
  "{{court.street}}",
  "{{court.city}}",
  "{{court.state}}",
  "{{lawsuit.adversaryAttorney}}",
  "{{lawsuit.dateFiled}}",
  "{{lawsuit.amount}}",
  "{{lawsuit.balance}}",
];

const dashTokens = [
  "{{provider.taxId}}",
  "{{matter.billedAmount}}",
  "{{claim.dateOfService}}",
  "{{claim.denialReason}}",
  "{{claim.balance}}",
  "{{claim.payments}}",
  "{{court.zipcode}}",
  "{{adversaryAttorney.street}}",
  "{{adversaryAttorney.city}}",
  "{{adversaryAttorney.state}}",
  "{{adversaryAttorney.zipcode}}",
  "{{lawsuit.costs}}",
  "{{cost.indexFee}}",
  "{{cost.serviceFee}}",
  "{{cost.otherCourtCosts}}",
  "{{cost.total}}",
];

for (const token of [...populatedTokens, ...dashTokens]) {
  has(library, token, `Library keeps token ${token}`);
  has(resolver, token, `Resolver maps token ${token}`);
}

lacks(library, "{{lawsuit.court}}", "Library excludes removed duplicate {{lawsuit.court}}");
lacks(resolver, "{{lawsuit.court}}", "Resolver excludes removed duplicate {{lawsuit.court}}");

for (const forbidden of [
  "David Barshay",
  "Angelo Rizzo",
  "Atlantic Medical & Diagnostic",
  "Allstate Indemnity Company",
  "3100 Sanders Road",
  "123444/2026",
  "Nassau District- Hempstead",
  "District Court of the County of Nassau",
  "Second District: Hempstead",
  "99 Main Street",
  "Martyn, Smith",
  "$1,261.75",
]) {
  lacks(resolver, forbidden, `Resolver does not hard-code 2026.06.00011 preview value ${forbidden}`);
}

if (pkg.scripts?.["verify:template-builder-example-matter-20260600011-values"] === "node scripts/verify-template-builder-example-matter-20260600011-values.mjs") {
  pass("Package has 2026.06.00011 value verifier script");
} else {
  fail("Package has 2026.06.00011 value verifier script");
}

if (failed) {
  console.error("\nTemplate Builder 2026.06.00011 value verifier failed.");
  process.exit(1);
}

console.log("\nPASS: Template Builder 2026.06.00011 static value contract verified.");
