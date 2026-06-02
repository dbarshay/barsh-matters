#!/usr/bin/env node

import fs from "node:fs";

const pagePath = "app/print-queue/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustContain(label, needle) {
  if (!page.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, needle) {
  if (page.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("has URL state type", "type PrintQueueUrlState = {");
mustContain("normalizes status", "function normalizePrintQueueStatus(value: unknown): PrintQueueStatus");
mustContain("has URL state parser", "function printQueueStateFromUrl(): PrintQueueUrlState");
mustContain("reads status from URL", 'status: normalizePrintQueueStatus(params.get("status") || "queued") || "queued"');
mustContain("reads master from URL", 'masterLawsuitId: params.get("masterLawsuitId") || ""');
mustContain("reads limit from URL", 'limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : 100');
mustContain("reads finalized PDF flag from URL", 'finalizedPdfOnly: params.get("finalizedPdfOnly") !== "false"');
mustContain("reads dedupe flag from URL", 'dedupeClioDocumentId: params.get("dedupeClioDocumentId") !== "false"');
mustContain("has URL builder", "function printQueueUrlForState(state: PrintQueueUrlState)");
mustContain("loadQueue accepts state", "nextState: Partial<PrintQueueUrlState> = {}");
mustContain("loadQueue accepts URL options", "options: { updateUrl?: boolean; replaceUrl?: boolean } = {}");
mustContain("pushes print queue history", "window.history.pushState({ barshMattersPrintQueueFilters: true }, \"\", nextUrl);");
mustContain("replaces print queue history", "window.history.replaceState({ barshMattersPrintQueueFilters: true }, \"\", nextUrl);");
mustContain("listens to popstate", 'window.addEventListener("popstate", applyPrintQueueStateFromUrl);');
mustContain("removes popstate listener", 'window.removeEventListener("popstate", applyPrintQueueStateFromUrl);');
mustContain("Back reloads queue from URL", "void loadQueue(printQueueStateFromUrl(), { updateUrl: false });");
mustContain("status filter is URL-backed", "await loadQueue({ status: nextStatusFilter });");
mustContain("status update preserves URL state", "await loadQueue({ status: statusFilter, masterLawsuitId, limit, finalizedPdfOnly, dedupeClioDocumentId }, { replaceUrl: true });");

mustNotContain("old queued initial load must not remain", 'loadQueue("queued")');
mustNotContain("old status load string call must not remain", "await loadQueue(nextStatusFilter);");

console.log("RESULT: verify Print Queue browser history safety");
console.log("PAGE=" + pagePath);
console.log("EXPECTS_PRINT_QUEUE_FILTER_STATE_IN_URL=YES");
console.log("EXPECTS_BROWSER_BACK_RESTORES_PRINT_QUEUE_FILTERS=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
