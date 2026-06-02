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

mustContain("page has clioMasterMatterId helper", lawsuitsPagePath, lawsuitsPage, "function clioMasterMatterId(m: Matter)");
mustContain("page has clioMasterDisplayNumber helper", lawsuitsPagePath, lawsuitsPage, "function clioMasterDisplayNumber(m: Matter)");
mustContain("page has master target href helper", lawsuitsPagePath, lawsuitsPage, "function masterTargetHref(m: Matter)");
mustContain("page target uses local child matter id", lawsuitsPagePath, lawsuitsPage, "const localMatterId = String(matterId(m) || \"\").trim();");
mustContain("page target uses local master id as query context", lawsuitsPagePath, lawsuitsPage, "const localMaster = String(masterId(m) || \"\").trim();");
mustNotContain("page must not route Filing Status to Clio master id as ClaimIndex matter", lawsuitsPagePath, lawsuitsPage, "return `/matter/${encodeURIComponent(clioId)}${params}`;");
mustContain("page links Filing Status when master target exists", lawsuitsPagePath, lawsuitsPage, "href={masterTargetHref(m)}");
mustContain("page link goes to local child matter route with master context", lawsuitsPagePath, lawsuitsPage, "return `/matter/${encodeURIComponent(localMatterId)}?masterLawsuitId=${encodeURIComponent(localMaster)}`;");
mustContain("page preserves search fallback when no Clio mapping", lawsuitsPagePath, lawsuitsPage, "onClick={() => searchLinkedField(\"masterLawsuitId\", masterId(m))}");
mustContain("page has distinct filter button style", lawsuitsPagePath, lawsuitsPage, "const fieldFilterButton: React.CSSProperties = {");
mustContain("patient filter uses filter style", lawsuitsPagePath, lawsuitsPage, 'title="Filter results by this patient"');
mustContain("provider filter uses filter style", lawsuitsPagePath, lawsuitsPage, 'title="Filter results by this provider"');
mustContain("insurer filter uses filter style", lawsuitsPagePath, lawsuitsPage, 'title="Filter results by this insurer"');
mustContain("index filter uses filter style", lawsuitsPagePath, lawsuitsPage, 'title="Filter results by this index number"');
mustNotContain("patient should not be labeled as navigation/search hyperlink", lawsuitsPagePath, lawsuitsPage, 'title="Search this patient"');
mustNotContain("provider should not be labeled as navigation/search hyperlink", lawsuitsPagePath, lawsuitsPage, 'title="Search this provider"');
mustNotContain("insurer should not be labeled as navigation/search hyperlink", lawsuitsPagePath, lawsuitsPage, 'title="Search this insurer"');
mustNotContain("index should not be labeled as navigation/search hyperlink", lawsuitsPagePath, lawsuitsPage, 'title="Search this index number"');

mustNotContain("Filing Status should not always be search-only", lawsuitsPagePath, lawsuitsPage, "title=\"Search this master lawsuit\"\n                                  >\n                                    {masterId(m)}\n                                  </button>\n                                </>\n                              )");

console.log("RESULT: verify lawsuits master link target safety");
console.log("SEARCH_ROUTE=" + searchRoutePath);
console.log("LAWSUITS_PAGE=" + lawsuitsPagePath);
console.log("EXPECTS_CLIO_MAPPING_ATTACHED_TO_LOCAL_SEARCH_ROWS=YES");
console.log("EXPECTS_FILING_STATUS_TRUE_LINK_WHEN_MAPPED=YES");
console.log("EXPECTS_SEARCH_FALLBACK_WHEN_UNMAPPED=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
