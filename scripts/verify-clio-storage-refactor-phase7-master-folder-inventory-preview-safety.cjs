#!/usr/bin/env node
const fs = require("fs");
const cp = require("child_process");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function clean(value) { return String(value ?? "").trim(); }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

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

async function refreshAccessToken() {
  const clientId = clean(process.env.CLIO_CLIENT_ID);
  const clientSecret = clean(process.env.CLIO_CLIENT_SECRET);
  const refreshToken = clean(process.env.CLIO_REFRESH_TOKEN);
  if (!clientId || !clientSecret || !refreshToken) return "";
  const base = clean(process.env.CLIO_API_BASE) || "https://app.clio.com";
  const tokenUrl = base.replace(/\/$/, "") + "/oauth/token";
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("refresh_token", refreshToken);
  const res = await fetch(tokenUrl, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.access_token) { fail("OAuth refresh failed with status " + res.status + " " + res.statusText); return ""; }
  pass("OAuth refresh succeeded in memory only");
  return clean(json.access_token);
}

async function clioGet(apiBase, path, token) {
  const url = apiBase + path;
  let res = await fetch(url, { method: "GET", headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
  if (res.status !== 401) return { res, token };
  pass("read-only Clio GET returned 401; attempting memory-only OAuth refresh");
  const refreshed = await refreshAccessToken();
  if (!refreshed) return { res, token };
  res = await fetch(url, { method: "GET", headers: { Authorization: "Bearer " + refreshed, Accept: "application/json" } });
  return { res, token: refreshed };
}

const doc = read("docs/implementation/clio-storage-refactor-phase7-master-folder-inventory-preview.md");
const pkg = JSON.parse(read("package.json") || "{}");
const phase6 = read("scripts/verify-clio-storage-refactor-phase6-live-master-readonly-safety.cjs");

for (const token of ["Barsh Matters Master Repository", "1885821245", "CLIO_PHASE7_LIVE=1", "GET/read-only", "bounded, non-secret inventory summary"]) {
  if (doc.includes(token)) pass("Phase 7 doc contains " + token); else fail("Phase 7 doc missing " + token);
}

if (phase6.includes("OAuth refresh succeeded in memory only")) pass("Phase 6 live verifier repair is present"); else fail("Phase 6 live verifier repair missing");
const scriptName = "verify:clio-storage-refactor-phase7-master-folder-inventory-preview-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase7-master-folder-inventory-preview-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

try { cp.execFileSync("node", ["scripts/verify-clio-storage-refactor-phase2-setup-safety.cjs"], { stdio: "inherit" }); pass("Phase 2 verifier still passes"); } catch { fail("Phase 2 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase3-config-contract-safety"], { stdio: "inherit" }); pass("Phase 3 verifier still passes"); } catch { fail("Phase 3 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase4-storage-plan-safety"], { stdio: "inherit" }); pass("Phase 4 verifier still passes"); } catch { fail("Phase 4 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase5-folder-resolution-preview-safety"], { stdio: "inherit" }); pass("Phase 5 verifier still passes"); } catch { fail("Phase 5 verifier failed"); }

async function liveCheck() {
  if (process.env.CLIO_PHASE7_LIVE !== "1") { pass("live Clio inventory skipped unless CLIO_PHASE7_LIVE=1"); return; }
  loadEnvFile(".env.local");
  loadEnvFile(process.env.CLIO_PHASE7_ENV_FILE || ".env.vercel.production");
  const masterId = clean(process.env.CLIO_MASTER_MATTER_ID);
  if (masterId !== "1885821245") { fail("CLIO_MASTER_MATTER_ID is not 1885821245"); return; }
  const base = clean(process.env.CLIO_API_BASE) || "https://app.clio.com";
  let token = clean(process.env.CLIO_ACCESS_TOKEN);
  if (!token) token = await refreshAccessToken();
  if (!token) { fail("No Clio access token available after refresh attempt"); return; }
  const baseTrimmed = base.replace(/\/$/, "");
  const apiBase = baseTrimmed.endsWith("/api/v4") ? baseTrimmed : baseTrimmed + "/api/v4";
  const matterFields = encodeURIComponent("id,display_number,description");
  let result = await clioGet(apiBase, "/matters/" + encodeURIComponent(masterId) + ".json?fields=" + matterFields, token);
  token = result.token;
  let text = await result.res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!result.res.ok) { fail("master matter GET failed with status " + result.res.status + " " + result.res.statusText); return; }
  if (String(json?.data?.id || "") === masterId) pass("live Clio master matter ID matched"); else fail("live Clio master matter ID mismatch");
  const documentFields = encodeURIComponent("id,name,filename,content_type,created_at,updated_at,parent{id,name}");
  const docsPath = "/documents.json?matter_id=" + encodeURIComponent(masterId) + "&limit=50&fields=" + documentFields;
  result = await clioGet(apiBase, docsPath, token);
  text = await result.res.text();
  json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!result.res.ok) { fail("master document inventory GET failed with status " + result.res.status + " " + result.res.statusText); return; }
  const rows = Array.isArray(json?.data) ? json.data : [];
  pass("live Clio master document/folder inventory read succeeded");
  console.log("INVENTORY_COUNT=" + rows.length);
  rows.slice(0, 20).forEach((row, index) => {
    const label = clean(row.name || row.filename || row.id || "unnamed").slice(0, 120);
    const parent = clean(row.parent && row.parent.name ? row.parent.name : "").slice(0, 80);
    console.log("INVENTORY_ROW_" + String(index + 1).padStart(2, "0") + "=" + clean(row.id) + " | " + label + (parent ? " | parent=" + parent : ""));
  });
  pass("live inventory used GET-only Clio data API requests and performed no folder/document/database writes");
}

liveCheck().then(() => {
  if (failed) process.exit(1);
  console.log("RESULT: Clio storage refactor Phase 7 master folder inventory preview verifier passed");
}).catch((err) => {
  console.error("FAIL: live inventory verifier error: " + (err && err.message ? err.message : err));
  process.exit(1);
});
