#!/usr/bin/env node

import fs from "node:fs";

const failures = [];

const searchRoutePath = "app/api/claim-index/search-grouped/route.ts";
const lawsuitsPagePath = "app/lawsuits/page.tsx";

const searchRoute = fs.readFileSync(searchRoutePath, "utf8");
const lawsuitsPage = fs.readFileSync(lawsuitsPagePath, "utf8");

function mustContain(label, file, src, needle) {
  if (!src.includes(needle)) failures.push(`${file}: ${label}: missing ${needle}`);
}

function mustNotContain(label, file, src, needle) {
  if (src.includes(needle)) failures.push(`${file}: ${label}: forbidden ${needle}`);
}

mustContain("search route selects Clio master matter id", searchRoutePath, searchRoute, "clioMasterMatterId: true");
mustContain("search route selects Clio master display number", searchRoutePath, searchRoute, "clioMasterDisplayNumber: true");
mustContain("search route attaches camel Clio master matter id", searchRoutePath, searchRoute, "clioMasterMatterId: lawsuit.clioMasterMatterId || null");
mustContain("search route attaches snake Clio master matter id", searchRoutePath, searchRoute, "clio_master_matter_id: lawsuit.clioMasterMatterId || null");
mustContain("search route remains local only", searchRoutePath, searchRoute, "noClioRead: true");
mustContain("search route remains no Clio hydration", searchRoutePath, searchRoute, "noClioHydration: true");

mustContain("page has master target href helper", lawsuitsPagePath, lawsuitsPage, "function masterTargetHref(m: Matter)");
mustContain("page target uses local child matter id", lawsuitsPagePath, lawsuitsPage, 'const localMatterId = String(matterId(m) || "").trim();');
mustContain("page target uses local master id as query context", lawsuitsPagePath, lawsuitsPage, 'const localMaster = String(masterId(m) || "").trim();');
mustContain("page links Filing Status when master target exists", lawsuitsPagePath, lawsuitsPage, "href={masterTargetHref(m)}");
mustContain("page link goes to local child matter route with master context", lawsuitsPagePath, lawsuitsPage, "return `/matter/${encodeURIComponent(localMatterId)}?masterLawsuitId=${encodeURIComponent(localMaster)}`;");
mustContain("page preserves search fallback when no Clio mapping", lawsuitsPagePath, lawsuitsPage, "onClick={() => searchLinkedField(\"masterLawsuitId\", masterId(m))}");

mustContain("page has text filter link style", lawsuitsPagePath, lawsuitsPage, "const fieldTextFilterLink: React.CSSProperties = {");
mustContain("text filter link is underlined", lawsuitsPagePath, lawsuitsPage, 'textDecoration: "underline"');
mustContain("text filter link is transparent", lawsuitsPagePath, lawsuitsPage, 'background: "transparent"');

mustContain("patient shows all matching matters", lawsuitsPagePath, lawsuitsPage, 'onClick={() => searchLinkedField("patient", val(m, "patientName", "patient_name"))}');
mustContain("patient title says all matters", lawsuitsPagePath, lawsuitsPage, 'title="Show all matters for this patient"');
mustContain("provider shows all matching matters", lawsuitsPagePath, lawsuitsPage, 'onClick={() => searchLinkedField("provider", val(m, "client_name", "clientName", "provider_name", "providerName"))}');
mustContain("provider title says all matters", lawsuitsPagePath, lawsuitsPage, 'title="Show all matters for this provider"');
mustContain("insurer shows all matching matters", lawsuitsPagePath, lawsuitsPage, 'onClick={() => searchLinkedField("insurer", insurerName(m))}');
mustContain("insurer title says all matters", lawsuitsPagePath, lawsuitsPage, 'title="Show all matters for this insurer"');
mustContain("index shows all matching matters", lawsuitsPagePath, lawsuitsPage, 'onClick={() => searchLinkedField("indexAaaNumber", indexNumber(m))}');
mustContain("index title says all matters", lawsuitsPagePath, lawsuitsPage, 'title="Show all matters for this index number"');

mustNotContain("must not use static inert text for non-target fields", lawsuitsPagePath, lawsuitsPage, "fieldStaticText");
mustNotContain("must not use bubble/static pill style", lawsuitsPagePath, lawsuitsPage, "fieldStaticPill");
const textFilterStyleMatch = lawsuitsPage.match(/const fieldTextFilterLink: React\.CSSProperties = \{[\s\S]*?\n\};/);
const textFilterStyle = textFilterStyleMatch ? textFilterStyleMatch[0] : "";

if (!textFilterStyle) {
  failures.push(`${lawsuitsPagePath}: text filter style block could not be isolated`);
}

if (textFilterStyle.includes('border: "1px solid #cbd5e1"')) {
  failures.push(`${lawsuitsPagePath}: text filter link style must not use pill border`);
}

if (textFilterStyle.includes('background: "#f8fafc"')) {
  failures.push(`${lawsuitsPagePath}: text filter link style must not use pill background`);
}

if (textFilterStyle.includes("borderRadius: 999")) {
  failures.push(`${lawsuitsPagePath}: text filter link style must not use pill radius`);
}
mustNotContain("page must not route Filing Status to Clio master id as ClaimIndex matter", lawsuitsPagePath, lawsuitsPage, "return `/matter/${encodeURIComponent(clioId)}${params}`;");

console.log("RESULT: verify lawsuits master link target safety");
console.log("SEARCH_ROUTE=" + searchRoutePath);
console.log("LAWSUITS_PAGE=" + lawsuitsPagePath);
console.log("EXPECTS_CLIO_MAPPING_ATTACHED_TO_LOCAL_SEARCH_ROWS=YES");
console.log("EXPECTS_FILING_STATUS_TRUE_LINK_WHEN_MAPPED=YES");
console.log("EXPECTS_SEARCH_FALLBACK_WHEN_UNMAPPED=YES");
console.log("EXPECTS_NON_TARGET_FIELDS_TEXT_FILTER_LINKS_SHOW_ALL_MATTERS=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
