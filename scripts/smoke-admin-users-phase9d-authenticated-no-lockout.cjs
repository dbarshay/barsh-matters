const http = require("http");
const { spawn } = require("child_process");

const ROOT = process.cwd();
const PORT = Number(process.env.BARSH_PHASE9D_SMOKE_PORT || 3929);
const BASE_URL = process.env.BARSH_PHASE9D_SMOKE_BASE_URL || `http://127.0.0.1:${PORT}`;
const AUTH_COOKIE = process.env.BARSH_PHASE9D_AUTH_COOKIE || "";
const USE_EXISTING_SERVER = String(process.env.BARSH_PHASE9D_USE_EXISTING_SERVER || "").trim() === "1";
const START_TIMEOUT_MS = Number(process.env.BARSH_PHASE9D_START_TIMEOUT_MS || 45000);

const failures = [];
let child = null;

function fail(message) {
  failures.push(message);
  console.error("FAIL:", message);
}

function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  const headers = Object.assign({}, options.headers || {});
  if (options.auth && AUTH_COOKIE) headers.Cookie = AUTH_COOKIE;
  return new Promise((resolve) => {
    const req = http.request(url, { method: options.method || "GET", headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", (error) => resolve({ status: 0, headers: {}, body: String(error && error.message || error) }));
    req.setTimeout(Number(options.timeout || 10000), () => {
      req.destroy(new Error("request timeout"));
    });
    req.end();
  });
}

async function waitForServer() {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await request("/api/auth/session", { timeout: 2500 });
    if (res.status > 0) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log("RESULT: admin users Phase 9D opt-in authenticated/no-lockout smoke harness");
  console.log("PHASE_9D_BASE_URL=" + BASE_URL);
  console.log("PHASE_9D_AUTH_COOKIE_SUPPLIED=" + (AUTH_COOKIE ? "1" : "0"));
  console.log("PHASE_9D_USE_EXISTING_SERVER=" + (USE_EXISTING_SERVER ? "1" : "0"));
  console.log("PHASE_9D_ENFORCEMENT_ACTIVATION=not set by this harness");

  if (!USE_EXISTING_SERVER) {
    child = spawn("npm", ["run", "dev", "--", "-p", String(PORT)], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(PORT),
        BARSH_ADMIN_PERMISSIONS_ENFORCEMENT: "",
        BARSH_ADMIN_PERMISSION_OVERRIDES_JSON: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => process.stdout.write("[app] " + chunk.toString()));
    child.stderr.on("data", (chunk) => process.stderr.write("[app] " + chunk.toString()));
  }

  const ready = await waitForServer();
  if (!ready) {
    fail("/api/auth/session did not become reachable");
  } else {
    const session = await request("/api/auth/session", { auth: true });
    console.log("SESSION_STATUS=" + session.status);
    if (session.status !== 200) fail("/api/auth/session must return 200 for rollback/session proof");
    if (!session.body.includes("permissionsEnforced")) fail("/api/auth/session response should include permissionsEnforced rollback diagnostic");
    if (session.body.includes('"permissionsEnforced":true')) fail("/api/auth/session should not show lingering permissionsEnforced true");
    const sessionAuthenticated = session.body.includes('"authenticated":true');
    if (sessionAuthenticated) console.log("SESSION_AUTHENTICATED=1");
    else {
      console.log("SESSION_AUTHENTICATED=0");
      if (AUTH_COOKIE) fail("BARSH_PHASE9D_AUTH_COOKIE was supplied but /api/auth/session did not report authenticated=true");
    }
  }

  const neverBlockPaths = ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"];
  for (const path of neverBlockPaths) {
    const res = await request(path, { auth: true });
    console.log(`NEVER_BLOCK ${path} STATUS=${res.status}`);
    if (![200, 204, 302, 307, 308, 400, 401].includes(res.status)) fail(`unexpected never-block status for ${path}: ${res.status}`);
    if ([403, 404, 500].includes(res.status)) fail(`never-block path must not be forbidden/missing/error: ${path} status=${res.status}`);
  }

  if (!AUTH_COOKIE) {
    console.log("AUTHENTICATED_REACHABILITY=SKIPPED_NO_BARSH_PHASE9D_AUTH_COOKIE");
    console.log("PHASE_9D_NOTE=set BARSH_PHASE9D_AUTH_COOKIE to a valid authenticated admin Cookie header to test authenticated reachability of /admin/audit-history");
  } else {
    const audit = await request("/admin/audit-history", { auth: true });
    console.log("AUTHENTICATED_AUDIT_HISTORY_STATUS=" + audit.status);
    if (audit.status !== 200) fail("authenticated audit-history reachability must return 200 after a valid authenticated admin cookie, got " + audit.status);
    if (audit.status === 200 && !audit.body.includes("data-barsh-admin-audit-history")) fail("authenticated audit-history 200 body should include audit-history marker");
  }

  const rollback = await request("/api/auth/session");
  console.log("ROLLBACK_SESSION_STATUS=" + rollback.status);
  if (rollback.status !== 200) fail("rollback /api/auth/session status must remain 200");
  if (rollback.body.includes('"permissionsEnforced":true')) fail("rollback proof failed: permissionsEnforced remained true");

  if (failures.length) {
    console.error("FAILURES=" + failures.length);
    process.exit(1);
  }

  console.log("FAILURES=0");
  console.log("PASS: Phase 9D opt-in authenticated/no-lockout smoke harness completed without persistent enforcement activation.");
}

main().finally(() => {
  if (child) child.kill("SIGTERM");
});
