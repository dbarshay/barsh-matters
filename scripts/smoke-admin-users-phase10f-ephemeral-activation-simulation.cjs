const http = require("http");
const { spawn } = require("child_process");

const PORT = Number(process.env.BARSH_PHASE10F_PORT || 3930);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ADMIN_PASSWORD = process.env.BARSH_PHASE10F_ADMIN_PASSWORD || "";
const START_TIMEOUT_MS = Number(process.env.BARSH_PHASE10F_START_TIMEOUT_MS || 45000);
const failures = [];
let child = null;

function fail(message) {
  failures.push(message);
  console.error("FAIL:", message);
}

function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  const headers = Object.assign({}, options.headers || {});
  return new Promise((resolve) => {
    const req = http.request(url, { method: options.method || "GET", headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
    });
    req.on("error", (error) => resolve({ status: 0, headers: {}, body: String(error && error.message || error) }));
    req.setTimeout(Number(options.timeout || 10000), () => req.destroy(new Error("request timeout")));
    if (options.body) req.write(options.body);
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

function setCookieHeader(headers) {
  const raw = headers["set-cookie"] || [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.map((v) => String(v).split(";")[0]).filter(Boolean).join("; ");
}

async function main() {
  console.log("RESULT: admin users Phase 10F ephemeral activation simulation smoke");
  console.log("PHASE_10F_BASE_URL=" + BASE_URL);
  console.log("PHASE_10F_ENFORCEMENT_MODE=child-process-only");
  console.log("PHASE_10F_PERSISTENT_ACTIVATION=not set");

  if (!ADMIN_PASSWORD) fail("BARSH_PHASE10F_ADMIN_PASSWORD is required");

  child = spawn("npm", ["run", "dev", "--", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      BARSH_ADMIN_PERMISSIONS_ENFORCEMENT: "1",
      BARSH_ADMIN_PERMISSION_OVERRIDES_JSON: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write("[app] " + chunk.toString()));
  child.stderr.on("data", (chunk) => process.stderr.write("[app] " + chunk.toString()));

  const ready = await waitForServer();
  if (!ready) fail("/api/auth/session did not become reachable in child process");

  const preSession = await request("/api/auth/session");
  console.log("PRE_LOGIN_SESSION_STATUS=" + preSession.status);
  if (preSession.status !== 200) fail("pre-login /api/auth/session must return 200");
  if (!preSession.body.includes('"permissionsEnforced":true')) fail("child-process session should report permissionsEnforced=true");

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD, action: "Phase 10F Ephemeral Activation Simulation", returnTo: "/admin/audit-history" }),
  });
  console.log("LOGIN_STATUS=" + login.status);
  if (login.status !== 200) fail("login must return 200 in ephemeral activation child");
  const cookie = setCookieHeader(login.headers);
  if (!cookie) fail("login must return admin auth cookie");

  const authSession = await request("/api/auth/session", { headers: { Cookie: cookie } });
  console.log("AUTH_SESSION_STATUS=" + authSession.status);
  if (authSession.status !== 200) fail("authenticated /api/auth/session must return 200");
  if (!authSession.body.includes('"authenticated":true')) fail("authenticated session must report authenticated=true");
  if (!authSession.body.includes('"permissionsEnforced":true')) fail("authenticated session must report permissionsEnforced=true in child process");

  for (const path of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) {
    const res = await request(path, { headers: { Cookie: cookie } });
    console.log(`NEVER_BLOCK ${path} STATUS=${res.status}`);
    if ([403, 404, 500].includes(res.status)) fail(`never-block path failed under ephemeral activation: ${path} status=${res.status}`);
  }

  const audit = await request("/admin/audit-history", { headers: { Cookie: cookie } });
  console.log("AUDIT_HISTORY_STATUS=" + audit.status);
  if (audit.status !== 200) fail("sole owner_admin must reach /admin/audit-history under ephemeral activation");
  if (audit.status === 200 && !audit.body.includes("data-barsh-admin-audit-history")) fail("audit-history 200 body should include audit marker");

  const rollback = await request("/api/auth/session");
  console.log("ROLLBACK_SESSION_STATUS=" + rollback.status);
  if (rollback.status !== 200) fail("rollback/session route must remain reachable");

  if (failures.length) {
    console.error("FAILURES=" + failures.length);
    process.exit(1);
  }

  console.log("FAILURES=0");
  console.log("PASS: Phase 10F ephemeral activation simulation passed for sole owner_admin without persistent activation.");
}

main().finally(() => {
  if (child) child.kill("SIGTERM");
});
