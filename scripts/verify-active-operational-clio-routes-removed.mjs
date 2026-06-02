import fs from "fs";
import http from "http";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function request(method, path, payload = null) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : "";
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path,
        method,
        timeout: 15000,
        headers: payload
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            }
          : {},
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
          } catch {}
          resolve({ status: res.statusCode, raw, json });
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error(`${method} ${path} timed out`)));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const deleted = "lib/ingestMattersFromClioBatch.ts";
assert(!fs.existsSync(deleted), `${deleted} should be deleted.`);

const matterClose = fs.readFileSync("app/api/matters/close/route.ts", "utf8");
const settlementClose = fs.readFileSync("app/api/settlements/close/route.ts", "utf8");
const metadata = fs.readFileSync("app/api/lawsuits/update-metadata/route.ts", "utf8");

for (const [label, source] of [
  ["matter close", matterClose],
  ["settlement close", settlementClose],
]) {
  assert(source.includes("legacyClioOperationalRouteBlocked"), `${label} should be blocked pending local-first rebuild.`);
  assert(!source.includes("clioFetch"), `${label} must not call clioFetch.`);
  assert(!source.includes("ingestMattersFromClioBatch"), `${label} must not import ingestMattersFromClioBatch.`);
  assert(!source.includes("upsertClaimIndexFromMatter"), `${label} must not refresh ClaimIndex from Clio.`);
  assert(!source.includes("method: \"PATCH\""), `${label} must not PATCH Clio.`);
}

for (const forbidden of [
  "clioFetch",
  "upsertClaimIndexFromMatter",
  "ingestMattersFromClioBatch",
  "/api/v4/matters",
  "method: \"PATCH\"",
  "writePostFilingFieldsToClio",
]) {
  assert(!metadata.includes(forbidden), `update-metadata still contains forbidden Clio marker: ${forbidden}`);
}

assert(metadata.includes('sourceOfTruth: "local-lawsuit-schema"'), "update-metadata must identify local lawsuit schema as source of truth.");
assert(metadata.includes("noClioRead: true"), "update-metadata must report noClioRead=true.");
assert(metadata.includes("noClioWrite: true"), "update-metadata must report noClioWrite=true.");
assert(metadata.includes("prisma.lawsuit.update"), "update-metadata must still update local Lawsuit rows.");

const activeScanFiles = [
  "app/api/matters/close/route.ts",
  "app/api/settlements/close/route.ts",
  "app/api/lawsuits/update-metadata/route.ts",
];

for (const file of activeScanFiles) {
  const source = fs.readFileSync(file, "utf8");
  assert(!source.includes("@/lib/ingestMattersFromClioBatch"), `${file} imports deleted ingestMattersFromClioBatch.`);
}

const matterCloseRes = await request("POST", "/api/matters/close");
assert(matterCloseRes.status === 410, `matters close expected 410, got ${matterCloseRes.status}: ${matterCloseRes.raw}`);
assert(matterCloseRes.json?.writes?.writesClio === false, "matters close must report writesClio=false.");

const settlementCloseRes = await request("POST", "/api/settlements/close");
assert(settlementCloseRes.status === 410, `settlements close expected 410, got ${settlementCloseRes.status}: ${settlementCloseRes.raw}`);
assert(settlementCloseRes.json?.writes?.writesClio === false, "settlements close must report writesClio=false.");

console.log("RESULT: active operational Clio routes removed");
console.log("ACTIVE_OPERATIONAL_CLIO_ROUTES_STATUS=0");
console.log("MATTERS_CLOSE_BLOCKED=true");
console.log("SETTLEMENTS_CLOSE_BLOCKED=true");
console.log("LAWSUIT_METADATA_LOCAL_ONLY=true");
console.log("INGEST_BATCH_DELETED=true");
console.log("WRITES_CLIO=false");
