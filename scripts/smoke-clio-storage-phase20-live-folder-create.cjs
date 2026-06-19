#!/usr/bin/env node
const fs = require("fs");

const MASTER_MATTER_ID = "1885821245";
const MASTER_MATTER_NAME = "Barsh Matters Master Repository";
const BUCKET_FOLDER_NAME = "bucket-002001-003000";
const MATTER_FOLDER_NAME = "matter-2026.05.00001";
const COMMAND_PHRASE = "RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE";

function clean(value) { return String(value ?? "").trim(); }
function enabled(value) { return clean(value) === "1"; }
function loadEnvFile(file) {
  if (!file || !fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
  return true;
}

function requireReadiness() {
  const explicit = clean(process.env.CLIO_SINGLE_MASTER_LIVE_WRITE_COMMAND) === COMMAND_PHRASE;
  const createFolders = enabled(process.env.CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED);
  const liveWrite = enabled(process.env.CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED);
  if (!explicit || !createFolders || !liveWrite) {
    throw new Error("Live folder creation blocked. Required: CLIO_SINGLE_MASTER_LIVE_WRITE_COMMAND=" + COMMAND_PHRASE + ", CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1, CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1");
  }
}

async function refreshAccessToken(base) {
  const clientId = clean(process.env.CLIO_CLIENT_ID);
  const clientSecret = clean(process.env.CLIO_CLIENT_SECRET);
  const refreshToken = clean(process.env.CLIO_REFRESH_TOKEN);
  if (!clientId || !clientSecret || !refreshToken) return "";
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("refresh_token", refreshToken);
  const res = await fetch(base.replace(/\/$/, "") + "/oauth/token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.access_token) throw new Error("OAuth refresh failed: " + res.status + " " + res.statusText);
  console.log("PASS: OAuth refresh succeeded in memory only");
  return clean(json.access_token);
}

async function clioRequest(apiBase, path, options, tokenRef) {
  const headers = { Accept: "application/json", ...(options.headers || {}), Authorization: "Bearer " + tokenRef.token };
  let res = await fetch(apiBase + path, { ...options, headers });
  if (res.status !== 401) return res;
  console.log("PASS: Clio request returned 401; attempting memory-only OAuth refresh");
  tokenRef.token = await refreshAccessToken(tokenRef.base);
  res = await fetch(apiBase + path, { ...options, headers: { ...headers, Authorization: "Bearer " + tokenRef.token } });
  return res;
}

async function getJson(res, label) {
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) throw new Error(label + " failed: " + res.status + " " + res.statusText + " " + text.slice(0, 200));
  return json;
}

async function listFolders(apiBase, tokenRef) {
  const fields = encodeURIComponent("id,name,parent{id,name},created_at,updated_at");
  const path = "/folders.json?matter_id=" + encodeURIComponent(MASTER_MATTER_ID) + "&limit=200&fields=" + fields;
  const res = await clioRequest(apiBase, path, { method: "GET" }, tokenRef);
  const json = await getJson(res, "folder inventory GET");
  return Array.isArray(json?.data) ? json.data : [];
}

function findFolder(rows, name, parentId) {
  return rows.find((row) => clean(row.name) === name && clean(row.parent?.id || "") === clean(parentId || ""));
}

function findRootFolder(rows) {
  const withoutParent = rows.find((row) => !clean(row.parent?.id || ""));
  const fallback = rows.length === 1 ? rows[0] : null;
  const root = withoutParent || fallback;
  if (!root || !root.id) {
    console.log("DEBUG_FOLDER_ROWS=" + rows.map((row) => clean(row.id) + ":" + clean(row.name || "unnamed") + ":parent=" + clean(row.parent?.id || "")).join(","));
    throw new Error("Could not identify Clio root folder from master matter inventory");
  }
  console.log("PASS: identified Clio root/container folder id=" + root.id + " name=" + clean(root.name || "unnamed") + " parent=" + clean(root.parent?.id || ""));
  return root;
}

async function createFolder(apiBase, tokenRef, name, parentId) {
  const body = {
    data: {
      name,
      matter: { id: Number(MASTER_MATTER_ID) },
      ...(parentId ? { parent: { id: Number(parentId), type: "Folder" } } : {}),
    },
  };
  const res = await clioRequest(apiBase, "/folders.json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, tokenRef);
  const json = await getJson(res, "folder create POST");
  const data = json?.data || {};
  if (!data.id) throw new Error("folder create response missing id");
  return data;
}

async function findOrCreateFolder(apiBase, tokenRef, name, parentId) {
  let rows = await listFolders(apiBase, tokenRef);
  const existing = findFolder(rows, name, parentId);
  if (existing) {
    console.log("PASS: found existing folder " + name + " id=" + existing.id);
    return { folder: existing, created: false };
  }
  const created = await createFolder(apiBase, tokenRef, name, parentId);
  console.log("PASS: created folder " + name + " id=" + created.id);
  return { folder: created, created: true };
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(process.env.CLIO_PHASE20_ENV_FILE || ".env.vercel.production");
  requireReadiness();
  if (clean(process.env.CLIO_MASTER_MATTER_ID) !== MASTER_MATTER_ID) throw new Error("CLIO_MASTER_MATTER_ID mismatch");
  if (clean(process.env.CLIO_MASTER_MATTER_NAME) !== MASTER_MATTER_NAME) throw new Error("CLIO_MASTER_MATTER_NAME mismatch");
  const base = clean(process.env.CLIO_API_BASE) || "https://app.clio.com";
  const baseTrimmed = base.replace(/\/$/, "");
  const apiBase = baseTrimmed.endsWith("/api/v4") ? baseTrimmed : baseTrimmed + "/api/v4";
  const tokenRef = { token: clean(process.env.CLIO_ACCESS_TOKEN), base: baseTrimmed };
  if (!tokenRef.token) tokenRef.token = await refreshAccessToken(baseTrimmed);
  if (!tokenRef.token) throw new Error("No Clio access token available");

  const matterFields = encodeURIComponent("id,display_number,description");
  const matterRes = await clioRequest(apiBase, "/matters/" + encodeURIComponent(MASTER_MATTER_ID) + ".json?fields=" + matterFields, { method: "GET" }, tokenRef);
  const matterJson = await getJson(matterRes, "master matter GET");
  if (String(matterJson?.data?.id || "") !== MASTER_MATTER_ID) throw new Error("master matter id mismatch");
  console.log("PASS: live Clio master matter ID matched");

  const before = await listFolders(apiBase, tokenRef);
  console.log("INVENTORY_COUNT_BEFORE=" + before.length);
  const rootFolder = findRootFolder(before);
  const bucket = await findOrCreateFolder(apiBase, tokenRef, BUCKET_FOLDER_NAME, rootFolder.id);
  const matter = await findOrCreateFolder(apiBase, tokenRef, MATTER_FOLDER_NAME, bucket.folder.id);
  const after = await listFolders(apiBase, tokenRef);
  console.log("INVENTORY_COUNT_AFTER=" + after.length);
  console.log("BUCKET_FOLDER_ID=" + bucket.folder.id);
  console.log("BUCKET_FOLDER_CREATED=" + bucket.created);
  console.log("MATTER_FOLDER_ID=" + matter.folder.id);
  console.log("MATTER_FOLDER_CREATED=" + matter.created);
  console.log("RESULT: Phase 20 live folder create smoke completed without document upload/database mutation/finalize rewire");
}

main().catch((err) => {
  console.error("FAIL: " + (err && err.message ? err.message : err));
  process.exit(1);
});
