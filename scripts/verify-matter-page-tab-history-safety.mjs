#!/usr/bin/env node

import fs from "node:fs";

const pagePath = "app/matter/[id]/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustContain(label, needle) {
  if (!page.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, needle) {
  if (page.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("declares matter workspace tab type", "type MatterWorkspaceTab =");
mustContain("declares allowed tabs", "const MATTER_WORKSPACE_TABS: MatterWorkspaceTab[] = [");
mustContain("normalizes URL tab", "function normalizeMatterWorkspaceTab(value: unknown): MatterWorkspaceTab");
mustContain("reads tab from URL", "function matterWorkspaceTabFromUrl(): MatterWorkspaceTab");
mustContain("uses URLSearchParams tab", 'new URLSearchParams(window.location.search).get("tab")');
mustContain("builds matter URL with tab", "function matterUrlWithWorkspaceTab(tab: MatterWorkspaceTab)");
mustContain("sets tab query parameter", 'url.searchParams.set("tab", tab);');
mustContain("state initializes from URL", "useState<MatterWorkspaceTab>(() => matterWorkspaceTabFromUrl())");
mustContain("uses wrapped tab setter", "function setActiveWorkspaceTab(tab: MatterWorkspaceTab");
mustContain("pushes tab history", "window.history.pushState({ barshMattersMatterTab: true }, \"\", nextUrl);");
mustContain("replaces tab history", "window.history.replaceState({ barshMattersMatterTab: true }, \"\", nextUrl);");
mustContain("listens for browser Back", 'window.addEventListener("popstate", applyMatterTabFromUrl);');
mustContain("removes browser Back listener", 'window.removeEventListener("popstate", applyMatterTabFromUrl);');
mustContain("Back restores tab state", "setActiveWorkspaceTabState(matterWorkspaceTabFromUrl());");

mustNotContain("must not use old state setter name directly", "const [activeWorkspaceTab, setActiveWorkspaceTab] =");

console.log("RESULT: verify matter page tab history safety");
console.log("PAGE=" + pagePath);
console.log("EXPECTS_MATTER_TAB_URL_STATE=YES");
console.log("EXPECTS_BROWSER_BACK_RESTORES_TAB=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
