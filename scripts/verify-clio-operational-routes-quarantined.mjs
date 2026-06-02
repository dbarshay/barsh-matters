import fs from "fs";
import http from "http";

const blockedRouteFiles = [
  "app/api/aggregate/route.ts",
  "app/api/deaggregate/route.ts",
  "app/api/aggregation/build-lawsuit/route.ts",
  "app/api/aggregation/from-search/route.ts",
  "app/api/aggregation/add-matters/route.ts",
  "app/api/aggregation/expand-claim/route.ts",
  "app/api/aggregation/find-siblings/route.ts",
  "app/api/claim-index/rebuild/route.ts",
  "app/api/claim-index/refresh-cluster/route.ts",
  "app/api/advanced-search/hydrate/route.ts",
];

const forbidden = [
  "clioFetch",
  "updateMatterCustomFields",
  "getMasterIdFromClio",
  "ingestMatterFromClio",
  "ingestMattersFromClioBatch",
  "upsertClaimIndexFromMatter",
  "indexMatterFromClioPayload",
  "/api/v4/matters",
  "preflightLawsuitMatter",
  "writeLawsuitFields",
  "clearLawsuitFields",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function request(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path,
        method,
        timeout: 10000,
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, raw, json });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error(`${method} ${path} timed out`)));
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  for (const file of blockedRouteFiles) {
    const source = fs.readFileSync(file, "utf8");
    assert(
      source.includes("legacyClioOperationalRouteBlocked"),
      `${file} does not use legacyClioOperationalRouteBlocked`
    );

    const hits = forbidden.filter((needle) => source.includes(needle));
    assert(hits.length === 0, `${file} still contains forbidden Clio operational markers: ${hits.join(", ")}`);
  }

  const helper = fs.readFileSync("lib/legacyClioOperationalRouteBlocked.ts", "utf8");
  assert(helper.includes("status: \"legacy-clio-operational-route-disabled\""), "Blocked helper missing explicit status.");
  assert(helper.includes("writesClio: false"), "Blocked helper must report writesClio=false.");
  assert(helper.includes("updatesClaimIndex: false"), "Blocked helper must report updatesClaimIndex=false.");

  const runtimeChecks = [
    ["POST", "/api/aggregation/build-lawsuit"],
    ["POST", "/api/aggregation/from-search"],
    ["POST", "/api/aggregate"],
    ["POST", "/api/deaggregate"],
    ["POST", "/api/claim-index/refresh-cluster"],
    ["POST", "/api/advanced-search/hydrate"],
    ["GET", "/api/aggregation/find-siblings?matterId=1876895480"],
    ["GET", "/api/aggregation/expand-claim?matterId=1876895480"],
    ["GET", "/api/claim-index/rebuild"],
  ];

  for (const [method, path] of runtimeChecks) {
    const res = await request(method, path);
    assert(res.status === 410, `${method} ${path} expected 410, got ${res.status}: ${res.raw.slice(0, 500)}`);
    assert(res.json?.blocked === true, `${method} ${path} expected blocked=true`);
    assert(res.json?.writes?.writesClio === false, `${method} ${path} expected writesClio=false`);
    assert(res.json?.writes?.updatesClaimIndex === false, `${method} ${path} expected updatesClaimIndex=false`);
  }

  console.log("RESULT: Clio operational routes quarantined");
  console.log("CLIO_OPERATIONAL_QUARANTINE_STATUS=0");
  console.log("BLOCKED_ROUTE_COUNT=" + blockedRouteFiles.length);
  console.log("RUNTIME_410_CHECKS=" + runtimeChecks.length);
  console.log("WRITES_CLIO=false");
  console.log("UPDATES_CLAIMINDEX=false");
}

main().catch((error) => {
  console.error("RESULT: Clio operational routes quarantined");
  console.error("CLIO_OPERATIONAL_QUARANTINE_STATUS=1");
  console.error("ERROR=" + (error?.message || String(error)));
  process.exit(1);
});
