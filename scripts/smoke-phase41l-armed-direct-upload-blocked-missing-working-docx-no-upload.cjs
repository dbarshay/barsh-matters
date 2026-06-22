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
    try {
      const res = await fetch(baseUrl + "/api/documents/finalize", { method: "OPTIONS" });
      if (res.status >= 200 || res.status === 405) return;
    } catch (err) { lastError = err && err.message ? err.message : String(err); }
    if (proc.exitCode != null) throw new Error(`local Next server exited early with code ${proc.exitCode}. Output:\n${output.join("")}`);
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
      CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED: "1",
      CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: "1",
      CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "1",
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
    uploadTargetMode: "direct-matter",
    directMatterId: "1881278195",
    directMatterDisplayNumber: DIRECT_FILE_NUMBER,
    confirmUpload: true,
    useSingleMasterClioStorage: true,
    singleMasterDryRun: false,
    singleMasterResolveFolders: true,
    allowDuplicateUploads: false,
    documentKeys: ["harmless-stored-docx-test-template"]
  };
  const res = await fetch(baseUrl + "/api/documents/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}
(async () => {
  console.log("RESULT: Phase 41L armed direct upload blocked by missing working-DOCX no-upload smoke starting");
  const server = await startServer();
  try {
    const result = await postFinalize(server.baseUrl);
    assert(result.status >= 400, `armed direct upload without working DOCX is blocked (actual ${result.status})`);
    const json = result.json || {};
    assert(json.ok === false, "blocked response ok false");
    assert(/saved working Word document|Edit Document|working.*docx|workingDocumentDriveItemId|working document/i.test(result.text), "blocked response names saved working Word document requirement");
    assert(/Finalize Document now requires a saved working Word document|saved working Word document|Edit Document/i.test(result.text), "route reached saved working-document guard before Graph/upload");
    assert(Array.isArray(json.uploaded) && json.uploaded.length === 0, "blocked response uploaded array is empty");
    assert(Array.isArray(json.skipped) && json.skipped.length === 0, "blocked response skipped array is empty");
    assert(json.safety?.noDatabaseRecordsChanged === true, "blocked response says no database records changed");
    assert(!/uploadedToResolvedSingleMasterFolder\"\s*:\s*true/.test(result.text), "response does not report resolved-folder upload");
    assert(!/clioDocumentId\"\s*:\s*\d+/.test(result.text), "response does not contain uploaded Clio document id");
    assert(!/documentVersionUuid/.test(result.text), "response does not contain uploaded document version uuid");
    console.log("CONTRACT: Phase 41L enables local flags only to reach missing working-DOCX block; no Graph conversion, Clio upload, folder create, delete, DB mutation, or production env change.");
    console.log("RESULT: Phase 41L armed direct upload blocked by missing working-DOCX no-upload smoke completed");
    if (failed) process.exit(1);
  } finally { stopServer(server.proc); }
})().catch((err) => { console.error(err && err.stack ? err.stack : err); process.exit(1); });
