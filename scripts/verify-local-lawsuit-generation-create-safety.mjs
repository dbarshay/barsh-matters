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
  const routePath = "app/api/lawsuits/local-generation-create/route.ts";
  const source = fs.readFileSync(routePath, "utf8");

  const forbidden = [
    "clioFetch",
    "updateMatterCustomFields",
    "method: \"PATCH\"",
    "method: 'PATCH'",
    "/api/v4/matters",
    "createMasterMatter",
    "upsertClaimIndexFromMatter",
    "refreshClaimIndexFromClio",
  ];

  const hits = forbidden.filter((needle) => source.includes(needle));
  assert(hits.length === 0, `Create route contains forbidden Clio/live-refresh markers: ${hits.join(", ")}`);

  assert(source.includes('confirm !== "create-local-lawsuit"'), "Create route must require explicit confirm token before write path.");
  assert(source.includes("buildMasterId()"), "Create route should assign local master ID only inside confirmed route.");
  assert(source.includes("tx.lawsuit.create"), "Create route should create a local Lawsuit row.");
  assert(source.includes("tx.claimIndex.updateMany"), "Create route should update selected ClaimIndex rows.");
  assert(source.includes("indexAaaNumber: null"), "Create route must not prefill Index/AAA.");
  assert(source.includes("clioMasterMatterId: null"), "Create route must not create/map a Clio master matter.");
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

async function main() {
  inspectSourceSafety();

  const claim = await request("GET", "/api/claim-index/by-claim?claimNumber=123456");
  assert(claim.status === 200 && claim.json?.ok, `Claim lookup failed: ${claim.status} ${claim.raw}`);

  const rows = Array.isArray(claim.json.rows) ? claim.json.rows : [];
  const unaggregatedDummyIds = dummyRows(rows)
    .filter((row) => !String(row.master_lawsuit_id || "").trim())
    .map((row) => Number(row.matter_id));

  assert(unaggregatedDummyIds.length >= 1, "Expected at least one unaggregated dummy matter to remain available for create-route safety testing.");

  const missingConfirm = await request("POST", "/api/lawsuits/local-generation-create", {
    matterIds: unaggregatedDummyIds,
    amountSoughtMode: "balance_presuit",
  });

  assert(missingConfirm.status === 400, `Expected missing confirm 400, got ${missingConfirm.status}: ${missingConfirm.raw}`);
  assert(missingConfirm.json?.created === false, "Missing confirm must not create lawsuit.");
  assert(missingConfirm.json?.writes?.createsLawsuit === false, "Missing confirm must not create lawsuit.");
  assert(missingConfirm.json?.writes?.updatesClaimIndex === false, "Missing confirm must not update ClaimIndex.");
  assert(missingConfirm.json?.writes?.writesClio === false, "Missing confirm must not write Clio.");
  assert(missingConfirm.json?.writes?.consumesMasterSequence === false, "Missing confirm must not consume master sequence.");

  const blocked = await request("POST", "/api/lawsuits/local-generation-create", {
    confirm: "create-local-lawsuit",
    matterIds: [1876895480, ...unaggregatedDummyIds],
    amountSoughtMode: "balance_presuit",
  });

  assert(blocked.status === 400, `Expected blocked selection 400, got ${blocked.status}: ${blocked.raw}`);
  assert(blocked.json?.created === false, "Blocked selection must not create lawsuit.");
  assert(
    Array.isArray(blocked.json?.blockedMatterIds) && blocked.json.blockedMatterIds.includes(1876895480),
    "Blocked selection must identify BRL30121 / matterId 1876895480."
  );
  assert(blocked.json?.writes?.createsLawsuit === false, "Blocked selection must not create lawsuit.");
  assert(blocked.json?.writes?.updatesClaimIndex === false, "Blocked selection must not update ClaimIndex.");
  assert(blocked.json?.writes?.writesClio === false, "Blocked selection must not write Clio.");
  assert(blocked.json?.writes?.consumesMasterSequence === false, "Blocked selection must not consume master sequence.");

  const preview = await request("POST", "/api/lawsuits/local-generation-preview", {
    matterIds: unaggregatedDummyIds,
    amountSoughtMode: "balance_presuit",
  });

  assert(preview.status === 200, `Expected preview 200, got ${preview.status}: ${preview.raw}`);
  assert(preview.json?.canCreate === true, "Available unaggregated dummies should remain available after non-writing create-route verifier.");

  console.log("RESULT: local lawsuit generation create safety");
  console.log("CREATE_ROUTE_STATUS=0");
  console.log("MISSING_CONFIRM_BLOCKED=true");
  console.log("BLOCKED_EXISTING_MASTER_SELECTION=true");
  console.log("AVAILABLE_DUMMY_COUNT=" + unaggregatedDummyIds.length);
  console.log("AVAILABLE_DUMMIES_STILL_CAN_CREATE=" + preview.json.canCreate);
  console.log("WRITES_CLIO=false");
  console.log("ACTUAL_CREATE_TEST_RAN=false");
}

main().catch((error) => {
  console.error("RESULT: local lawsuit generation create safety");
  console.error("CREATE_ROUTE_STATUS=1");
  console.error("ERROR=" + (error?.message || String(error)));
  process.exit(1);
});
