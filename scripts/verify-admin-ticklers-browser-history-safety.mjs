#!/usr/bin/env node

import fs from "node:fs";

const pagePath = "app/admin/ticklers/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustContain(label, needle) {
  if (!page.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, needle) {
  if (page.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("has URL state type", "type AdminTicklerSearchState = {");
mustContain("has URL state parser", "function adminTicklerSearchStateFromUrl(): AdminTicklerSearchState");
mustContain("reads status from URL", 'const status = params.get("status") === "completed" ? "completed" : "open";');
mustContain("reads master lawsuit from URL", 'masterLawsuitId: params.get("masterLawsuitId") || ""');
mustContain("reads provider from URL", 'provider: params.get("provider") || ""');
mustContain("reads patient from URL", 'patient: params.get("patient") || ""');
mustContain("reads claim from URL", 'claim: params.get("claim") || ""');
mustContain("detects URL search values", "function adminTicklerSearchStateHasAnyValue(state: AdminTicklerSearchState)");

mustContain("loadTicklers accepts overrides", "overrides: Partial<AdminTicklerSearchState> = {}");
mustContain("loadTicklers accepts URL options", "options: { updateUrl?: boolean; replaceUrl?: boolean } = {}");
mustContain("pushes tickler search history", "window.history.pushState({ barshMattersAdminTicklersSearch: true }, \"\", nextUrl);");
mustContain("replaces tickler search history", "window.history.replaceState({ barshMattersAdminTicklersSearch: true }, \"\", nextUrl);");
mustContain("Back reloads from URL without pushing", "void loadTicklers(urlState, { updateUrl: false });");
mustContain("listens to popstate", 'window.addEventListener("popstate", applyAdminTicklerSearchFromUrl);');
mustContain("removes popstate listener", 'window.removeEventListener("popstate", applyAdminTicklerSearchFromUrl);');
mustContain("clear pushes blank URL", 'window.history.pushState({ barshMattersAdminTicklersSearch: true }, "", "/admin/ticklers");');

mustContain("open mode uses URL-backed loader", 'onClick={() => void loadTicklers({ status: "open" })}');
mustContain("completed mode uses URL-backed loader", 'onClick={() => void loadTicklers({ status: "completed" })}');

mustNotContain("old open mode setter should not bypass URL", 'onClick={() => setTicklerStatusMode("open")}');
mustNotContain("old completed mode setter should not bypass URL", 'onClick={() => setTicklerStatusMode("completed")}');

console.log("RESULT: verify Admin Ticklers browser history safety");
console.log("PAGE=" + pagePath);
console.log("EXPECTS_ADMIN_TICKLER_SEARCH_STATE_IN_URL=YES");
console.log("EXPECTS_BROWSER_BACK_RESTORES_ADMIN_TICKLER_RESULTS=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
