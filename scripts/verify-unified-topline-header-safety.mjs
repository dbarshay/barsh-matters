#!/usr/bin/env node

import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustContain(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

const actionsPath = "app/components/BarshHeaderActions.tsx";
const actions = read(actionsPath);

mustContain("shared header actions component exists", actions, "export default function BarshHeaderActions");
mustContain("shared header has Create Lawsuits link", actions, 'href="/lawsuits"');
mustContain("shared header has Print Queue", actions, 'href="/print-queue"');
mustContain("shared header has Administrator", actions, 'href="/admin"');
mustContain("shared header orders Create before Print", actions, "Create Lawsuits");
mustContain("shared header makes Administrator rightmost", actions, "administratorContent");
mustContain("shared header displays Create Lawsuits", actions, "Create Lawsuits");
mustContain("shared header actions shifted right", actions, 'transform: "translateX(48px)"');
mustNotContain("Create Lawsuits must not use navy-only style", actions, "createLawsuitStyle");
mustNotContain("Create Lawsuits must not use navy background", actions, 'background: "#1e3a8a"');
mustNotContain("old singular Create Lawsuit label removed from shared actions", actions, ">Create Lawsuit<");

const pages = [
  ["Home", "app/page.tsx"],
  ["Direct Matter", "app/matter/[id]/page.tsx"],
  ["Master Matters", "app/matters/page.tsx"],
  ["Lawsuits", "app/lawsuits/page.tsx"],
  ["Print Queue", "app/print-queue/page.tsx"],
  ["Admin Home", "app/admin/page.tsx"],
];

for (const [label, path] of pages) {
  const page = read(path);
  mustContain(`${label} imports shared header actions`, page, 'BarshHeaderActions');
  mustContain(`${label} renders shared header actions`, page, '<BarshHeaderActions');
}

mustNotContain("Print Queue no longer uses old print-only top action", read("app/print-queue/page.tsx"), 'left: -86');

console.log("RESULT: verify unified top-line header safety");
console.log("EXPECTS_SHARED_RIGHT_ACTIONS=YES");
console.log("EXPECTS_CREATE_LAWSUIT_ALL_MAIN_HEADERS=YES");
console.log("EXPECTS_PRINT_QUEUE_ALL_MAIN_HEADERS=YES");
console.log("EXPECTS_ADMINISTRATOR_RIGHTMOST=YES");
console.log("EXPECTS_MATCHING_HEADER_ACTION_COLORS=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
