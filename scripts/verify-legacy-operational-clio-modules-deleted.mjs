import fs from "fs";
import path from "path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const deletedModules = [
  "lib/clioUpdateCustomFields.ts",
  "lib/clioWrite.ts",
  "lib/expandFromSeed.ts",
  "lib/getMasterIdFromClio.ts",
  "lib/indexMatterInternal.ts",
  "lib/claimIndexHydration.ts",
  "lib/ingestMatterFromClio.ts",
  "lib/refreshBySelectors.ts",
  "lib/refreshClaimCluster.ts",
  "lib/refreshClaimIndex.ts",
  "lib/refreshClaimIndex.ts.bad-query-version",
  "lib/refreshClaimIndex.ts.before-rate-limit-fallback-2026-04-23",
];

for (const file of deletedModules) {
  assert(!fs.existsSync(file), `${file} should be deleted.`);
}

const forbiddenImportFragments = [
  "@/lib/clioUpdateCustomFields",
  "@/lib/clioWrite",
  "@/lib/expandFromSeed",
  "@/lib/getMasterIdFromClio",
  "@/lib/indexMatterInternal",
  "@/lib/claimIndexHydration",
  "@/lib/ingestMatterFromClio",
  "@/lib/refreshBySelectors",
  "@/lib/refreshClaimCluster",
  "@/lib/refreshClaimIndex",
];

const scanRoots = ["app", "lib"];
const offenders = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;

    const source = fs.readFileSync(full, "utf8");

    for (const fragment of forbiddenImportFragments) {
      if (source.includes(fragment)) {
        offenders.push(`${full} references ${fragment}`);
      }
    }
  }
}

for (const root of scanRoots) walk(root);

assert(
  offenders.length === 0,
  `Forbidden legacy operational Clio references remain in active app/lib code:\n${offenders.join("\n")}`
);

console.log("RESULT: legacy operational Clio modules deleted");
console.log("LEGACY_CLIO_MODULE_DELETE_STATUS=0");
console.log("DELETED_MODULE_COUNT=" + deletedModules.length);
console.log("ACTIVE_APP_LIB_FORBIDDEN_REFERENCES=0");
