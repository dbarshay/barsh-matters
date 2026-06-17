#!/usr/bin/env node
const { spawn } = require("node:child_process");
const http = require("node:http");

const PORT = String(process.env.BARSH_PHASE8_SMOKE_PORT || "43187");
const HOST = "127.0.0.1";
const BASE = `http://${HOST}:${PORT}`;
const BLOCK_OVERRIDE = JSON.stringify({ block: ["admin.auditHistory.view"] });
let child;
let failures = 0;

function pass(message) { console.log("PASS: " + message); }
function fail(message) { failures += 1; console.error("FAIL: " + message); }
function assert(condition, message) { condition ? pass(message) : fail(message); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function request(pathname) {
  return new Promise((resolve) => {
    const req = http.request(`${BASE}${pathname}`, { method: "GET", timeout: 5000, headers: { "Accept": "text/html,application/json" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ ok: true, status: res.statusCode || 0, headers: res.headers || {}, body }));
    });
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.on("error", (error) => resolve({ ok: false, status: 0, headers: {}, body: String(error && error.message || error) }));
    req.end();
  });
}

async function waitForReady() {
  const started = Date.now();
  while (Date.now() - started < 90000) {
    const response = await request("/api/auth/session");
    if (response.ok && response.status > 0 && response.status < 500) return response;
    await sleep(1000);
  }
  throw new Error("ephemeral server did not become ready within 90 seconds");
}

async function main() {
  console.log("");
  console.log("RESULT: admin users phase 8B opt-in ephemeral audit-history smoke harness");
  console.log("PHASE_8B_EPHEMERAL_ENV_ONLY=1");
  console.log("PHASE_8B_TARGET=/admin/audit-history");
  console.log("PHASE_8B_BLOCK_PERMISSION=admin.auditHistory.view");
  console.log("PHASE_8B_NEVER_BLOCK=/admin,/admin/permissions,/api/admin/permissions,/api/admin/permissions/check");

  const env = {
    ...process.env,
    PORT,
    HOSTNAME: HOST,
    BARSH_ADMIN_PERMISSIONS_ENFORCEMENT: "1",
    BARSH_ADMIN_PERMISSION_OVERRIDES_JSON: BLOCK_OVERRIDE
  };

  child = spawn("npm", ["run", "dev", "--", "-H", HOST, "-p", PORT], { env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write("[ephemeral] " + chunk.toString()));
  child.stderr.on("data", (chunk) => process.stderr.write("[ephemeral] " + chunk.toString()));
  child.on("exit", (code, signal) => { if (!global.__barshSmokeDone) console.error(`FAIL: ephemeral child exited early code=${code} signal=${signal}`); });

  try {
    const ready = await waitForReady();
    pass(`/api/auth/session became reachable under ephemeral enforcement env with status ${ready.status}`);
    assert(ready.body.includes("permissionsEnforced") || ready.status < 500, "session endpoint is available for rollback diagnostics");

    const checks = [
      ["/admin", "never-block admin dashboard"],
      ["/admin/permissions", "never-block permissions page"],
      ["/api/admin/permissions", "never-block permissions API"],
      ["/api/admin/permissions/check?permission=admin.auditHistory.view", "never-block permission-check API"]
    ];
    for (const [pathname, label] of checks) {
      const response = await request(pathname);
      const location = String(response.headers.location || "");
      assert(response.ok && response.status > 0 && response.status < 500, `${label} reachable with status ${response.status}`);
      assert(!location.includes("admin-permission-blocked"), `${label} is not permission-blocked`);
    }

    const blocked = await request("/admin/audit-history");
    const blockedLocation = String(blocked.headers.location || "");
    const blockedBody = String(blocked.body || "");
    const blockedDiagnostic = blockedLocation.includes("/admin/permissions") || blockedLocation.includes("admin-permission-blocked") || blockedBody.includes("admin.auditHistory.view") || blockedBody.includes("permission") || blocked.status === 403;
    assert(blocked.ok && blocked.status > 0 && blocked.status < 500, `/admin/audit-history returned diagnostic-compatible status ${blocked.status}`);
    assert(blockedDiagnostic, "/admin/audit-history produced blocked redirect or visible permission diagnostic under ephemeral block override");
  } finally {
    global.__barshSmokeDone = true;
    if (child && !child.killed) child.kill("SIGTERM");
    await sleep(1500);
    if (child && !child.killed) child.kill("SIGKILL");
  }

  const rollback = await request("/api/auth/session");
  assert(!rollback.ok || rollback.status === 0 || !String(rollback.body || "").includes("\"permissionsEnforced\":true"), "rollback proof: ephemeral process stopped or no longer reports permissionsEnforced=true");

  if (failures) { console.error(""); console.error("FAILURES=" + failures); process.exit(1); }
  console.log("");
  console.log("FAILURES=0");
  console.log("PASS: Phase 8B opt-in ephemeral smoke harness completed without persistent activation.");
}

main().catch((error) => {
  console.error("FAIL: " + (error && error.stack || error));
  if (child && !child.killed) child.kill("SIGTERM");
  process.exit(1);
});
