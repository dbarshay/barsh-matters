#!/usr/bin/env node

import fs from "node:fs";

const contractPath = "BARSH_MATTERS_BROWSER_HISTORY_STATE_CONTRACT.txt";
const lawsuitsPath = "app/lawsuits/page.tsx";

const contract = fs.readFileSync(contractPath, "utf8");
const lawsuits = fs.readFileSync(lawsuitsPath, "utf8");

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

console.log("RESULT: verify browser history UI state contract");
console.log("CONTRACT=" + contractPath);
console.log("LAWSUITS_PAGE=" + lawsuitsPath);
console.log("EXPECTS_GLOBAL_BROWSER_BACK_RULE=YES");
console.log("EXPECTS_LAWSUITS_URL_BACKED_SEARCH=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
