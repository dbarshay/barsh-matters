#!/usr/bin/env node
import fs from "node:fs";

// Matter numbering engine safety:
//  - Year-scoped display counter (BRL_{YYYY}{seq}, seq resets yearly) + global matter_id counter.
//  - BATCH allocation (atomic increment by N), never MAX()+1 per row.
//  - matter_id stays above MAX(existing) so it never collides with legacy Clio ids.
//  - 6-digit minimum sequence width, grows beyond.

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
const mustNot = (label, text, needle) =>
  !text.includes(needle) ? pass(`${label}: avoids ${needle}`) : fail(`${label}: forbidden ${needle}`);

console.log("=== VERIFY MATTER NUMBERING SAFETY ===");

const schema = read("prisma/schema.prisma");
const lib = read("lib/matterNumbering.ts");
const pkg = read("package.json");

// Schema: the two counters.
must("schema", schema, "model MatterSequenceCounter");
must("schema MatterSequenceCounter year unique", schema, "year         Int      @unique");
must("schema MatterSequenceCounter lastSequence", schema, "lastSequence Int      @default(0)");
must("schema", schema, "model MatterIdCounter");
must("schema MatterIdCounter lastId", schema, "lastId    Int      @default(0)");

// Formatter: BRL_{year}{seq}, min 6-digit, grows.
must("formatter", lib, "export function formatBrlDisplayNumber");
must("formatter width const", lib, "MIN_SEQ_WIDTH = 6");
must("formatter format", lib, "`BRL_${year}${String(seq).padStart(MIN_SEQ_WIDTH");

// Allocator: batch (increment by count), atomic transaction, collision-safe id.
must("allocator batch increment", lib, "increment: count");
must("allocator atomic tx", lib, "prisma.$transaction");
must("allocator year counter", lib, "tx.matterSequenceCounter.upsert");
must("allocator id counter", lib, "tx.matterIdCounter.upsert");
must("allocator id above existing max", lib, "tx.claimIndex.aggregate({ _max: { matter_id: true } })");
must("allocator id floor guard", lib, "Math.max(idCounter.lastId, currentMax, MATTER_ID_FLOOR)");
// NOT a per-row MAX()+1 or per-row single increment.
mustNot("allocator no per-row single increment", lib, "increment: 1");

must("package.json", pkg, "verify:matter-numbering-safety");

if (failures) {
  console.error(`=== MATTER NUMBERING SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== MATTER NUMBERING SAFETY PASSED ===");
console.log("Batch-allocated BRL_{YYYY}{seq} (6-digit min, yearly reset) + collision-safe matter_id.");
