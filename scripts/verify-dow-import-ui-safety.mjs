#!/usr/bin/env node
import fs from "node:fs";

function read(p) {
  return fs.readFileSync(p, "utf8");
}
let failures = 0;
const pass = (m) => console.log(`PASS: ${m}`);
const fail = (m) => {
  console.error(`FAIL: ${m}`);
  failures += 1;
};
const must = (label, text, needle) =>
  text.includes(needle) ? pass(`${label}: ${needle}`) : fail(`${label}: missing ${needle}`);

console.log("=== VERIFY DOW IMPORT UI SAFETY ===");

const page = read("app/admin/import/page.tsx");
const pkg = read("package.json");

must("upload xlsx", page, 'accept=".xlsx');
must("reads base64", page, "readAsDataURL");
must("provider dropdown source", page, "type=provider_client");
must("preview call (source-aware)", page, "/api/import/${source}/preview");
must("confirm call (source-aware)", page, "/api/import/${source}/confirm");
must("source selector", page, 'setSource(src)');
must("confirm sends providerEntityId (dow)", page, "payload.providerEntityId = providerId");
must("undo call", page, '"/api/import/undo"');
must("undo uses batchId", page, "body: JSON.stringify({ batchId })");
must("undo from confirm result", page, "undoBatch(confirmResult.batchId)");
must("lists existing imports", page, "Existing imports");
must("loads import history", page, '"/api/import/batches');
must("uses BarshHeader", page, "BarshHeader");
must("shows ready count", page, "Ready:");
must("confirm requires provider", page, "!providerId");

must("package.json", pkg, "verify:dow-import-ui-safety");

if (failures) {
  console.error(`=== DOW IMPORT UI SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== DOW IMPORT UI SAFETY PASSED ===");
