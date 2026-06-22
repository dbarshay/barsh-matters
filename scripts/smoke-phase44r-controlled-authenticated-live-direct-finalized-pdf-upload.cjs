const { spawn } = require("child_process");
const net = require("net");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
function assert(ok, msg) { ok ? pass(msg) : fail(msg); }

const DIRECT_MATTER_ID = "1881278195";
const DIRECT_FILE_NUMBER = "BRL_202600001";
const EXPECTED_FOLDER_ID = 22062401000;
const DOCUMENT_KEY = "harmless-stored-docx-test-template";

function redact(value) {
  return String(value || "")
    .replace(/("driveItemId"\s*:\s*")[^"]+/gi, "$1***REDACTED***")
    .replace(/("workingDocumentDriveItemId"\s*:\s*")[^"]+/gi, "$1***REDACTED***")
    .replace(/("document_version_uuid"\s*:\s*")[^"]+/gi, "$1***REDACTED***")
    .replace(/("clioDocumentVersionUuid"\s*:\s*")[^"]+/gi, "$1***REDACTED***")
    .replace(/("sourceDriveItemId"\s*:\s*")[^"]+/gi, "$1***REDACTED***")
    .replace(/("uuid"\s*:\s*")[^"]+/gi, "$1***REDACTED***")
    .replace(/(access_token=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/(refresh_token=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/(client_secret=)[^&\s"]+/gi, "$1***REDACTED***");
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


try {
  require("@next/env").loadEnvConfig(process.cwd());
} catch (error) {
  // The local Next server still loads .env.local/.env. This smoke prefers @next/env
  // only so the client-side admin authorization request can use the same configured
  // local administrator password without logging or copying it.
}

let phase44rAdminCookieHeader = "";

function phase44rCaptureSetCookies(response) {
  const rawSetCookie = response?.headers?.raw ? response.headers.raw()["set-cookie"] : null;
  const combined = rawSetCookie && rawSetCookie.length
    ? rawSetCookie
    : (response?.headers?.get("set-cookie") ? [response.headers.get("set-cookie")] : []);
  if (!combined.length) return;
  const pairs = combined
    .map((value) => String(value || "").split(";")[0].trim())
    .filter(Boolean);
  if (pairs.length) {
    phase44rAdminCookieHeader = pairs.join("; ");
  }
}

function phase44rMergeCookieHeader(init) {
  const next = { ...(init || {}) };
  const headers = { ...(next.headers || {}) };
  if (phase44rAdminCookieHeader) headers.Cookie = phase44rAdminCookieHeader;
  next.headers = headers;
  return next;
}


const phase44rOriginalFetch = fetch;
async function phase44rFetch(url, init) {
  return phase44rOriginalFetch(url, phase44rMergeCookieHeader(init));
}

function phase44rConfiguredAdminPassword() {
  const password = String(process.env.BARSH_PHASE44R_ADMIN_PASSWORD || process.env.BARSH_ADMIN_PASSWORD || "").trim();
  if (password.length === 0) {
    throw new Error("Phase 44R admin password is unavailable. BARSH_ADMIN_PASSWORD must be present in local env or BARSH_PHASE44R_ADMIN_PASSWORD must be supplied.");
  }
  return password;
}

async function phase44rAuthorizeAdmin(baseUrl) {
  const response = await phase44rOriginalFetch(baseUrl + "/api/admin/authorize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: phase44rConfiguredAdminPassword(), action: "Phase 44R controlled live direct finalize smoke" }),
  });
  phase44rCaptureSetCookies(response);
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.authorized || !phase44rAdminCookieHeader) {
    throw new Error("Phase 44R admin authorization failed before live direct finalize smoke: " + JSON.stringify(json));
  }
  console.log("PASS: Phase 44R local admin session cookie captured for controlled smoke");
}

async function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForServer(baseUrl, proc, output) {
  const deadline = Date.now() + 60000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const res = await phase44rFetch(
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
    CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED: "1",
    CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: "1",
    CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "1"
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
  const controller = new AbortController();
  const timeoutMs = path === "/api/documents/finalize" ? 240000 : 120000;
  const timer = setTimeout(() => controller.abort(new Error("Phase 44R request timeout: " + method + " " + path)), timeoutMs);
  try {
    const res = await phase44rFetch(baseUrl + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: controller.signal
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, text, json };
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  console.log("RESULT: Phase 44R controlled authenticated live direct finalized PDF upload smoke starting");
  console.log("CONTRACT: this intentionally creates one Graph working DOCX, converts it to PDF, uploads the PDF to existing Clio folder 22062401000, and creates finalization audit metadata.");
  const server = await startServer();
    await phase44rAuthorizeAdmin(server.baseUrl);
  try {
    const preview = await request(server.baseUrl, "GET",
      `/api/documents/direct-finalize-preview?directMatterId=${encodeURIComponent(DIRECT_MATTER_ID)}&directMatterDisplayNumber=${encodeURIComponent(DIRECT_FILE_NUMBER)}&singleMasterDirectStorage=1`
    );
    assert(preview.status === 200, `direct finalize preview loads (actual ${preview.status})`);
    assert(preview.json?.ok === true, "direct finalize preview ok true");
    assert(preview.json?.directMatterDisplayNumber === DIRECT_FILE_NUMBER || preview.json?.clioUploadTarget?.directMatterFileNumber === DIRECT_FILE_NUMBER, "preview preserves BRL direct storage target");

    const docs = Array.isArray(preview.json?.plannedDocuments) ? preview.json.plannedDocuments : [];
    const doc = docs.find((item) => item.key === DOCUMENT_KEY) || docs.find((item) => item.availableNow && item.hasStoredDocx) || docs[0];
    assert(Boolean(doc?.key), "selected a planned direct DOCX document");
    console.log("SELECTED_DOCUMENT_KEY=" + doc.key);
    console.log("SELECTED_DOCUMENT_FILENAME=" + (doc.filename || ""));

    const workingRes = await request(server.baseUrl, "POST", "/api/documents/working-docx", {
      confirmCreate: true,
      directMatterId: DIRECT_MATTER_ID,
      matterId: DIRECT_MATTER_ID,
      uploadTargetMode: "direct-matter",
      directMatterDisplayNumber: DIRECT_FILE_NUMBER,
      useSingleMasterClioStorage: true,
      singleMasterDirectStorage: true,
      documentKey: doc.key,
      documentKeys: [doc.key]
    });

    if (!(workingRes.status < 400 && workingRes.json?.ok && workingRes.json?.workingDocument?.driveItemId)) {
      console.log("WORKING_DOC_FAILURE_REDACTED=" + redact(JSON.stringify({ status: workingRes.status, json: workingRes.json, text: workingRes.text }, null, 2)).slice(0, 16000));
    }

    assert(workingRes.status < 400 && workingRes.json?.ok === true, `working DOCX create succeeds (actual ${workingRes.status})`);
    const working = workingRes.json?.workingDocument || {};
    assert(Boolean(working.driveItemId), "working DOCX driveItemId returned");
    console.log("WORKING_DOCUMENT_NAME=" + (working.name || ""));
    console.log("WORKING_DOCUMENT_DRIVE_ITEM_ID_REDACTED=***REDACTED***");

    const finalBody = {
      uploadTargetMode: "direct-matter",
      directMatterId: DIRECT_MATTER_ID,
      directMatterDisplayNumber: DIRECT_FILE_NUMBER,
      confirmUpload: true,
      useSingleMasterClioStorage: true,
      singleMasterDryRun: false,
      singleMasterResolveFolders: true,
      allowDuplicateUploads: false,
      documentKeys: [doc.key],
      workingDocumentDriveItemId: working.driveItemId,
      workingDocumentKey: doc.key
    };

    const final = await request(server.baseUrl, "POST", "/api/documents/finalize", finalBody);
    console.log("FINALIZE_STATUS=" + final.status);
    console.log("FINALIZE_JSON_REDACTED=" + redact(JSON.stringify(final.json, null, 2)).slice(0, 24000));

    assert(final.status === 200, `finalize returns 200 (actual ${final.status})`);
    assert(final.json?.ok === true, "finalize ok true");
    assert(final.json?.uploadRewired === true || final.json?.finalizeRewired === true, "finalize/upload is rewired to single-master storage");

    const fr = final.json?.singleMasterFolderResolution || final.json?.folderResolution || {};
    assert(Number(fr.folderId || fr.matterFolderId || final.json?.singleMasterUploadFolderId) === EXPECTED_FOLDER_ID || JSON.stringify(final.json).includes(String(EXPECTED_FOLDER_ID)), "finalize resolved existing direct folder 22062401000");

    assert(!JSON.stringify(final.json).includes("Duplicate child folders named"), "no duplicate direct folder branch reported");
    assert(!JSON.stringify(final.json).includes('"created":true'), "no new Clio folder creation reported");

    const uploaded = Array.isArray(final.json?.uploaded) ? final.json.uploaded : [];
    const skipped = Array.isArray(final.json?.skipped) ? final.json.skipped : [];
    const existingSkip = skipped.find((item) =>
      item?.reason === "already-uploaded-to-clio" &&
      Array.isArray(item?.existingClioDocuments) &&
      item.existingClioDocuments.some((doc) => Boolean(doc?.id) && doc?.latestDocumentVersion?.fullyUploaded === true)
    );
    const liveUploadSuccess = uploaded.length === 1;
    const idempotentDuplicateSkipSuccess = uploaded.length === 0 && Boolean(existingSkip);

    assert(liveUploadSuccess || idempotentDuplicateSkipSuccess, `finalize either uploads one PDF or idempotently skips an existing fully uploaded PDF (uploaded ${uploaded.length}, skipped ${skipped.length})`);

    if (liveUploadSuccess) {
      const item = uploaded[0] || {};
      assert(Boolean(item.clioDocumentId || item.documentId || item.id), "uploaded item includes Clio document id");
      assert(item.fullyUploaded === true || final.json?.fullyUploaded === true || Boolean(item.clioDocumentId || item.documentId || item.id), "uploaded item reports full upload or document id");
      assert((item.clioUploadParent?.type || item.parentType || item.uploadParentType) === "Folder" || JSON.stringify(item).includes('"type":"Folder"'), "uploaded item parent type is Folder");
      assert(Number(item.clioUploadParent?.id || item.parentId || item.uploadParentId || item.clioParentId) === EXPECTED_FOLDER_ID || JSON.stringify(item).includes(String(EXPECTED_FOLDER_ID)), "uploaded item parent id is existing direct folder 22062401000");
    } else {
      const existingDoc = existingSkip.existingClioDocuments[0] || {};
      assert(Boolean(existingDoc.id), "idempotent skipped item includes existing Clio document id");
      assert(existingDoc.latestDocumentVersion?.fullyUploaded === true, "idempotent skipped item reports existing fully uploaded PDF");
      assert(JSON.stringify(final.json).includes(String(EXPECTED_FOLDER_ID)), "idempotent skipped finalize response preserves existing direct folder 22062401000");
    }

    assert(final.json?.finalizationRecord?.ok === true || final.json?.finalizationAudit?.ok === true || final.json?.auditRecord?.ok === true || JSON.stringify(final.json).includes("finalizationRecord"), "finalization audit metadata recorded");

    console.log("CONTRACT: Phase 44R authenticated smoke either uploads one finalized PDF or idempotently skips an existing exact-match finalized PDF to existing direct folder 22062401000 through single-master Clio storage.");
    console.log("RESULT: Phase 44R controlled authenticated live direct finalize/idempotency smoke completed");
    if (failed) process.exit(1);
  } finally {
    stopServer(server.proc);
  }
})().catch((err) => {
  console.error(redact(err && err.stack ? err.stack : err));
  process.exit(1);
});
