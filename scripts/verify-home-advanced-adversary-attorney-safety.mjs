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

const home = read("app/page.tsx");
const candidates = read("app/api/advanced-search/candidates/route.ts");

console.log("RESULT: verify home advanced adversary attorney safety");

mustContain("AdvancedSearchFields includes adversaryAttorney", home, "adversaryAttorney: string;");
mustContain("empty advanced fields includes adversaryAttorney", home, 'adversaryAttorney: ""');
mustContain("advanced actual values includes adversaryAttorney", home, "adversaryAttorney: supportedFieldValueFromMatter");
mustContain("advanced readback includes adversary attorney", home, '["Adversary Attorney", values.adversaryAttorney]');
mustContain("advanced candidate params include adversaryAttorney", home, '["adversaryAttorney", fields.adversaryAttorney]');
mustContain("home loads adversary reference options", home, "/api/reference-data/options?type=adversary_attorney");
mustContain("advanced UI input uses adversaryAttorney", home, "value={advancedFields.adversaryAttorney}");
mustContain("advanced UI input updates adversaryAttorney", home, 'updateAdvancedField("adversaryAttorney", e.target.value)');
mustContain("advanced UI input uses adversary datalist", home, 'list="barsh-advanced-adversary-attorney-reference-options"');
mustContain("advanced UI has adversary datalist", home, 'datalist id="barsh-advanced-adversary-attorney-reference-options"');
mustContain("advanced matching checks adversaryAttorney", home, "fields.adversaryAttorney");

const courtIndex = home.indexOf("<span style={labelStyle}>Court</span>");
const adversaryIndex = home.indexOf("<span style={labelStyle}>Adversary Attorney</span>");
const dosStartIndex = home.indexOf("<span style={labelStyle}>DOS Start</span>");
if (!(courtIndex >= 0 && adversaryIndex > courtIndex && dosStartIndex > adversaryIndex)) {
  console.error("FAIL: Advanced Search order is not Court, Adversary Attorney, DOS Start");
  process.exitCode = 1;
} else {
  console.log("PASS: Advanced Search order is Court, Adversary Attorney, DOS Start");
}

mustContain("candidate route reads adversaryAttorney param", candidates, 'const adversaryAttorney = clean(params.get("adversaryAttorney"));');
mustContain("candidate route attaches lawsuit metadata", candidates, "attachLocalLawsuitMetadata");
mustContain("candidate route attaches adversary attorney metadata", candidates, "adversary_attorney: lawsuitOptions.adversaryAttorney || null");
mustContain("candidate route filters adversary attorney locally", candidates, "includesText(row.adversaryAttorney || row.adversary_attorney, adversaryAttorney)");
mustContain("candidate route returns finalRows", candidates, "rows: finalRows");
mustContain("candidate route remains read-only", candidates, "noDatabaseRecordsChanged: true");
mustNotContain("candidate route must not call Clio", candidates, "clioFetch");
mustNotContain("candidate route must not use ClaimIndex rebuild wording", candidates, "ClaimIndex rebuild");

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
