#!/usr/bin/env node

import fs from "node:fs";

const pagePath = "app/admin/ticklers/runner/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustContain(label, needle) {
  if (!page.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, needle) {
  if (page.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("imports useEffect", 'import { useEffect, useMemo, useState } from "react";');
mustContain("has URL state type", "type AdminTicklerRunnerUrlState = {");
mustContain("has URL parser", "function adminTicklerRunnerStateFromUrl(): AdminTicklerRunnerUrlState");
mustContain("reads kind from URL", 'kind: params.get("kind") || "all"');
mustContain("reads dueThrough from URL", 'dueThrough: params.get("dueThrough") || todayInputValue()');
mustContain("reads limit from URL", 'limit: params.get("limit") || "100"');
mustContain("has URL builder", "function adminTicklerRunnerUrlForState(state: AdminTicklerRunnerUrlState)");
mustContain("pushes runner history", "window.history.pushState({ barshMattersAdminTicklerRunnerFilters: true }, \"\", nextUrl);");
mustContain("has URL-aware filter apply", "function applyRunnerFilterState(nextState: AdminTicklerRunnerUrlState");
mustContain("Back listens to popstate", 'window.addEventListener("popstate", applyRunnerFiltersFromUrl);');
mustContain("Back removes listener", 'window.removeEventListener("popstate", applyRunnerFiltersFromUrl);');
mustContain("Back clears preview lock", "setPreviewCriteria(null);");
mustContain("Back clears result", "setResult(null);");
mustContain("kind input uses URL-backed setter", "onChange={(event) => applyRunnerFilterState({ kind: event.target.value, dueThrough, limit })}");
mustContain("due input uses URL-backed setter", "onChange={(event) => applyRunnerFilterState({ kind, dueThrough: event.target.value, limit })}");
mustContain("limit input uses URL-backed setter", "onChange={(event) => applyRunnerFilterState({ kind, dueThrough, limit: event.target.value })}");

mustNotContain("old setKind direct setter must not remain", "setKind(");
mustNotContain("old setDueThrough direct setter must not remain", "setDueThrough(");
mustNotContain("old setLimit direct setter must not remain", "setLimit(");

console.log("RESULT: verify Admin Tickler Runner browser history safety");
console.log("PAGE=" + pagePath);
console.log("EXPECTS_RUNNER_FILTER_STATE_IN_URL=YES");
console.log("EXPECTS_BROWSER_BACK_RESTORES_RUNNER_FILTERS=YES");
console.log("EXPECTS_BACK_CLEARS_PREVIEW_LOCK=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
