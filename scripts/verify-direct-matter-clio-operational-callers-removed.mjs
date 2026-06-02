import fs from "fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

const forbidden = [
  "/api/claim-index/refresh-cluster",
  "/api/aggregation/build-lawsuit",
  "/api/deaggregate",
  "/api/aggregation/expand-claim",
  "/api/aggregate",
  "/api/aggregation/find-siblings",
];

const hits = forbidden.filter((needle) => source.includes(needle));
assert(hits.length === 0, `Direct matter page still calls quarantined routes: ${hits.join(", ")}`);

assert(source.includes("/api/lawsuits/local-generation-preview"), "Direct matter page must call local lawsuit preview route.");
assert(source.includes("/api/lawsuits/local-generation-create"), "Direct matter page must call local lawsuit create route.");
assert(source.includes("No Clio records were changed."), "Direct matter local lawsuit success message must confirm no Clio records changed.");
assert(source.includes("Legacy de-aggregation is disabled."), "Direct matter deaggregation must be disabled pending local-first workflow.");
assert(source.includes("Legacy Clio-backed claim expansion is disabled."), "Direct matter claim expansion must be disabled pending local-first workflow.");
assert(!source.includes("FORCE fresh Clio-backed refresh"), "Direct matter close flow must not reference Clio refresh.");

console.log("RESULT: direct matter Clio operational callers removed");
console.log("DIRECT_MATTER_CLIO_CALLERS_STATUS=0");
console.log("LOCAL_PREVIEW_CREATE_WIRED=true");
console.log("DEAGGREGATION_DISABLED=true");
console.log("EXPAND_CLAIM_DISABLED=true");
console.log("POST_CLOSE_CLIO_REFRESH_REMOVED=true");
