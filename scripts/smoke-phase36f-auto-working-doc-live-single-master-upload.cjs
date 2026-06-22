const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");

const PORT = Number(process.env.PHASE36F_PORT || 3326);
const BASE = `http://127.0.0.1:${PORT}`;
const MASTER_LAWSUIT_ID = process.env.PHASE36F_MASTER_LAWSUIT_ID || "2026.05.00001";
const REQUESTED_KEY = process.env.PHASE36F_DOCUMENT_KEY || "";

function redact(value) {
  return String(value || "")
    .replace(/(client_secret=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/(refresh_token=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/(access_token=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/(Authorization:\s*Bearer\s+)[^\s"]+/gi, "$1***REDACTED***")
    .replace(/(CLIO_CLIENT_SECRET=).+/gi, "$1***REDACTED***")
    .replace(/(CLIO_REFRESH_TOKEN=).+/gi, "$1***REDACTED***")
    .replace(/(DATABASE_URL=).+/gi, "$1***REDACTED***")
    .replace(/("driveItemId"\s*:\s*")[^"]+/gi, "$1***REDACTED***")
    .replace(/("id"\s*:\s*")[A-Za-z0-9!._-]{20,}/gi, "$1***REDACTED***");
}

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

function mergeNonEmptyEnvFiles(filePaths) {
  const out = {};
  for (const filePath of filePaths) {
    const parsed = parseDotEnvFile(filePath);
    for (const [key, value] of Object.entries(parsed)) {
      if (String(value || "").trim()) out[key] = value;
    }
  }
  return out;
}

function loadLocalEnvWithoutPrintingSecrets() {
  return {
    ...mergeNonEmptyEnvFiles([".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local", ".env.vercel.production"]),
    ...process.env,
  };
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : "";
    const req = http.request(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    }, (res) => {
      let chunks = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { chunks += chunk; });
      res.on("end", () => {
        let json = null;
        try { json = chunks ? JSON.parse(chunks) : null; } catch {}
        resolve({ status: res.statusCode, body: chunks, json });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

function pickDoc(previewJson) {
  const planned = Array.isArray(previewJson?.plannedDocuments) ? previewJson.plannedDocuments : [];
  if (REQUESTED_KEY) return planned.find((d) => d && d.key === REQUESTED_KEY);
  return planned.find((d) => d && d.wouldGenerate && d.wouldUploadToClio && d.key);
}

function workingDocPayloads(doc, previewJson) {
  return [
    {
      confirmCreate: true,
      masterLawsuitId: MASTER_LAWSUIT_ID,
      documentKey: doc.key,
      templateKey: doc.key,
      sourceEndpoint: doc.sourceEndpoint,
      filename: doc.filename,
      label: doc.label
    },
    {
      confirmCreate: true,
      masterLawsuitId: MASTER_LAWSUIT_ID,
      selectedDocumentKey: doc.key,
      documentKey: doc.key,
      sourceEndpoint: doc.sourceEndpoint,
      filename: doc.filename,
      label: doc.label
    },
    {
      confirmCreate: true,
      masterLawsuitId: MASTER_LAWSUIT_ID,
      document: doc,
      selectedDocument: doc,
      packetSummary: previewJson?.packetSummary || null
    },
    {
      confirmCreate: true,
      masterLawsuitId: MASTER_LAWSUIT_ID,
      documentKey: doc.key
    }
  ];
}

(async () => {
  console.log("RESULT: Phase 36F auto working-doc + live finalized PDF upload smoke starting");
  console.log("CONTRACT: this intentionally creates one Graph working DOCX, converts it to PDF, uploads the PDF to the resolved single-master Clio folder, and creates the finalization DB audit record.");

  const localEnv = loadLocalEnvWithoutPrintingSecrets();
  for (const key of ["CLIO_CLIENT_ID", "CLIO_CLIENT_SECRET", "CLIO_REFRESH_TOKEN"]) {
    assert(String(localEnv[key] || "").trim().length > 0, key + " present without printing value");
  }

  let serverLog = "";
  const child = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...localEnv,
      CLIO_STORAGE_MODE: "single_master_matter",
      CLIO_MASTER_MATTER_ID: localEnv.CLIO_MASTER_MATTER_ID || "1885821245",
      CLIO_MASTER_MATTER_NAME: localEnv.CLIO_MASTER_MATTER_NAME || "Barsh Matters Master Repository",
      CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED: "1",
      CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: "1",
      CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "1",
      CLIO_SINGLE_MASTER_LIVE_WRITE_COMMAND: "RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE",
      CLIO_SINGLE_MASTER_ROOT_FOLDER_ID: localEnv.CLIO_SINGLE_MASTER_ROOT_FOLDER_ID || localEnv.CLIO_DOCUMENTS_ROOT_FOLDER_ID || "22053807035",
      PHASE_36F_SMOKE: "1"
    }
  });

  child.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
  child.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });

  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        const res = await request("GET", "/", null);
        if (res.status && res.status < 500) { ready = true; break; }
      } catch {}
      await wait(1000);
    }
    assert(ready, "local dev server became reachable");

    const preview = await request("GET", `/api/documents/finalize-preview?masterLawsuitId=${encodeURIComponent(MASTER_LAWSUIT_ID)}`, null);
    console.log("PREVIEW_STATUS=" + preview.status);
    assert(preview.status === 200 && preview.json, "finalize preview loaded");

    const doc = pickDoc(preview.json);
    assert(Boolean(doc), "selected uploadable planned document");
    assert(doc.wouldGenerate === true && doc.wouldUploadToClio === true, "selected document is uploadable");
    console.log("SELECTED_DOCUMENT_KEY=" + doc.key);
    console.log("SELECTED_DOCUMENT_FILENAME=" + doc.filename);

    let working = null;
    let lastWorkingFailure = null;

    for (const payload of workingDocPayloads(doc, preview.json)) {
      const res = await request("POST", "/api/documents/working-docx", payload);
      if (res.status < 400 && res.json?.ok && res.json?.workingDocument?.driveItemId) {
        working = res.json.workingDocument;
        break;
      }
      lastWorkingFailure = { status: res.status, json: res.json, body: res.body };
    }

    if (!working?.driveItemId) {
      console.log("WORKING_DOC_FAILURE_REDACTED=" + redact(JSON.stringify(lastWorkingFailure, null, 2)).slice(0, 12000));
      throw new Error("Could not auto-create working DOCX driveItemId through /api/documents/working-docx.");
    }

    console.log("WORKING_DOCUMENT_NAME=" + working.name);
    console.log("WORKING_DOCUMENT_DRIVE_ITEM_ID_REDACTED=***REDACTED***");

    const body = {
      masterLawsuitId: MASTER_LAWSUIT_ID,
      confirmUpload: true,
      useSingleMasterClioStorage: true,
      singleMasterDryRun: false,
      singleMasterResolveFolders: true,
      allowDuplicateUploads: true,
      documentKeys: [doc.key],
      workingDocumentDriveItemId: working.driveItemId,
      workingDocumentKey: doc.key
    };

    const final = await request("POST", "/api/documents/finalize", body);
    console.log("FINALIZE_STATUS=" + final.status);
    console.log("FINALIZE_JSON_REDACTED=" + redact(JSON.stringify(final.json, null, 2)).slice(0, 24000));

    if (final.status !== 200 || !final.json || final.json.ok !== true) {
      console.log("FINALIZE_BODY_REDACTED_START");
      console.log(redact(final.body).slice(0, 12000));
      console.log("FINALIZE_BODY_REDACTED_END");
      console.log("SERVER_LOG_REDACTED_START");
      console.log(redact(serverLog).slice(-24000));
      console.log("SERVER_LOG_REDACTED_END");
      throw new Error("Phase 36F expected HTTP 200 ok true live upload response.");
    }

    assert(final.json.uploadRewired === true, "uploadRewired true");
    assert(final.json.folderResolution && Number(final.json.folderResolution.folderId) > 0, "folderResolution final folder id returned");
    assert(Array.isArray(final.json.uploaded) && final.json.uploaded.length === 1, "exactly one document uploaded");
    const uploaded = final.json.uploaded[0];
    assert(uploaded.clioUploadParent?.type === "Folder", "uploaded parent type is Folder");
    assert(Number(uploaded.clioUploadParent?.id) === Number(final.json.folderResolution.folderId), "uploaded parent id matches resolved folder id");
    assert(Number(uploaded.clioDocumentId) > 0, "Clio document id returned");
    assert(uploaded.fullyUploaded === true, "Clio fullyUploaded true");
    assert(final.json.finalizationRecord && final.json.finalizationRecord.ok === true, "database audit record created");
    assert(final.json.safety?.uploadedToResolvedSingleMasterFolder === true, "safety confirms resolved single-master folder upload");

    console.log("FINAL_FOLDER_ID=" + final.json.folderResolution.folderId);
    console.log("CLIO_DOCUMENT_ID=" + uploaded.clioDocumentId);
    console.log("FINALIZATION_RECORD_ID=" + final.json.finalizationRecord.id);
    console.log("RESULT: Phase 36F live finalized PDF upload to resolved single-master Clio folder passed");
  } catch (err) {
    console.log("SERVER_LOG_REDACTED_START");
    console.log(redact(serverLog).slice(-24000));
    console.log("SERVER_LOG_REDACTED_END");
    throw err;
  } finally {
    child.kill("SIGTERM");
    await wait(500);
    if (!child.killed) child.kill("SIGKILL");
  }
})().catch((err) => {
  console.error("FAIL:", err && err.stack ? redact(err.stack) : redact(err));
  process.exit(1);
});
