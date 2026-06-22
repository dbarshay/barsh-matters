const { spawn } = require("child_process");
const net = require("net");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
function assert(ok, msg) { ok ? pass(msg) : fail(msg); }

const DIRECT_FILE_NUMBER = "BRL_202600001";
const MASTER_PREVIEW_CONTEXT = "2026.05.00001";

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForServer(baseUrl, proc, output) {
  const deadline = Date.now() + 45000;
  let lastError = "";
  while (Date.now() < deadline) {
    if (proc.exitCode != null) {
      throw new Error(`local Next server exited early with code ${proc.exitCode}. Output:\n${output.join("")}`);
    }
    try {
      const res = await fetch(baseUrl + "/api/documents/finalize", { method: "OPTIONS" });
      if (res.status >= 200 || res.status === 405) return;
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
    }
    await sleep(750);
  }
  throw new Error(`Timed out waiting for local Next server. Last error: ${lastError}. Output:\n${output.join("")}`);
}

function startServer(envOverrides) {
  return new Promise(async (resolve, reject) => {
    const port = await getFreePort();
    const output = [];
    const env = {
      ...process.env,
      ...envOverrides,
      PORT: String(port),
      NO_COLOR: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      CLIO_STORAGE_MODE: "single_master_matter",
      CLIO_MASTER_MATTER_ID: "1885821245",
      CLIO_MASTER_MATTER_NAME: "Barsh Matters Master Repository",
      CLIO_SINGLE_MASTER_ROOT_FOLDER_ID: "22053807035",
      CLIO_DOCUMENTS_ROOT_FOLDER_ID: "22053807035",
      CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED: "0",
      CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: "0",
      CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "0",
    };
    const proc = spawn("npm", ["run", "dev", "--", "-p", String(port), "-H", "127.0.0.1"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    proc.stdout.on("data", (d) => output.push(String(d)));
    proc.stderr.on("data", (d) => output.push(String(d)));
    proc.on("error", reject);
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
      await waitForServer(baseUrl, proc, output);
      resolve({ proc, baseUrl, output });
    } catch (err) {
      stopServer(proc);
      reject(err);
    }
  });
}

function stopServer(proc) {
  if (!proc || proc.killed) return;
  try { process.kill(-proc.pid, "SIGTERM"); } catch {}
  try { proc.kill("SIGTERM"); } catch {}
}

async function postFinalize(baseUrl) {
  const body = {
    uploadTargetMode: "direct-matter",
    directMatterId: "1881278195",
    directMatterDisplayNumber: DIRECT_FILE_NUMBER,
    confirmUpload: false,
    useSingleMasterClioStorage: true,
    singleMasterDryRun: true,
    singleMasterResolveFolders: false,
    allowDuplicateUploads: false,
    documentKeys: ["harmless-stored-docx-test-template"],
  };
  const res = await fetch(baseUrl + "/api/documents/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

async function runDefaultOffCase() {
  console.log("RUN: default-off direct target-input route dry-run");
  const server = await startServer({ CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED: "0" });
  try {
    const result = await postFinalize(server.baseUrl);
    assert(result.status >= 400, "default-off direct dry-run is blocked");
    assert(/CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED=1/.test(result.text), "default-off response names direct target-input guard");
    assert(!/uploadedToResolvedSingleMasterFolder\"\s*:\s*true/.test(result.text), "default-off response does not report resolved-folder upload");
  } finally {
    stopServer(server.proc);
  }
}

async function runGuardEnabledDryRunCase() {
  console.log("RUN: guard-enabled direct target-input route dry-run with uploads disabled");
  const server = await startServer({ CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED: "1" });
  try {
    const result = await postFinalize(server.baseUrl);
    assert(result.status === 200, `guard-enabled direct dry-run returns 200 (actual ${result.status})`);
    const json = result.json || {};
    assert(json.ok === true, "guard-enabled direct dry-run ok true");
    assert(json.finalizeRewired === true, "guard-enabled direct dry-run reports finalizeRewired true");
    assert(json.uploadRewired === false, "guard-enabled direct dry-run keeps uploadRewired false");
    assert(json.databaseMutation === false, "guard-enabled direct dry-run keeps databaseMutation false");
    assert(json.noUploadPerformed === true, "guard-enabled direct dry-run keeps noUploadPerformed true");
    assert(json.singleMasterDryRun === true, "guard-enabled direct dry-run reports singleMasterDryRun true");
    assert(json.singleMasterResolveFolders === false, "guard-enabled direct dry-run keeps singleMasterResolveFolders false");
    assert(json.folderResolutionMode === "preview-only-no-clio-call", "guard-enabled direct dry-run uses preview-only-no-clio-call");
    const target = json.singleMasterTargetInput || {};
    assert(target.storageTargetKind === "individual_matter", "dry-run target uses individual_matter");
    assert(target.directMatterFileNumber === DIRECT_FILE_NUMBER, "dry-run target directMatterFileNumber uses Barsh Matters direct file number");
    assert(target.bmMatterId === DIRECT_FILE_NUMBER, "dry-run target bmMatterId uses Barsh Matters direct file number");
    assert(target.displayNumber === DIRECT_FILE_NUMBER, "dry-run target displayNumber uses Barsh Matters direct file number");
    const safety = json.safety || {};
    assert(safety.noDocumentUploadPerformed === true, "dry-run safety says no document upload performed");
    assert(safety.noDatabaseRecordsChanged === true, "dry-run safety says no database records changed");
    assert(safety.noPatientProviderInsurerClaimFolderNames === true, "dry-run safety preserves privacy-safe folder naming");
  } finally {
    stopServer(server.proc);
  }
}

(async () => {
  console.log("RESULT: Phase 41I direct/individual finalize route dry-run no-upload smoke starting");
  await runDefaultOffCase();
  await runGuardEnabledDryRunCase();
  console.log("CONTRACT: Phase 41I starts only local dev servers and performs route dry-runs; it does not upload, create folders, delete folders, mutate DB, call Graph conversion, or change production env.");
  console.log("RESULT: Phase 41I direct/individual finalize route dry-run no-upload smoke completed");
  if (failed) process.exit(1);
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
