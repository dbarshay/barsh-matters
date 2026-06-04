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

const packet = read("app/api/documents/packet/route.ts");
const matters = read("app/matters/page.tsx");
const metadataRoute = read("app/api/lawsuits/update-metadata/route.ts");

console.log("RESULT: verify adversary attorney document merge-data safety");

mustContain("metadata route stores selected adversary details", metadataRoute, "selectedAdversaryAttorneyDetails");
mustContain("master UI sends selected adversary details", matters, "selectedAdversaryAttorneyDetails = masterInfoSelectedContact?.details || null");
mustContain("master UI reads documentData", matters, "metadata?.documentData");
mustContain("packet route casts locally extended lawsuit metadata", packet, "const lawsuitAny = lawsuit as any;");
mustContain("packet route reads selected adversary details through cast", packet, "lawsuitAny?.selectedAdversaryAttorneyDetails");
mustContain("packet route reads adversary attorney through cast", packet, "lawsuitAny?.adversaryAttorney");
mustContain("packet route derives adversary attorney name", packet, "const adversaryAttorneyName");
mustContain("packet route derives adversary attorney firm name", packet, "const adversaryAttorneyFirmName");
mustContain("packet route exposes adversary attorney template field", packet, "adversaryAttorneyName");
mustContain("packet route exposes adversary attorney firm template field", packet, "adversaryAttorneyFirmName");
mustContain("packet route exposes adversary attorney UI field", packet, "uiAdversaryAttorneyName");
mustContain("packet route exposes adversary attorney reference data", packet, "adversaryAttorneyDetails");
mustNotContain("packet route must not use undefined metadata object for adversary", packet, "metadata?.selectedAdversaryAttorneyDetails");
mustNotContain("packet route must not directly type-access lawsuit selected adversary details optional", packet, "lawsuit?.selectedAdversaryAttorneyDetails");
mustNotContain("packet route must not directly type-access lawsuit selected adversary details plain", packet, "lawsuit.selectedAdversaryAttorneyDetails");
mustNotContain("packet route must not directly type-access lawsuit adversary attorney", packet, "lawsuit?.adversaryAttorney");
mustNotContain("packet route must not call operational Clio matter context", packet, "/api/clio/matter-context");
mustNotContain("packet route must not use ClaimIndex rebuild wording", packet, "ClaimIndex rebuild");

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
