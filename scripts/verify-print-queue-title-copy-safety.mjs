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

mustContain("Print Queue title remains", "Daily Print Queue");
mustContain("Print Queue browser-history remains", "function printQueueStateFromUrl(): PrintQueueUrlState");
mustContain("Print Queue URL-backed filters remain", "barshMattersPrintQueueFilters");

mustNotContain("removed local workflow copy", "Local workflow list only.");
mustNotContain("removed no-Clio-change sentence", "This page does not change Clio documents, upload files, create folders, or modify document contents.");

console.log("RESULT: verify Print Queue title copy safety");
console.log("PAGE=" + pagePath);
console.log("EXPECTS_TITLE_PRESENT=YES");
console.log("EXPECTS_REQUESTED_COPY_REMOVED=YES");
console.log("EXPECTS_BROWSER_HISTORY_PRESERVED=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
