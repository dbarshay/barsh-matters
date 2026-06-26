import fs from "node:fs";

const page = fs.readFileSync("app/admin/document-templates/build/page.tsx", "utf8");
const failures = [];

if (page.includes("<option key={category} value={category}>{category}</option>")) failures.push("raw category object option remains");
if (page.includes("key={category}")) failures.push("raw category object key remains");
if (!page.includes("2026.06.00011") || !page.includes("2026.06.00012") || !page.includes("BRL_202600001")) failures.push("example matter options were lost");

if (failures.length) {
  console.error("FAIL: Phase 1L option key verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Build Template option keys repaired and example matter options retained.");
