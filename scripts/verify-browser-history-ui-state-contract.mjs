#!/usr/bin/env node

import fs from "node:fs";

const contractPath = "BARSH_MATTERS_BROWSER_HISTORY_STATE_CONTRACT.txt";
const lawsuitsPath = "app/lawsuits/page.tsx";
const matterPagePath = "app/matter/[id]/page.tsx";
const mattersPagePath = "app/matters/page.tsx";
const adminTicklersPagePath = "app/admin/ticklers/page.tsx";
const referenceDataPagePath = "app/admin/reference-data/page.tsx";
const adminTicklerRunnerPagePath = "app/admin/ticklers/runner/page.tsx";
const documentTemplatesPagePath = "app/admin/document-templates/page.tsx";
const homePagePath = "app/page.tsx";

const contract = fs.readFileSync(contractPath, "utf8");
const lawsuits = fs.readFileSync(lawsuitsPath, "utf8");
const matterPage = fs.readFileSync(matterPagePath, "utf8");
const mattersPage = fs.readFileSync(mattersPagePath, "utf8");
const adminTicklersPage = fs.readFileSync(adminTicklersPagePath, "utf8");
const referenceDataPage = fs.readFileSync(referenceDataPagePath, "utf8");
const adminTicklerRunnerPage = fs.readFileSync(adminTicklerRunnerPagePath, "utf8");
const documentTemplatesPage = fs.readFileSync(documentTemplatesPagePath, "utf8");
const homePage = fs.readFileSync(homePagePath, "utf8");

const failures = [];

