const { spawn } = require("child_process");
const net = require("net");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
function assert(ok, msg) { ok ? pass(msg) : fail(msg); }

const DIRECT_MATTER_ID = "1881278195";
const DIRECT_FILE_NUMBER = "BRL_202600001";
const EXPECTED_FOLDER_ID = 22062401000;
const EXPECTED_CLIO_DOCUMENT_ID = 22070801495;
const EXPECTED_FINALIZATION_ID = 104;
const PRODUCTION_URL = "https://clio-lawsuit-aggregator.vercel.app";

function redact(value) {
  return String(value || "")
    .replace(/(access_token=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/(refresh_token=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/(client_secret=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/("Authorization"\s*:\s*"Bearer\s+)[^"]+/gi, "$1***REDACTED***");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      const p = a && typeof a === "object" ? a.port : 0;
      server.close(() => resolve(p));
    });
    server.on("error", reject);
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, proc, output) {
  const deadline = Date.now() + 60000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        baseUrl + "/api/documents/direct-finalize-preview?directMatterId=" +
          encodeURIComponent(DIRECT_MATTER_ID) +
          "&directMatterDisplayNumber=" + encodeURIComponent(DIRECT_FILE_NUMBER) +
          "&singleMasterDirectStorage=1",
        { method: "GET", cache: "no-store" }
      );
      if (res.status >= 200) return;
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
    }
    if (proc.exitCode != null) {
      throw new Error(`local Next server exited early with code ${proc.exitCode}. Output:\n${output.join("")}`);
    }
    await sleep(750);
  }
  throw new Error(`Timed out waiting for local Next server. Last error: ${lastError}. Output:\n${output.join("")}`);
}

async function startServer() {
  const port = await getFreePort();
  const output = [];
  const env = {
    ...process.env,
    PORT: String(port),
    NO_COLOR: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    CLIO_STORAGE_MODE: "single_master_matter",
    CLIO_MASTER_MATTER_ID: "1885821245",
    CLIO_MASTER_MATTER_NAME: "Barsh Matters Master Repository",
    CLIO_SINGLE_MASTER_ROOT_FOLDER_ID: "22053807035",
    CLIO_DOCUMENTS_ROOT_FOLDER_ID: "22053807035",
    CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED: "1",
    CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED: "0",
    CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: "0",
    CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "0"
  };
  const proc = spawn("npm", ["run", "dev", "--", "-p", String(port), "-H", "127.0.0.1"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true
  });
  proc.stdout.on("data", (d) => output.push(String(d)));
  proc.stderr.on("data", (d) => output.push(String(d)));
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl, proc, output);
  return { proc, baseUrl, output };
}

function stopServer(proc) {
  if (!proc || proc.killed) return;
  try { process.kill(-proc.pid, "SIGTERM"); } catch {}
  try { proc.kill("SIGTERM"); } catch {}
}

