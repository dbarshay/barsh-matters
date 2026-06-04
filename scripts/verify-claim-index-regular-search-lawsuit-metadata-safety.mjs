#!/usr/bin/env node
import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL: ${label} missing ${needle}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) {
    console.error(`FAIL: ${label} unexpectedly contains ${needle}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const helper = read("lib/claimIndexLawsuitMetadata.ts");
const routes = [
  "app/api/claim-index/by-patient/route.ts",
  "app/api/claim-index/by-provider/route.ts",
  "app/api/claim-index/by-claim/route.ts",
  "app/api/claim-index/by-master/route.ts",
  "app/api/claim-index/search/route.ts",
  "app/api/claim-index/by-matter/route.ts",
];

console.log("RESULT: verify regular ClaimIndex search lawsuit metadata enrichment");

mustContain("helper parses lawsuit child matter ids", helper, "parseMatterIdsFromLawsuitMatters");
mustContain("helper selects local lawsuit rows", helper, "prisma.lawsuit.findMany");
mustContain("helper selects venue", helper, "venue: true");
mustContain("helper selects venueSelection", helper, "venueSelection: true");
mustContain("helper selects venueOther", helper, "venueOther: true");
mustContain("helper selects lawsuit options", helper, "lawsuitOptions: true");
mustContain("helper attaches court_venue", helper, "court_venue: courtVenue");
mustContain("helper attaches court", helper, "court: courtVenue");
mustContain("helper attaches adversary attorney", helper, "adversary_attorney: lawsuitOptions.adversaryAttorney");
mustContain("helper attaches master lawsuit id", helper, "master_lawsuit_id:");

for (const routePath of routes) {
  const route = read(routePath);
  mustContain(`${routePath} imports metadata helper`, route, "attachLocalLawsuitMetadataToClaimRows");
  mustContain(`${routePath} enriches rows`, route, "attachLocalLawsuitMetadataToClaimRows(");
  mustNotContain(`${routePath} must not call Clio`, route, "clioFetch");
  mustNotContain(`${routePath} must not use ClaimIndex rebuild wording`, route, "ClaimIndex rebuild");
}

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
