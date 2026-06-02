#!/usr/bin/env node
import fs from "node:fs";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function assertIncludes(label, text, needle) {
  assert(text.includes(needle), `${label} missing ${needle}`);
}

function assertNotIncludes(label, text, needle) {
  assert(!text.includes(needle), `${label} should not include ${needle}`);
}

const legacyRoutePath = "app/api/claim-index/rebuild-status/route.ts";
const localRoutePath = "app/api/claim-index/local-index-status/route.ts";
const pkgPath = "package.json";

assert(fs.existsSync(legacyRoutePath), "legacy rebuild-status compatibility shim missing");
assert(fs.existsSync(localRoutePath), "local-index-status route missing");

const legacyRoute = fs.readFileSync(legacyRoutePath, "utf8");
const localRoute = fs.readFileSync(localRoutePath, "utf8");
const pkg = fs.readFileSync(pkgPath, "utf8");

assertIncludes("legacy rebuild-status shim", legacyRoute, "Deprecated compatibility shim");
assertIncludes("legacy rebuild-status shim", legacyRoute, "getLocalIndexStatus");
assertIncludes("legacy rebuild-status shim", legacyRoute, "export async function GET");

assertNotIncludes("legacy rebuild-status shim", legacyRoute, "claimIndexRebuildState.findMany");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, "claimIndex.findMany");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, "method: \"PATCH\"");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, "method: \"POST\"");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, "method: \"DELETE\"");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, ".create(");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, ".update(");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, ".delete(");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, "clioFetch(");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, "ingestMatterFromClio");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, "ingestMattersFromClioBatch");
assertNotIncludes("legacy rebuild-status shim", legacyRoute, "upsertClaimIndexFromMatter");

assertIncludes("local index status route", localRoute, "export async function GET");
assertIncludes("local index status route", localRoute, "claimIndexRebuildState.findMany");
assertIncludes("local index status route", localRoute, "claimIndex.findMany");
assertIncludes("local index status route", localRoute, "ok: true");
assertIncludes("local index status route", localRoute, "coverage");
assertIncludes("local index status route", localRoute, "progress");
assertIncludes("local index status route", localRoute, "fieldCoverage");
assertIncludes("local index status route", localRoute, "oldestIndexedAt");
assertIncludes("local index status route", localRoute, "newestIndexedAt");
assertIncludes("local index status route", localRoute, "currentBrlNumber");
assertIncludes("local index status route", localRoute, "lastError");

assertNotIncludes("local index status route", localRoute, "method: \"PATCH\"");
assertNotIncludes("local index status route", localRoute, "method: \"POST\"");
assertNotIncludes("local index status route", localRoute, "method: \"DELETE\"");
assertNotIncludes("local index status route", localRoute, ".create(");
assertNotIncludes("local index status route", localRoute, ".update(");
assertNotIncludes("local index status route", localRoute, ".delete(");
assertNotIncludes("local index status route", localRoute, "clioFetch(");
assertNotIncludes("local index status route", localRoute, "ingestMatterFromClio");
assertNotIncludes("local index status route", localRoute, "ingestMattersFromClioBatch");
assertNotIncludes("local index status route", localRoute, "upsertClaimIndexFromMatter");

assertIncludes("package.json", pkg, "verify:claimindex-rebuild-status-safety");

console.log("RESULT: claimindex rebuild-status compatibility shim safety passed");
