import fs from "node:fs";

const routePath = "app/api/documents/packet/route.ts";
const route = fs.readFileSync(routePath, "utf8");

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, needle) {
  if (route.includes(needle)) pass(`${routePath}: found ${label}`);
  else fail(`${routePath}: missing ${label}`);
}

function mustNotContain(label, needle) {
  if (!route.includes(needle)) pass(`${routePath}: does not contain ${label}`);
  else fail(`${routePath}: contains forbidden ${label}`);
}

console.log("=== LOCAL DOCUMENT PACKET SAFETY VERIFICATION ===");

mustContain("documentData contract", "documentData");
mustContain("readyForTemplates true", "readyForTemplates: true");
mustContain("generatesDocuments false", "generatesDocuments: false");
mustContain("localOnly true", "localOnly: true");
mustContain("clioCorrectnessDependency false", "clioCorrectnessDependency: false");
mustContain("templateFields", "templateFields");
mustContain("selectedCourtDetails", "selectedCourtDetails");
mustContain("courtCostsTotal", "courtCostsTotal");
mustContain("treatingProviderNames", "treatingProviderNames");
mustContain("local-only refresh reason", "local-document-packet-no-clio-refresh");
mustContain("local ClaimIndex read", "prisma.claimIndex.findMany");
mustContain("local ReferenceEntity read", "prisma.referenceEntity.findMany");
mustContain("reference details exposure", "hiddenDetails");
mustContain("provider/client reference lookup", "provider_client");
mustContain("patient reference lookup", "patient");
mustContain("insurer reference lookup", "insurer_company");
mustContain("court venue reference lookup", "court_venue");
mustContain("treating provider reference lookup", "treating_provider");

mustNotContain("ingestMattersFromClioBatch", "ingestMattersFromClioBatch");
mustNotContain("indexMatterInternal", "indexMatterInternal");
mustNotContain("forceRefreshOnlyThisLawsuit", "forceRefreshOnlyThisLawsuit");
mustNotContain("Clio refresh warning", "refreshed from Clio");
mustNotContain("refresh.errors dependency", "refresh.errors");
mustNotContain("refresh.seedCount dependency", "refresh.seedCount");
mustNotContain("refresh.refreshedMatterIds dependency", "refresh.refreshedMatterIds");
mustNotContain("clioFetch in packet route", "clioFetch(");

if (failures > 0) {
  console.error(`=== LOCAL DOCUMENT PACKET SAFETY VERIFICATION FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== LOCAL DOCUMENT PACKET SAFETY VERIFICATION PASSED ===");
