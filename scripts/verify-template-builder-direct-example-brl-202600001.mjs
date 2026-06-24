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

has(buildPage, "BRL_202600001", "Build Template keeps BRL_202600001 direct example option");
has(resolver, "findClaimRowForDirect", "Resolver keeps direct ClaimIndex lookup");
has(resolver, "findClaimRowForDirect", "Resolver uses direct ClaimIndex lookup for BRL example matter");
has(resolver, "isLawsuitContext", "Resolver distinguishes lawsuit/direct context");
has(resolver, "usedPreviewFallback: false", "Resolver reports no preview fallback");

const populatedDirectTokens = [
  "{{matter.fileNumber}}",
  "{{matter.providerName}}",
  "{{matter.patientName}}",
  "{{matter.billedAmount}}",
  "{{claim.number}}",
  "{{claim.dateOfLoss}}",
  "{{claim.dateOfService}}",
  "{{claim.denialReason}}",
  "{{claim.balance}}",
  "{{claim.payments}}",
  "{{insurer.name}}",
  "{{insurer.street}}",
  "{{insurer.city}}",
  "{{insurer.state}}",
  "{{insurer.zipcode}}",
];

for (const token of populatedDirectTokens) {
  has(library, token, `Library keeps direct/source token ${token}`);
  has(resolver, token, `Resolver maps direct/source token ${token}`);
}

const directDashTokens = [
  "{{provider.taxId}}",
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
  "{{lawsuit.amount}}",
  "{{lawsuit.costs}}",
  "{{lawsuit.balance}}",
  "{{cost.indexFee}}",
  "{{cost.serviceFee}}",
  "{{cost.otherCourtCosts}}",
  "{{cost.total}}",
];

for (const token of directDashTokens) {
  has(library, token, `Library keeps dash-capable token ${token}`);
  has(resolver, token, `Resolver maps dash-capable token ${token}`);
}

for (const forbidden of [
  "Angelo Rizzo",
  "05/01/2021",
  "David Barshay",
  "01/16/2021",
  "BRL_202600001",
  "$562.25",
  "Medical Necessity",
]) {
  if (forbidden === "BRL_202600001") {
    has(buildPage, forbidden, "Build page may contain BRL_202600001 as selectable example option");
    lacks(resolver, forbidden, `Resolver does not hard-code direct value ${forbidden}`);
  } else {
    lacks(resolver, forbidden, `Resolver does not hard-code direct value ${forbidden}`);
  }
}

if (pkg.scripts?.["verify:template-builder-direct-example-brl-202600001"] === "node scripts/verify-template-builder-direct-example-brl-202600001.mjs") {
  pass("Package has BRL_202600001 direct example verifier script");
} else {
  fail("Package has BRL_202600001 direct example verifier script");
}

if (failed) {
  console.error("\nTemplate Builder BRL_202600001 direct example verifier failed.");
  process.exit(1);
}

console.log("\nPASS: Template Builder BRL_202600001 direct example static contract verified.");
