#!/usr/bin/env node

import fs from "node:fs";

const matterPagePath = "app/matter/[id]/page.tsx";
const byMatterRoutePath = "app/api/claim-index/by-matter/route.ts";

const matterPage = fs.readFileSync(matterPagePath, "utf8");
const byMatterRoute = fs.readFileSync(byMatterRoutePath, "utf8");

const failures = [];

function mustContain(label, file, src, needle) {
  if (!src.includes(needle)) failures.push(`${file}: ${label}: missing ${needle}`);
}

function mustNotContain(label, file, src, needle) {
  if (src.includes(needle)) failures.push(`${file}: ${label}: forbidden ${needle}`);
}

const expectedMatterPageBlock = `        if (Number.isFinite(numericMatterId) && numericMatterId > 0) {
          localParams.set("matterId", String(numericMatterId));
        } else {
          localParams.set("displayNumber", String(matterId));
          localParams.set("matterDisplayNumber", String(matterId));
        }
`;

mustContain(
  "numeric route id sends only matterId while display fallback sends displayNumber/matterDisplayNumber",
  matterPagePath,
  matterPage,
  expectedMatterPageBlock
);

mustNotContain(
  "numeric route id must not also set matterDisplayNumber in the numeric branch",
  matterPagePath,
  matterPage,
  `        if (Number.isFinite(numericMatterId) && numericMatterId > 0) {
          localParams.set("matterId", String(numericMatterId));
          localParams.set("matterDisplayNumber", String(matterId));
        }`
);

mustContain(
  "by-matter route computes valid matterId",
  byMatterRoutePath,
  byMatterRoute,
  "const hasValidMatterId = Number.isFinite(matterId) && matterId > 0;"
);

mustContain(
  "by-matter route prefers valid matterId",
  byMatterRoutePath,
  byMatterRoute,
  "where: hasValidMatterId"
);

mustContain(
  "by-matter route still supports display fallback",
  byMatterRoutePath,
  byMatterRoute,
  ": displayNumberWhere,"
);

console.log("RESULT: verify matter page local ID hydration safety");
console.log("MATTER_PAGE=" + matterPagePath);
console.log("BY_MATTER_ROUTE=" + byMatterRoutePath);
console.log("EXPECTS_NUMERIC_ROUTE_ID_LOOKUP_BY_MATTER_ID=YES");
console.log("EXPECTS_DISPLAY_NUMBER_FALLBACK=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
