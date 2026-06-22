const fs = require("fs");

const MASTER_MATTER_ID = 1885821245;
const DOCUMENT_ROOT_FOLDER_ID = 22053807035;

const EXPECTED = {
  rootName: "Individual Matters",
  rootId: 22062400790,
  bucketName: "BRL-202600001-BRL-202600999",
  bucketId: 22062400880,
  finalName: "BRL_202600001",
  finalId: 22062401000,
  path: "Individual Matters/BRL-202600001-BRL-202600999/BRL_202600001"
};

function clean(value) {
  return String(value ?? "").trim();
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

function loadEnv() {
  return {
    ...parseDotEnvFile(".env"),
    ...parseDotEnvFile(".env.local"),
    ...parseDotEnvFile(".env.development"),
    ...parseDotEnvFile(".env.development.local"),
    ...parseDotEnvFile(".env.production"),
    ...parseDotEnvFile(".env.production.local"),
    ...parseDotEnvFile(".env.vercel.production"),
    ...process.env
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log("PASS: " + message);
}

async function clioToken(env) {
  const base = clean(env.CLIO_API_BASE) || "https://app.clio.com";
  const tokenBase = base.replace(/\/api\/v4\/?$/, "");
  const res = await fetch(`${tokenBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: clean(env.CLIO_REFRESH_TOKEN),
      client_id: clean(env.CLIO_CLIENT_ID),
      client_secret: clean(env.CLIO_CLIENT_SECRET)
    })
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) throw new Error(`Clio token refresh failed: ${res.status}`);
  return json.access_token;
}

async function clioGet(path, token, env) {
  const base = clean(env.CLIO_API_BASE) || "https://app.clio.com";
  const apiBase = base.replace(/\/$/, "").endsWith("/api/v4") ? base.replace(/\/$/, "") : `${base.replace(/\/$/, "")}/api/v4`;
  const res = await fetch(`${apiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 800) }; }
  if (!res.ok) throw new Error(`Clio GET failed: ${res.status} ${res.statusText} ${JSON.stringify(json).slice(0, 800)}`);
  return json;
}

async function listChildFolders(parentId, token, env) {
  const fields = encodeURIComponent("id,name,parent{id},created_at,updated_at");
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const json = await clioGet(`/folders.json?matter_id=${MASTER_MATTER_ID}&parent_id=${encodeURIComponent(String(parentId))}&limit=200&page=${page}&fields=${fields}`, token, env);
    const data = Array.isArray(json?.data) ? json.data : [];
    rows.push(...data);
    if (data.length < 200) break;
  }
  return rows;
}

async function listFolderDocuments(folderId, token, env) {
  const fields = encodeURIComponent("id,name,parent{id,type},latest_document_version{id,fully_uploaded}");
  const json = await clioGet(`/documents.json?parent_id=${encodeURIComponent(String(folderId))}&limit=200&fields=${fields}`, token, env);
  return Array.isArray(json?.data) ? json.data : [];
}

async function requireExactOneChild(parentId, expectedName, expectedId, token, env) {
  const children = await listChildFolders(parentId, token, env);
  const matches = children.filter((row) => clean(row?.name) === expectedName);
  console.log(`MATCHES_UNDER_${parentId}_${expectedName.replace(/[^A-Za-z0-9]+/g, "_")}=` + JSON.stringify(matches.map((row) => ({
    id: row.id,
    name: row.name,
    parentId: row.parent?.id,
    created_at: row.created_at,
    updated_at: row.updated_at
  })), null, 2));
  assert(matches.length === 1, `exactly one child named ${expectedName} exists under parent ${parentId}`);
  assert(Number(matches[0].id) === expectedId, `child ${expectedName} reuses expected folder id ${expectedId}`);
  return matches[0];
}

(async () => {
  console.log("RESULT: Phase 41B live direct/individual exact-child reuse no-upload smoke starting");
  console.log("CONTRACT: read-only live Clio folder lookup only. No folder create, no upload, no DB mutation.");

  const env = loadEnv();
  for (const key of ["CLIO_CLIENT_ID", "CLIO_CLIENT_SECRET", "CLIO_REFRESH_TOKEN"]) {
    assert(clean(env[key]).length > 0, `${key} present without printing value`);
  }

  const token = await clioToken(env);

  const root = await requireExactOneChild(DOCUMENT_ROOT_FOLDER_ID, EXPECTED.rootName, EXPECTED.rootId, token, env);
  const bucket = await requireExactOneChild(root.id, EXPECTED.bucketName, EXPECTED.bucketId, token, env);
  const finalFolder = await requireExactOneChild(bucket.id, EXPECTED.finalName, EXPECTED.finalId, token, env);

  const docs = await listFolderDocuments(finalFolder.id, token, env);
  console.log("FINAL_FOLDER_DOCUMENT_COUNT=" + docs.length);
  assert(Number(finalFolder.id) === EXPECTED.finalId, "final direct/individual folder id is original Phase 35A id");
  assert(EXPECTED.path === "Individual Matters/BRL-202600001-BRL-202600999/BRL_202600001", "expected direct/individual path is locked");
  assert(!EXPECTED.path.match(/patient|provider|insurer|claim|denial/i), "direct/individual path contains no private matter facts");

  console.log("PHASE41B_DIRECT_PATH=" + EXPECTED.path);
  console.log("PHASE41B_INDIVIDUAL_MATTERS_FOLDER_ID=" + EXPECTED.rootId);
  console.log("PHASE41B_BUCKET_FOLDER_ID=" + EXPECTED.bucketId);
  console.log("PHASE41B_FINAL_FOLDER_ID=" + EXPECTED.finalId);
  console.log("PHASE41B_CREATED_FOLDER_COUNT=0");
  console.log("PHASE41B_UPLOAD_PERFORMED=false");
  console.log("PHASE41B_DATABASE_MUTATION=false");
  console.log("RESULT: Phase 41B live direct/individual exact-child reuse no-upload smoke passed");
})().catch((err) => {
  console.error("FAIL:", err && err.stack ? err.stack : err);
  process.exit(1);
});
