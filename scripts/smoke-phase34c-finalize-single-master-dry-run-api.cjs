const http = require("http");
const { spawn } = require("child_process");

const PORT = Number(process.env.PHASE34C_PORT || 3317);
const BASE = `http://127.0.0.1:${PORT}`;
const BODY = {
  masterLawsuitId: "2026.05.00001",
  useSingleMasterClioStorage: true,
  singleMasterDryRun: true,
  singleMasterResolveFolders: false
};

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : "";
    const req = http.request(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } }, (res) => {
      let chunks = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => chunks += chunk);
      res.on("end", () => { let json = null; try { json = chunks ? JSON.parse(chunks) : null; } catch {} resolve({ status: res.statusCode, body: chunks, json }); });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}
function assert(condition, message) { if (!condition) throw new Error(message); console.log(`PASS: ${message}`); }
(async () => {
  console.log("RESULT: Phase 34C revised finalize single-master master-lawsuit dry-run API smoke starting");
  const child = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(PORT)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: "", CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "", CLIO_SINGLE_MASTER_LIVE_WRITE_COMMAND: "", PHASE_34C_SMOKE: "1" } });
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) { try { const res = await request("GET", "/", null); if (res.status && res.status < 500) { ready = true; break; } } catch {} await wait(1000); }
    assert(ready, "local dev server became reachable");
    const res = await request("POST", "/api/documents/finalize", BODY);
    console.log("HTTP_STATUS=" + res.status);
    console.log("RESPONSE_JSON=" + JSON.stringify(res.json, null, 2));
    assert(res.status === 200, "finalize dry-run endpoint returned 200");
    assert(res.json && res.json.ok === true, "response ok true");
    assert(res.json.finalizeRewired === true, "finalizeRewired true");
    assert(res.json.uploadRewired === false, "uploadRewired false");
    assert(res.json.databaseMutation === false, "databaseMutation false");
    assert(res.json.clioWrite === false, "clioWrite false when singleMasterResolveFolders false");
    assert(res.json.noUploadPerformed === true, "noUploadPerformed true");
    assert(res.json.confirmUploadRequired === false, "confirmUploadRequired false");
    assert(res.json.generationSkipped === true, "generationSkipped true");
    assert(res.json.singleMasterDryRun === true, "singleMasterDryRun true");
    assert(res.json.singleMasterResolveFolders === false, "singleMasterResolveFolders false");
    assert(res.json.folderResolutionMode === "preview-only-no-clio-call", "preview-only folder resolution mode");
    assert(res.json.singleMasterTargetInput.displayNumber === "2026.05.00001", "target displayNumber is Barsh Matters lawsuit number");
    assert(res.json.singleMasterTargetInput.bmMatterId === "2026.05.00001", "target bmMatterId is Barsh Matters lawsuit number");
    assert(res.json.singleMasterTargetInput.lawsuitId === "2026.05.00001", "target lawsuitId is Barsh Matters lawsuit number");
    assert(res.json.folderResolution.createsFolders === false, "folder resolution createsFolders false");
    assert(res.json.folderResolution.callsClio === false, "folder resolution callsClio false");
    assert(res.json.folderResolution.uploadsDocuments === false, "folder resolution uploadsDocuments false");
    assert(res.json.folderResolution.mutatesDatabase === false, "folder resolution mutatesDatabase false");
    assert(res.json.folderResolution.targetPlan.rootFolderName === "Lawsuits", "target root folder is Lawsuits");
    assert(res.json.folderResolution.targetPlan.groupFolderName === "2026-05", "target group folder is lawsuit month");
    assert(res.json.folderResolution.targetPlan.matterFolderName === "2026.05.00001", "target matter folder is lawsuit number");
    assert(res.json.folderResolution.targetPlan.matterFolderPath === "Lawsuits/2026-05/2026.05.00001", "target folder path is correct");
    console.log("RESULT: Phase 34C revised finalize single-master master-lawsuit dry-run API smoke passed");
  } finally {
    child.kill("SIGTERM");
    await wait(500);
    if (!child.killed) child.kill("SIGKILL");
  }
})().catch((err) => { console.error("FAIL:", err && err.stack ? err.stack : err); process.exit(1); });
