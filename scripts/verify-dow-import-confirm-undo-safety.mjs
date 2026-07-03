#!/usr/bin/env node
import fs from "node:fs";

// Dow import CONFIRM (write) + guarded UNDO safety.
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

console.log("=== VERIFY DOW IMPORT CONFIRM + UNDO SAFETY ===");

const schema = read("prisma/schema.prisma");
const confirm = read("app/api/import/dow/confirm/route.ts");
const creator = read("lib/import/createMatters.ts");
const undo = read("app/api/import/undo/route.ts");
const pkg = read("package.json");

// Schema
must("schema ImportBatch", schema, "model ImportBatch {");
must("schema ImportRow", schema, "model ImportRow {");
must("schema ImportRow matterId", schema, "matterId    Int?");
must("schema ImportRow cascade", schema, "onDelete: Cascade");

// Confirm route
must("confirm flag gate", confirm, "if (!isImportEnabled())");
must("confirm requires provider", confirm, "providerEntityId is required");
must("confirm validates provider type", confirm, 'provider.type !== "provider_client"');
must("confirm re-parses server-side", confirm, "parseSheetToObjects(fileBase64)");
must("confirm held for unmatched carrier", confirm, 'outcome: "held"');
must("confirm skips duplicates", confirm, 'outcome: "duplicate"');
must("confirm patient exact links", confirm, 'pr.status === "exact"');
must("confirm delegates creation", confirm, "createMattersFromStaged(toCreate");
// Shared creator (used by confirm + reconcile-commit) preserves the create behavior.
must("creator batch-allocates numbers", creator, "allocateMatterNumbers(rows.length)");
must("creator createMany matters", creator, "prisma.claimIndex.createMany");
must("creator new patient else-branch", creator, "createPatient(name");
must("creator presuit from gross", creator, "balance_presuit: r.staged.balance_presuit");
must("confirm records batch", confirm, "prisma.importBatch.create");
must("confirm records rows", confirm, "prisma.importRow.createMany");
must("confirm returns undo hint", confirm, "undoHint");

// Undo route — guarded
must("undo flag gate", undo, "if (!isImportEnabled())");
must("undo loads created rows", undo, 'outcome: "created", matterId: { not: null }');
must("undo guard not aggregated", undo, "m.master_lawsuit_id");
must("undo guard not closed", undo, 'final_status || "").toLowerCase() === "closed"');
must("undo deletes only untouched", undo, "matter_id: { in: untouched }");
must("undo marks batch undone", undo, 'status: "undone"');
must("undo keeps touched + reports", undo, "keptDetail");

must("package.json", pkg, "verify:dow-import-confirm-undo-safety");

if (failures) {
  console.error(`=== DOW IMPORT CONFIRM + UNDO SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== DOW IMPORT CONFIRM + UNDO SAFETY PASSED ===");
console.log("Confirm: flag-gated, provider-required, ready-only, full batch record. Undo: guarded (untouched only).");
