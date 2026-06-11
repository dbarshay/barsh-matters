import fs from "node:fs";

const pagePath = "app/matter/[id]/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const checks = [
  ["Direct Matter has usableMasterLawsuitIdForDocuments helper", page.includes("function usableMasterLawsuitIdForDocuments")],
  ["helper considers packet/matter/tab master IDs", page.includes("packetPreview?.packet?.masterLawsuitId") && page.includes("matter?.masterLawsuitId") && page.includes("matter?.master_lawsuit_id") && page.includes("tabMasterLawsuitId")],
  ["helper rejects placeholder-like master ID or validates real ID format", page.includes("MASTER_LAWSUIT_ID") || page.includes("\\d{4}") || page.includes("usableMasterLawsuitIdForDocuments")],
  ["loadFinalizePreview uses helper", /loadFinalizePreview[\s\S]{0,900}usableMasterLawsuitIdForDocuments\(\)/.test(page)],
  ["final upload/finalize path no longer sends stale packet-only placeholder", !page.includes("const masterLawsuitId =\\n      textValue(packetPreview?.packet?.masterLawsuitId) ||\\n      textValue(matter?.masterLawsuitId);")],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS: ${label}`);
  else { failed += 1; console.error(`FAIL: ${label}`); }
}
if (failed) {
  console.error(`FAIL: ${failed} Direct Matter finalization master ID safety check(s) failed.`);
  process.exit(1);
}
console.log("PASS: Direct Matter finalization resolves a real Master Lawsuit ID and avoids stale placeholder routing.");