function mustContain(label, src, needle) {
  if (!src.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, src, needle) {
  if (src.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("contract states Back/Forward rule", contract, "Browser Back/Forward must restore the active page state");
mustContain("contract requires URL query parameters", contract, "Search/filter state should be represented in URL query parameters");
mustContain("contract covers all pages", contract, "This rule applies across Barsh Matters pages");

mustContain("/lawsuits has URL parser", lawsuits, "function lawsuitsSearchStateFromUrl()");
mustContain("/lawsuits reads claim from URL", lawsuits, 'claim: params.get("claim") || ""');
mustContain("/lawsuits reads patient from URL", lawsuits, 'patient: params.get("patient") || ""');
mustContain("/lawsuits reads provider from URL", lawsuits, 'provider: params.get("provider") || ""');
mustContain("/lawsuits reads insurer from URL", lawsuits, 'insurer: params.get("insurer") || ""');
mustContain("/lawsuits reads index from URL", lawsuits, 'indexAaaNumber: params.get("indexAaaNumber") || ""');
mustContain("/lawsuits reads master from URL", lawsuits, 'masterLawsuitId: params.get("masterLawsuitId") || ""');

mustContain("/lawsuits search accepts URL options", lawsuits, "options: { updateUrl?: boolean; replaceUrl?: boolean } = {}");
mustContain("/lawsuits pushes history", lawsuits, "window.history.pushState({ barshMattersLawsuitsSearch: true }, \"\", nextUrl);");
mustContain("/lawsuits replaces history", lawsuits, "window.history.replaceState({ barshMattersLawsuitsSearch: true }, \"\", nextUrl);");
mustContain("/lawsuits listens to popstate", lawsuits, 'window.addEventListener("popstate", applySearchFromUrl);');
mustContain("/lawsuits removes popstate listener", lawsuits, 'window.removeEventListener("popstate", applySearchFromUrl);');
mustContain("/lawsuits Back reloads without pushing new URL", lawsuits, "void search(urlState, { updateUrl: false });");
mustContain("/lawsuits blank URL clears groups", lawsuits, "setGroups([]);");
mustContain("/lawsuits blank URL resets searched", lawsuits, "setSearched(false);");

mustNotContain("/lawsuits filter links should not use full page navigation", lawsuits, "window.location.href = `/lawsuits?");

mustContain("/matter has tab URL parser", matterPage, "function matterWorkspaceTabFromUrl(): MatterWorkspaceTab");
mustContain("/matter reads tab from URL", matterPage, 'new URLSearchParams(window.location.search).get("tab")');
mustContain("/matter writes tab to URL", matterPage, 'url.searchParams.set("tab", tab);');
mustContain("/matter pushes tab history", matterPage, "window.history.pushState({ barshMattersMatterTab: true }, \"\", nextUrl);");
mustContain("/matter listens to popstate", matterPage, 'window.addEventListener("popstate", applyMatterTabFromUrl);');
mustContain("/matter restores tab from URL", matterPage, "setActiveWorkspaceTabState(matterWorkspaceTabFromUrl());");

mustContain("/matters has master tab URL parser", mattersPage, "function masterWorkspaceTabFromUrl(): MasterWorkspaceTab");
mustContain("/matters reads tab from URL", mattersPage, 'new URLSearchParams(window.location.search).get("tab")');
mustContain("/matters writes tab to URL", mattersPage, 'url.searchParams.set("tab", tab);');
mustContain("/matters pushes tab history", mattersPage, "window.history.pushState({ barshMattersMattersMasterTab: true }, \"\", nextUrl);");
mustContain("/matters listens to popstate", mattersPage, 'window.addEventListener("popstate", applyMasterWorkspaceTabFromUrl);');
mustContain("/matters restores tab from URL", mattersPage, "setActiveMasterWorkspaceTabState(masterWorkspaceTabFromUrl());");

mustContain("/admin/ticklers has URL parser", adminTicklersPage, "function adminTicklerSearchStateFromUrl(): AdminTicklerSearchState");
mustContain("/admin/ticklers reads status from URL", adminTicklersPage, 'const status = params.get("status") === "completed" ? "completed" : "open";');
mustContain("/admin/ticklers pushes search history", adminTicklersPage, "window.history.pushState({ barshMattersAdminTicklersSearch: true }, \"\", nextUrl);");
mustContain("/admin/ticklers listens to popstate", adminTicklersPage, 'window.addEventListener("popstate", applyAdminTicklerSearchFromUrl);');
mustContain("/admin/ticklers restores from URL", adminTicklersPage, "void loadTicklers(urlState, { updateUrl: false });");

mustContain("/admin/reference-data has URL parser", referenceDataPage, "function referenceDataStateFromUrl(): ReferenceDataUrlState");
mustContain("/admin/reference-data reads selected type from URL", referenceDataPage, 'type: params.get("type") || "individual"');
mustContain("/admin/reference-data pushes search history", referenceDataPage, "window.history.pushState({ barshMattersReferenceDataSearch: true }, \"\", nextUrl);");
mustContain("/admin/reference-data listens to popstate", referenceDataPage, 'window.addEventListener("popstate", applyReferenceDataStateFromUrl);');
mustContain("/admin/reference-data restores from URL", referenceDataPage, "void loadRows(urlState.type, urlState.q, urlState.active, {");

mustContain("/admin/ticklers/runner has URL parser", adminTicklerRunnerPage, "function adminTicklerRunnerStateFromUrl(): AdminTicklerRunnerUrlState");
mustContain("/admin/ticklers/runner reads kind from URL", adminTicklerRunnerPage, 'kind: params.get("kind") || "all"');
mustContain("/admin/ticklers/runner pushes filter history", adminTicklerRunnerPage, "window.history.pushState({ barshMattersAdminTicklerRunnerFilters: true }, \"\", nextUrl);");
mustContain("/admin/ticklers/runner listens to popstate", adminTicklerRunnerPage, 'window.addEventListener("popstate", applyRunnerFiltersFromUrl);');
mustContain("/admin/ticklers/runner clears preview lock on Back", adminTicklerRunnerPage, "setPreviewCriteria(null);");

mustContain("/admin/document-templates has URL parser", documentTemplatesPage, "function documentTemplateStateFromUrl(): DocumentTemplateUrlState");
mustContain("/admin/document-templates reads category from URL", documentTemplatesPage, "category: normalizeTemplateCategory(params.get(\"category\"))");
mustContain("/admin/document-templates pushes history", documentTemplatesPage, "window.history.pushState({ barshMattersDocumentTemplates: true }, \"\", nextUrl);");
mustContain("/admin/document-templates listens to popstate", documentTemplatesPage, 'window.addEventListener("popstate", applyDocumentTemplateStateFromUrl);');
mustContain("/admin/document-templates restores templates from URL", documentTemplatesPage, "void loadTemplates(urlState.category);");

mustContain("/ home has URL parser", homePage, "function homeSearchStateFromUrl(): HomeSearchUrlState");
mustContain("/ home reads patient from URL", homePage, 'patient: params.get("patient") || ""');
mustContain("/ home pushes search history", homePage, "window.history.pushState({ barshMattersHomeSearch: true }, \"\", nextUrl);");
mustContain("/ home listens to popstate", homePage, 'window.addEventListener("popstate", applyHomeSearchStateFromUrl);');
mustContain("/ home restores search from URL", homePage, "void runMainCombinedSearch(urlState, { updateUrl: false });");

console.log("RESULT: verify browser history UI state contract");
console.log("CONTRACT=" + contractPath);
console.log("LAWSUITS_PAGE=" + lawsuitsPath);
console.log("EXPECTS_GLOBAL_BROWSER_BACK_RULE=YES");
console.log("EXPECTS_LAWSUITS_URL_BACKED_SEARCH=YES");
console.log("EXPECTS_MATTER_PAGE_URL_BACKED_TABS=YES");
console.log("EXPECTS_MATTERS_PAGE_URL_BACKED_MASTER_TABS=YES");
console.log("EXPECTS_ADMIN_TICKLERS_URL_BACKED_SEARCH=YES");
console.log("EXPECTS_REFERENCE_DATA_URL_BACKED_SEARCH=YES");
console.log("EXPECTS_ADMIN_TICKLER_RUNNER_URL_BACKED_FILTERS=YES");
console.log("EXPECTS_DOCUMENT_TEMPLATES_URL_BACKED_STATE=YES");
console.log("EXPECTS_HOME_SEARCH_URL_BACKED_STATE=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