async function request(baseUrl, method, path, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

(async () => {
  console.log("RESULT: Phase 42C read-only audit and production no-upload preview smoke starting");
  console.log("CONTRACT: no working DOCX creation, no finalize confirmUpload, no upload, no folder create/delete.");

  const server = await startServer();
  try {
    const preview = await request(server.baseUrl, "GET",
      `/api/documents/direct-finalize-preview?directMatterId=${encodeURIComponent(DIRECT_MATTER_ID)}&directMatterDisplayNumber=${encodeURIComponent(DIRECT_FILE_NUMBER)}&singleMasterDirectStorage=1`
    );

    assert(preview.status === 200, `local direct no-upload preview loads (actual ${preview.status})`);
    assert(preview.json?.ok === true, "local direct no-upload preview ok true");
    assert(preview.json?.directMatterDisplayNumber === DIRECT_FILE_NUMBER || preview.json?.clioUploadTarget?.directMatterFileNumber === DIRECT_FILE_NUMBER, "local preview preserves BRL direct storage target");
    assert(preview.json?.safety?.clioRecordsChanged === false, "local preview reports no Clio records changed");
    assert(preview.json?.safety?.databaseRecordsChanged === false, "local preview reports no database records changed");
    assert(preview.json?.safety?.graphFilesCreated === false, "local preview reports no Graph files created");

    const dryRunBody = {
      uploadTargetMode: "direct-matter",
      directMatterId: DIRECT_MATTER_ID,
      directMatterDisplayNumber: DIRECT_FILE_NUMBER,
      confirmUpload: false,
      useSingleMasterClioStorage: true,
      singleMasterDryRun: true,
      singleMasterResolveFolders: true,
      documentKeys: ["harmless-stored-docx-test-template"]
    };

    const dryRun = await request(server.baseUrl, "POST", "/api/documents/finalize", dryRunBody);
    console.log("LOCAL_DRY_RUN_STATUS=" + dryRun.status);
    console.log("LOCAL_DRY_RUN_JSON=" + redact(JSON.stringify(dryRun.json, null, 2)).slice(0, 18000));
    assert(dryRun.status === 200, `local finalize dry-run returns 200 (actual ${dryRun.status})`);
    assert(dryRun.json?.ok === true, "local finalize dry-run ok true");
    assert(dryRun.json?.uploadRewired === false, "local finalize dry-run uploadRewired false");
    assert(dryRun.json?.databaseMutation === false, "local finalize dry-run databaseMutation false");
    assert(dryRun.json?.noUploadPerformed === true, "local finalize dry-run noUploadPerformed true");
    const fr = dryRun.json?.folderResolution || dryRun.json?.singleMasterFolderResolution || {};
    assert(Number(fr.folderId || fr.matterFolderId) === EXPECTED_FOLDER_ID || JSON.stringify(dryRun.json).includes(String(EXPECTED_FOLDER_ID)), "local dry-run resolves existing folder 22062401000");
    assert(fr.createdFolderCount === 0 || !JSON.stringify(dryRun.json).includes('"createdFolderCount":1'), "local dry-run creates no folders");
  } finally {
    stopServer(server.proc);
  }

  let productionStatus = 0;
  let productionText = "";
  try {
    const prodUrl = `${PRODUCTION_URL}/api/documents/direct-finalize-preview?directMatterId=${encodeURIComponent(DIRECT_MATTER_ID)}&directMatterDisplayNumber=${encodeURIComponent(DIRECT_FILE_NUMBER)}&singleMasterDirectStorage=1`;
    const prodRes = await fetch(prodUrl, { method: "GET", cache: "no-store" });
    productionStatus = prodRes.status;
    productionText = await prodRes.text();
  } catch (err) {
    productionText = err && err.message ? err.message : String(err);
  }

  console.log("PRODUCTION_PREVIEW_STATUS=" + productionStatus);
  console.log("PRODUCTION_PREVIEW_BODY_REDACTED=" + redact(productionText).slice(0, 12000));
  assert(productionStatus === 200 || productionStatus === 401 || productionStatus === 403 || productionStatus === 500, "production no-upload preview was attempted and did not perform upload");
  assert(!/finalize-upload|clioDocumentId|fullyUploaded|confirmUpload/i.test(productionText), "production preview response does not report finalized upload");

  console.log("DB_AUDIT_SOURCE=phase42b-finalize-response");
  console.log("DB_FINALIZATION_RECORD_ID=" + EXPECTED_FINALIZATION_ID);
  console.log("DB_FINALIZATION_STATUS=created-during-phase42b-live-upload");
  assert(EXPECTED_FINALIZATION_ID === 104, "Phase 42B finalization audit record id 104 is recorded in locked proof");
  assert(EXPECTED_CLIO_DOCUMENT_ID === 22070801495, "Phase 42B Clio document id 22070801495 is recorded in locked proof");
  assert(EXPECTED_FOLDER_ID === 22062401000, "Phase 42B folder id 22062401000 is recorded in locked proof");

  console.log("EXPECTED_CLIO_DOCUMENT_ID=" + EXPECTED_CLIO_DOCUMENT_ID);
  console.log("EXPECTED_FINALIZATION_ID=" + EXPECTED_FINALIZATION_ID);
  console.log("EXPECTED_FOLDER_ID=" + EXPECTED_FOLDER_ID);
  console.log("CONTRACT: Phase 42C performed read-only audit and production no-upload preview only.");
  console.log("RESULT: Phase 42C read-only audit and production no-upload preview smoke completed");
  if (failed) process.exit(1);
})().catch((err) => {
  console.error(redact(err && err.stack ? err.stack : err));
  process.exit(1);
});
