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

const lawsuits = read("app/lawsuits/page.tsx");
const grouped = read("app/api/claim-index/search-grouped/route.ts");

console.log("RESULT: verify adversary attorney clickable table/export safety");

mustContain("lawsuits page has adversary helper", lawsuits, "function adversaryAttorneyName");
mustContain("lawsuits page exports adversary attorney column", lawsuits, '"Adversary Attorney"');
mustContain("lawsuits page exports adversary attorney cell", lawsuits, "safeExportCell(adversaryAttorneyName(matter))");
mustContain(
  "lawsuits result table places adversary between court and filing status",
  lawsuits,
  'sortableHeader("Court", "court")}</th>\n                        <th style={th}>{sortableHeader("Adversary Attorney", "adversaryAttorney")}</th>\n                        <th style={th}>{sortableHeader("Filing Status", "filingStatus")'
);
mustContain("lawsuits result adversary value is clickable", lawsuits, 'searchLinkedField("adversaryAttorney", adversaryAttorneyName(m))');
mustContain("lawsuits result adversary link title exists", lawsuits, "Show all matters for this adversary attorney");
mustContain("lawsuits sends adversary query param only through linked search", lawsuits, 'params.set("adversaryAttorney", nextAdversaryAttorney.trim())');

mustNotContain("lawsuits page must not have adversary search state", lawsuits, 'const [adversaryAttorney, setAdversaryAttorney] = useState("")');
mustNotContain("lawsuits page must not have adversary reference options state", lawsuits, "adversaryAttorneyReferenceOptions");
mustNotContain("lawsuits page must not load adversary reference options for top search", lawsuits, "/api/reference-data/options?type=adversary_attorney");
mustNotContain("lawsuits page must not render adversary search datalist", lawsuits, "barsh-lawsuit-adversary-attorney-reference-options");

mustContain("search-grouped selects lawsuitOptions", grouped, "lawsuitOptions: true");
mustContain("search-grouped attaches adversary attorney metadata from lawsuitOptions", grouped, "adversary_attorney: lawsuitOptions.adversaryAttorney || null");
mustContain("search-grouped accepts adversary linked filter", grouped, 'const adversaryAttorneyFilter = clean(req.nextUrl.searchParams.get("adversaryAttorney"));');
mustContain("search-grouped filters adversary attorney locally", grouped, "includesText(row.adversaryAttorney || row.adversary_attorney, adversaryAttorneyFilter)");
mustContain("search-grouped remains local-only", grouped, 'source: "claim-index-local-only"');
mustContain("search-grouped remains no Clio hydration", grouped, "noClioHydration: true");
mustNotContain("search-grouped must not call Clio fetch", grouped, "clioFetch");
mustNotContain("search-grouped must not call Clio token", grouped, "getValidClioAccessToken");
mustNotContain("search-grouped must not use ClaimIndex rebuild wording", grouped, "ClaimIndex rebuild");

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
