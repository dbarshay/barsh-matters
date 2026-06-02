#!/usr/bin/env node

import fs from "node:fs";

const pagePath = "app/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustContain(label, needle) {
  if (!page.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, needle) {
  if (page.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("has URL state type", "type HomeSearchUrlState = {");
mustContain("has URL state parser", "function homeSearchStateFromUrl(): HomeSearchUrlState");
mustContain("reads patient from URL", 'patient: params.get("patient") || ""');
mustContain("reads claim from URL", 'claim: params.get("claim") || ""');
mustContain("reads provider from URL", 'provider: params.get("provider") || ""');
mustContain("reads modal from URL", 'modal: params.get("modal") || ""');
mustContain("has URL builder", "function homeSearchUrlForState(state: HomeSearchUrlState)");
mustContain("restores URL state on popstate", "function applyHomeSearchStateFromUrl()");
mustContain("listens to popstate", 'window.addEventListener("popstate", applyHomeSearchStateFromUrl);');
mustContain("removes popstate listener", 'window.removeEventListener("popstate", applyHomeSearchStateFromUrl);');
mustContain("Back reloads search without pushing", "void runMainCombinedSearch(urlState, { updateUrl: false });");
mustContain("blank URL clears search without pushing", "resetSearch({ updateUrl: false });");
mustContain("runMainCombinedSearch accepts overrides", "overrides: Partial<HomeSearchUrlState> = {}");
mustContain("runMainCombinedSearch accepts URL options", "options: { updateUrl?: boolean; replaceUrl?: boolean } = {}");
mustContain("pushes home search history", "window.history.pushState({ barshMattersHomeSearch: true }, \"\", nextUrl);");
mustContain("replaces home search history", "window.history.replaceState({ barshMattersHomeSearch: true }, \"\", nextUrl);");
mustContain("clear results pushes blank home URL", "window.history.pushState({ barshMattersHomeSearch: true }, \"\", \"/\");");
mustContain("close modal is URL-aware", "function closeHomeResultsModal(options: { updateUrl?: boolean } = {})");
mustContain("results close button uses URL-aware close", "onClick={() => closeHomeResultsModal()}");

mustNotContain("old initial targeted URL effect should not remain", "void runTargetedSuggestionSearch(patient, \"Patient\");");

console.log("RESULT: verify Home search browser history safety");
console.log("PAGE=" + pagePath);
console.log("EXPECTS_HOME_SEARCH_STATE_IN_URL=YES");
console.log("EXPECTS_BROWSER_BACK_RESTORES_HOME_SEARCH_RESULTS=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
