#!/usr/bin/env node

import fs from "node:fs";

const pagePath = "app/admin/reference-data/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustContain(label, needle) {
  if (!page.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, needle) {
  if (page.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("has URL state type", "type ReferenceDataUrlState = {");
mustContain("has URL state parser", "function referenceDataStateFromUrl(): ReferenceDataUrlState");
mustContain("reads type from URL", 'type: params.get("type") || "individual"');
mustContain("reads query from URL", 'q: params.get("q") || ""');
mustContain("reads active from URL", 'active: params.get("active") || "all"');
mustContain("reads selected row from URL", 'selectedRowId: params.get("selectedRowId") || ""');
mustContain("has URL builder", "function referenceDataUrlForState(state: ReferenceDataUrlState)");
mustContain("loadRows has URL options", "options: { updateUrl?: boolean; replaceUrl?: boolean; selectedRowId?: string } = {}");
mustContain("pushes reference-data history", "window.history.pushState({ barshMattersReferenceDataSearch: true }, \"\", nextUrl);");
mustContain("replaces reference-data history", "window.history.replaceState({ barshMattersReferenceDataSearch: true }, \"\", nextUrl);");
mustContain("Back reloads without pushing", "void loadRows(urlState.type, urlState.q, urlState.active, {");
mustContain("listens to popstate", 'window.addEventListener("popstate", applyReferenceDataStateFromUrl);');
mustContain("removes popstate listener", 'window.removeEventListener("popstate", applyReferenceDataStateFromUrl);');
mustContain("row selection pushes history", "selectedRowId: row.id");

mustNotContain("old selectedType effect should not remain", "}, [selectedType, activeFilter]);");

console.log("RESULT: verify Reference Data browser history safety");
console.log("PAGE=" + pagePath);
console.log("EXPECTS_REFERENCE_DATA_SEARCH_STATE_IN_URL=YES");
console.log("EXPECTS_BROWSER_BACK_RESTORES_REFERENCE_DATA_LIST=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
