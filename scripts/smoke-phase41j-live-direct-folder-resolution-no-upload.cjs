const { spawn } = require("child_process");
const net = require("net");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
function assert(ok, msg) { ok ? pass(msg) : fail(msg); }

const DIRECT_FILE_NUMBER = "BRL_202600001";
const MASTER_PREVIEW_CONTEXT = "2026.05.00001";
const EXPECTED_ROOT_ID = 22062400790;
const EXPECTED_RANGE_ID = 22062400880;
const EXPECTED_FINAL_ID = 22062401000;

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
    if (proc.exitCode != null) throw new Error(`local Next server exited early with code ${proc.exitCode}. Output:\n${output.join("")}`);
    try {
      const res = await fetch(baseUrl + "/api/documents/finalize", { method: "OPTIONS" });
      if (res.status >= 200 || res.status === 405) return;
    } catch (err) { lastError = err && err.message ? err.message : String(err); }
    await sleep(750);
  }
  throw new Error(`Timed out waiting for local Next server. Last error: ${lastError}. Output:\n${output.join("")}`);
}
function startServer() {
  return new Promise(async (resolve, reject) => {
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
      CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "0",
    };
    const proc = spawn("npm", ["run", "dev", "--", "-p", String(port), "-H", "127.0.0.1"], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
    proc.stdout.on("data", (d) => output.push(String(d)));
    proc.stderr.on("data", (d) => output.push(String(d)));
    proc.on("error", reject);
    const baseUrl = `http://127.0.0.1:${port}`;
    try { await waitForServer(baseUrl, proc, output); resolve({ proc, baseUrl, output }); }
    catch (err) { stopServer(proc); reject(err); }
  });
}
function stopServer(proc) {
  if (!proc || proc.killed) return;
  try { process.kill(-proc.pid, "SIGTERM"); } catch {}
  try { proc.kill("SIGTERM"); } catch {}
}
async function postFinalize(baseUrl) {
  const body = {
    masterLawsuitId: MASTER_PREVIEW_CONTEXT,
    uploadTargetMode: "direct-matter",
    directMatterDisplayNumber: DIRECT_FILE_NUMBER,
    confirmUpload: false,
    useSingleMasterClioStorage: true,
    singleMasterDryRun: true,
    singleMasterResolveFolders: true,
    allowDuplicateUploads: false,
    documentKeys: ["harmless-stored-docx-test-template"],
  };
  const res = await fetch(baseUrl + "/api/documents/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}
(async () => {
  console.log("RESULT: Phase 41J live direct folder-resolution no-upload smoke starting");
  const server = await startServer();
  try {
    const result = await postFinalize(server.baseUrl);
    if (result.status !== 200) { console.log("PHASE41J_STATUS=" + result.status); console.log("PHASE41J_BODY_START"); console.log(result.text); console.log("PHASE41J_BODY_END"); }
    assert(result.status === 200, `live folder-resolution dry-run returns 200 (actual ${result.status})`);
    const json = result.json || {};
    assert(json.ok === true, "dry-run ok true");
    assert(json.finalizeRewired === true, "dry-run reports finalizeRewired true");
    assert(json.uploadRewired === false, "dry-run keeps uploadRewired false");
    assert(json.databaseMutation === false, "dry-run keeps databaseMutation false");
    assert(json.noUploadPerformed === true, "dry-run keeps noUploadPerformed true");
    assert(json.singleMasterDryRun === true, "dry-run reports singleMasterDryRun true");
    assert(json.singleMasterResolveFolders === true, "dry-run reports singleMasterResolveFolders true");
    assert(json.folderResolutionMode === "guarded-live-folder-resolution-no-upload", "dry-run uses guarded-live-folder-resolution-no-upload");
    const target = json.singleMasterTargetInput || {};
    assert(target.storageTargetKind === "individual_matter", "target uses individual_matter");
    assert(target.directMatterFileNumber === DIRECT_FILE_NUMBER, "target directMatterFileNumber uses Barsh Matters direct file number");
    assert(target.bmMatterId === DIRECT_FILE_NUMBER, "target bmMatterId uses Barsh Matters direct file number");
    assert(target.displayNumber === DIRECT_FILE_NUMBER, "target displayNumber uses Barsh Matters direct file number");
    const fr = json.folderResolution || {};
    assert(fr.folderId === EXPECTED_FINAL_ID, "folder resolution returns original final direct folder id 22062401000");
    assert(fr.matterFolderId === EXPECTED_FINAL_ID, "matterFolderId is final direct folder id");
    assert(fr.createdFolderCount === 0, "folder resolution creates zero folders");
    assert(fr.reusedFolderCount >= 3, "folder resolution reuses existing direct branch folders");
    const ids = Array.isArray(fr.folderSegments) ? fr.folderSegments.map((s) => Number(s.id)) : [];
    assert(ids.includes(EXPECTED_ROOT_ID), "folder segments include Individual Matters folder id 22062400790");
    assert(ids.includes(EXPECTED_RANGE_ID), "folder segments include BRL range folder id 22062400880");
    assert(ids.includes(EXPECTED_FINAL_ID), "folder segments include final BRL direct folder id 22062401000");
    const createdAny = Array.isArray(fr.folderSegments) && fr.folderSegments.some((s) => s.created === true);
    assert(!createdAny, "no folder segment reports created true");
    const safety = json.safety || {};
    assert(safety.noDocumentUploadPerformed === true, "safety says no document upload performed");
    assert(safety.noDatabaseRecordsChanged === true, "safety says no database records changed");
    assert(safety.noPatientProviderInsurerClaimFolderNames === true, "safety preserves privacy-safe folder naming");
    console.log("CONTRACT: Phase 41J performs live Clio folder lookup only; no upload, no folder create, no delete, no DB mutation, no Graph conversion, and no production env change.");
    console.log("RESULT: Phase 41J live direct folder-resolution no-upload smoke completed");
    if (failed) process.exit(1);
  } finally { stopServer(server.proc); }
})().catch((err) => { console.error(err && err.stack ? err.stack : err); process.exit(1); });
