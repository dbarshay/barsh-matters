const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");

const PORT = Number(process.env.PHASE34M_PORT || 3321);
const BASE = `http://127.0.0.1:${PORT}`;

const BODY = {
  masterLawsuitId: "2026.05.00001",
  useSingleMasterClioStorage: true,
  singleMasterDryRun: true,
  singleMasterResolveFolders: true
};

function redact(value) {
  return String(value || "")
    .replace(/(client_secret=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/(refresh_token=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/(access_token=)[^&\s"]+/gi, "$1***REDACTED***")
    .replace(/(Authorization:\s*Bearer\s+)[^\s"]+/gi, "$1***REDACTED***")
    .replace(/(CLIO_CLIENT_SECRET=).+/gi, "$1***REDACTED***")
    .replace(/(CLIO_REFRESH_TOKEN=).+/gi, "$1***REDACTED***")
    .replace(/(DATABASE_URL=).+/gi, "$1***REDACTED***");
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function mergeNonEmptyEnvFiles(filePaths) {
  const out = {};
  for (const filePath of filePaths) {
    const parsed = parseDotEnvFile(filePath);
    for (const [key, value] of Object.entries(parsed)) {
      if (String(value || "").trim().length > 0) {
        out[key] = value;
      }
    }
  }
  return out;
}

function loadLocalEnvWithoutPrintingSecrets() {
  return {
    ...mergeNonEmptyEnvFiles([
      ".env",
      ".env.local",
      ".env.development",
      ".env.development.local",
      ".env.production",
      ".env.production.local",
      ".env.vercel.production",
    ]),
    ...process.env,
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : "";
    const req = http.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      },
      (res) => {
        let chunks = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          chunks += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = chunks ? JSON.parse(chunks) : null;
          } catch {}
          resolve({ status: res.statusCode, body: chunks, json });
        });
      }
    );

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

(async () => {
  console.log("RESULT: Phase 34M diagnostic live finalize folder resolution no-upload smoke starting");
  console.log("CONTRACT: this smoke may create/reuse Clio folders only; it must not upload documents or mutate DB");

  const localEnv = loadLocalEnvWithoutPrintingSecrets();
  for (const key of ["CLIO_CLIENT_ID", "CLIO_CLIENT_SECRET", "CLIO_REFRESH_TOKEN"]) {
    assert(String(localEnv[key] || "").trim().length > 0, key + " present without printing value");
  }

  let serverLog = "";
  const child = spawn(
    "npm",
    ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(PORT)],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...localEnv,
        CLIO_SINGLE_MASTER_LIVE_WRITE_COMMAND: "RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE",
        CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: "1",
        CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "1",
        CLIO_SINGLE_MASTER_ROOT_FOLDER_ID: localEnv.CLIO_SINGLE_MASTER_ROOT_FOLDER_ID || localEnv.CLIO_DOCUMENTS_ROOT_FOLDER_ID || "22053807035",
        PHASE_34M_SMOKE: "1"
      }
    }
  );

  child.stdout.on("data", (chunk) => {
    serverLog += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    serverLog += chunk.toString();
  });

  try {
    let ready = false;

    for (let i = 0; i < 60; i++) {
      try {
        const res = await request("GET", "/", null);
        if (res.status && res.status < 500) {
          ready = true;
          break;
        }
      } catch {}
      await wait(1000);
    }

    assert(ready, "local dev server became reachable");

    const res = await request("POST", "/api/documents/finalize", BODY);

    console.log("HTTP_STATUS=" + res.status);
    console.log("RESPONSE_JSON=" + JSON.stringify(res.json, null, 2));

    if (res.status !== 200 || !res.json) {
      console.log("RESPONSE_BODY_REDACTED_START");
      console.log(redact(res.body).slice(0, 12000));
      console.log("RESPONSE_BODY_REDACTED_END");
      console.log("SERVER_LOG_REDACTED_START");
      console.log(redact(serverLog).slice(-20000));
      console.log("SERVER_LOG_REDACTED_END");
      throw new Error("Phase 34M diagnostic captured non-200/non-JSON response");
    }

    assert(res.json.ok === true, "response ok true");
    assert(res.json.uploadRewired === false, "uploadRewired false");
    assert(res.json.databaseMutation === false, "databaseMutation false");
    assert(res.json.clioWrite === true, "clioWrite true for folder resolution only");
    assert(res.json.noUploadPerformed === true, "noUploadPerformed true");
    assert(res.json.generationSkipped === true, "generationSkipped true");

    const resolution = res.json.folderResolution || {};
    const plan = resolution.targetPlan || {};
    assert(plan.matterFolderPath === "Lawsuits/2026-05/2026.05.00001", "target folder path is taxonomy path");
    assert(Array.isArray(resolution.folderSegments), "folderSegments returned");
    assert(resolution.folderSegments.length === 3, "three folder segments resolved");
    assert(Number(resolution.folderId) > 0, "final folder id returned");

    console.log("CREATED_FOLDER_COUNT=" + resolution.createdFolderCount);
    console.log("REUSED_FOLDER_COUNT=" + resolution.reusedFolderCount);
    console.log("FINAL_FOLDER_ID=" + resolution.folderId);

    console.log("PASS: no document upload was performed by this live folder-resolution smoke");
    console.log("PASS: no database mutation was performed by this live folder-resolution smoke");
    console.log("RESULT: Phase 34M live finalize folder resolution no-upload smoke passed");
  } finally {
    child.kill("SIGTERM");
    await wait(500);
    if (!child.killed) child.kill("SIGKILL");
  }
})().catch((err) => {
  console.error("FAIL:", err && err.stack ? redact(err.stack) : redact(err));
  process.exit(1);
});
