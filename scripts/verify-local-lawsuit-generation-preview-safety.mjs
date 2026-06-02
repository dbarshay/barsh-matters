import http from "http";
import fs from "fs";

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
          } catch (error) {
            reject(new Error(`Invalid JSON from ${method} ${path}: ${error.message}; body=${raw.slice(0, 1200)}`));
            return;
          }
          resolve({ status: res.statusCode, json, raw });
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error(`${method} ${path} timed out`)));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function inspectSourceSafety() {
  const routePath = "app/api/lawsuits/local-generation-preview/route.ts";
  const source = fs.readFileSync(routePath, "utf8");

  const forbidden = [
    "clioFetch",
    "updateMatterCustomFields",
    "buildMasterId(",
    "prisma.lawsuit.create",
    "prisma.lawsuit.update",
    "prisma.claimIndex.update(",
    "prisma.claimIndex.updateMany",
    "method: \"PATCH\"",
    "method: 'PATCH'",
    "/api/v4/matters",
  ];

  const hits = forbidden.filter((needle) => source.includes(needle));
  assert(hits.length === 0, `Preview route contains forbidden write/Clio markers: ${hits.join(", ")}`);
}

function dummyRows(rows) {
  const allowed = new Set([
    "BRL30236",
    "BRL30237",
    "BRL30238",
    "BRL30239",
    "BRL30240",
    "BRL30241",
    "BRL30242",
    "BRL30243",
  ]);

  return rows.filter((row) => allowed.has(String(row.display_number || "")));
}

function amount(row) {
  const n = Number(row.balance_presuit ?? row.claim_amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  console.log("CHECK=source-safety");
  inspectSourceSafety();

  console.log("CHECK=claim-state");
  const claim = await request("GET", "/api/claim-index/by-claim?claimNumber=123456");
  assert(claim.status === 200 && claim.json?.ok, `Claim lookup failed: ${claim.status} ${claim.raw}`);

  const rows = Array.isArray(claim.json.rows) ? claim.json.rows : [];
  assert(rows.length === 10, `Expected claim 123456 to have 10 rows, got ${rows.length}`);

  const existingOldMasterRows = rows.filter((row) => row.master_lawsuit_id === "2026.05.00001");
  assert(existingOldMasterRows.length === 2, `Expected existing 2026.05.00001 to have 2 rows, got ${existingOldMasterRows.length}`);

  const unaggregatedDummies = dummyRows(rows).filter((row) => !String(row.master_lawsuit_id || "").trim());
  const unaggregatedDummyIds = unaggregatedDummies.map((row) => Number(row.matter_id));
  const unaggregatedAmount = unaggregatedDummies.reduce((sum, row) => sum + amount(row), 0);

  assert(unaggregatedDummyIds.length >= 1, "Expected at least one unaggregated dummy matter to remain available for local lawsuit-generation testing.");

  console.log("CHECK=available-dummy-preview-request");
  const preview = await request("POST", "/api/lawsuits/local-generation-preview", {
    matterIds: unaggregatedDummyIds,
    amountSoughtMode: "balance_presuit",
  });

  assert(preview.status === 200, `Expected available dummy preview 200, got ${preview.status}: ${preview.raw}`);
  assert(preview.json?.ok === true, "Expected available dummy preview ok=true");
  assert(preview.json?.canCreate === true, "Expected available dummy preview canCreate=true");
  assert(preview.json?.selectedMatterCount === unaggregatedDummyIds.length, `Expected selected count ${unaggregatedDummyIds.length}, got ${preview.json?.selectedMatterCount}`);
  assert(Number(preview.json?.amountSought) === unaggregatedAmount, `Expected amount ${unaggregatedAmount}, got ${preview.json?.amountSought}`);
  assert(preview.json?.writes?.createsLawsuit === false, "Preview must not create lawsuit");
  assert(preview.json?.writes?.updatesClaimIndex === false, "Preview must not update ClaimIndex");
  assert(preview.json?.writes?.writesClio === false, "Preview must not write Clio");
  assert(preview.json?.writes?.createsClioMasterMatter === false, "Preview must not create Clio master matter");
  assert(preview.json?.writes?.consumesMasterSequence === false, "Preview must not consume master sequence");

  const existingGroup = (preview.json?.existingMasterGroups || []).find(
    (group) => group.masterLawsuitId === "2026.05.00001"
  );
  assert(existingGroup, "Expected existing master group 2026.05.00001 to be reported");
  assert(existingGroup.count === 2, `Expected existing master group count 2, got ${existingGroup.count}`);

  console.log("CHECK=mixed-blocked-preview-request");
  const blocked = await request("POST", "/api/lawsuits/local-generation-preview", {
    matterIds: [1876895480, ...unaggregatedDummyIds],
    amountSoughtMode: "balance_presuit",
  });

  assert(blocked.status === 200, `Expected mixed preview 200, got ${blocked.status}: ${blocked.raw}`);
  assert(blocked.json?.ok === true, "Expected mixed preview ok=true");
  assert(blocked.json?.canCreate === false, "Expected mixed preview canCreate=false when existing lawsuit matter selected");
  assert(
    Array.isArray(blocked.json?.blockedMatterIds) && blocked.json.blockedMatterIds.includes(1876895480),
    "Expected BRL30121 / matterId 1876895480 to be blocked"
  );
  assert(blocked.json?.proposedCreateBehavior?.reusesExistingLawsuit === false, "Preview must not reuse existing lawsuit");
  assert(blocked.json?.proposedCreateBehavior?.indexAaaNumberPrefill === false, "Preview must not prefill Index/AAA");

  console.log("RESULT: local lawsuit generation preview safety");
  console.log("PREVIEW_ROUTE_STATUS=0");
  console.log("AVAILABLE_DUMMY_COUNT=" + unaggregatedDummyIds.length);
  console.log("AVAILABLE_DUMMY_AMOUNT_SOUGHT=" + unaggregatedAmount);
  console.log("CLAIM_ROW_COUNT=" + rows.length);
  console.log("EXISTING_MASTER_2026_05_00001_COUNT=" + existingGroup.count);
  console.log("MIXED_SELECTION_CAN_CREATE=" + blocked.json.canCreate);
  console.log("MIXED_BLOCKED_IDS=" + blocked.json.blockedMatterIds.join(","));
  console.log("WRITES_CLIO=" + preview.json.writes.writesClio);
  console.log("CREATES_LAWSUIT=" + preview.json.writes.createsLawsuit);
  console.log("UPDATES_CLAIMINDEX=" + preview.json.writes.updatesClaimIndex);
}

main().catch((error) => {
  console.error("RESULT: local lawsuit generation preview safety");
  console.error("PREVIEW_ROUTE_STATUS=1");
  console.error("ERROR=" + (error?.message || String(error)));
  process.exit(1);
});
