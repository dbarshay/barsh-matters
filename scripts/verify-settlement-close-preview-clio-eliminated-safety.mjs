import fs from "fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const routePath = "app/api/settlements/close-preview/route.ts";
const route = fs.readFileSync(routePath, "utf8");

assert(route.includes("export async function GET"), "settlement close preview route must expose GET.");
assert(route.includes("export async function POST"), "settlement close preview route must expose POST only as blocked legacy compatibility.");
assert(route.includes("legacyClioOperationalRouteBlocked"), "settlement close preview must be quarantined behind legacyClioOperationalRouteBlocked.");
assert(route.includes('legacyClioOperationalRouteBlocked("app/api/settlements/close-preview")'), "settlement close preview must identify its blocked route.");

for (const forbidden of [
  "clioFetch",
  "fetchClio",
  "getClio",
  "ingestMattersFromClioBatch",
  "upsertClaimIndexFromMatter",
  "method: \"PATCH\"",
  "method: \"POST\"",
  "updateMatterCustomFields",
  "prisma.",
]) {
  assert(!route.includes(forbidden), `${routePath} contains forbidden operational marker: ${forbidden}`);
}

console.log("RESULT: settlement close preview Clio eliminated safety");
console.log("CLOSE_PREVIEW_QUARANTINED=true");
console.log("WRITES_CLIO=false");
console.log("READS_CLIO=false");
console.log("LOCAL_DB_WRITES=false");
console.log("PASS: settlement close preview is blocked/quarantined with no Clio or local DB mutation.");
