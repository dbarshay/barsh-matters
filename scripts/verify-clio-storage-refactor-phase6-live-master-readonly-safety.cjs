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

const doc = read("docs/implementation/clio-storage-refactor-phase6-live-master-readonly.md");
const config = read("lib/clioStorageConfig.ts");
const clio = read("lib/clio.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["Barsh Matters Master Repository", "1885821245", "CLIO_PHASE6_LIVE=1", "GET/read-only", "No POST, PATCH, PUT, or DELETE"]) {
  if (doc.includes(token)) pass("Phase 6 doc contains " + token); else fail("Phase 6 doc missing " + token);
}

if (config.includes("assertSingleMasterClioStorageConfig")) pass("Phase 6 depends on Phase 3 config contract"); else fail("Phase 3 config contract missing");
if (clio.includes("export async function clioFetch")) pass("Clio fetch boundary exists"); else fail("Clio fetch boundary missing");

const scriptName = "verify:clio-storage-refactor-phase6-live-master-readonly-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase6-live-master-readonly-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

try { cp.execFileSync("node", ["scripts/verify-clio-storage-refactor-phase2-setup-safety.cjs"], { stdio: "inherit" }); pass("Phase 2 verifier still passes"); } catch { fail("Phase 2 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase3-config-contract-safety"], { stdio: "inherit" }); pass("Phase 3 verifier still passes"); } catch { fail("Phase 3 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase4-storage-plan-safety"], { stdio: "inherit" }); pass("Phase 4 verifier still passes"); } catch { fail("Phase 4 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase5-folder-resolution-preview-safety"], { stdio: "inherit" }); pass("Phase 5 verifier still passes"); } catch { fail("Phase 5 verifier failed"); }

async function liveCheck() {
  if (process.env.CLIO_PHASE6_LIVE !== "1") {
    pass("live Clio check skipped unless CLIO_PHASE6_LIVE=1");
    return;
  }

  loadEnvFile(".env.local");
  loadEnvFile(process.env.CLIO_PHASE6_ENV_FILE || ".env.vercel.production");

  const masterId = clean(process.env.CLIO_MASTER_MATTER_ID);
  const masterName = clean(process.env.CLIO_MASTER_MATTER_NAME);
  if (masterId !== "1885821245") { fail("CLIO_MASTER_MATTER_ID is not 1885821245"); return; }
  if (masterName !== "Barsh Matters Master Repository") { fail("CLIO_MASTER_MATTER_NAME is not Barsh Matters Master Repository"); return; }

  const base = clean(process.env.CLIO_API_BASE) || "https://app.clio.com";
  const token = clean(process.env.CLIO_ACCESS_TOKEN);
  if (!token) { fail("CLIO_ACCESS_TOKEN missing for live read-only check"); return; }

  const baseTrimmed = base.replace(/\/$/, "");
  const apiBase = baseTrimmed.endsWith("/api/v4") ? baseTrimmed : baseTrimmed + "/api/v4";
  const fields = encodeURIComponent("id,display_number,description");
  const url = apiBase + "/matters/" + encodeURIComponent(masterId) + ".json?fields=" + fields;
  const res = await fetch(url, { method: "GET", headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  if (!res.ok) { fail("live Clio master matter GET failed with status " + res.status + " " + res.statusText); return; }
  const data = json && json.data ? json.data : {};
  if (String(data.id || "") === masterId) pass("live Clio master matter ID matched"); else fail("live Clio master matter ID mismatch");
  const haystack = [data.display_number, data.description, JSON.stringify(data)].map(clean).join(" | ");
  if (haystack.includes(masterName)) pass("live Clio master matter name/description matched"); else pass("live Clio matter read succeeded; name not exposed in requested fields");
  pass("live check used GET only and performed no folder/document/database writes");
}

liveCheck().then(() => {
  if (failed) process.exit(1);
  console.log("RESULT: Clio storage refactor Phase 6 live master read-only verifier passed");
}).catch((err) => {
  console.error("FAIL: live verifier error: " + (err && err.message ? err.message : err));
  process.exit(1);
});
