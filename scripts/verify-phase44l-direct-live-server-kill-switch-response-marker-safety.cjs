const fs = require("fs");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`required Phase 44L file missing: ${file}`);
  pass(`required Phase 44L file exists: ${file}`);
  return fs.readFileSync(file, "utf8");
}

function contains(label, text, token) {
  if (!text.includes(token)) fail(`${label} missing token: ${token}`);
  pass(`${label} contains ${token}`);
}

const doc = read("docs/clio-storage-refactor/phase44l-direct-live-server-kill-switch-response-marker.md");
const route = read("app/api/documents/finalize/route.ts");
const pkgText = read("package.json");

[
  "Phase 44L",
  "Direct Live Server Kill-Switch Response Marker",
  "direct-live-server-kill-switch",
  "authorized: true",
  "serverLiveFinalizeEnabled: false",
  "does not upload a document",
  "does not set any environment variable",
  "admin authorization guard remains required",
].forEach((token) => contains("doc", doc, token));

[
  "directMatterLiveFinalizeServerEnabled",
  "BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED",
  "if (isDirectMatterLiveFinalizeRequest && !directMatterLiveFinalizeServerEnabled)",
  "NextResponse.json",
  'action: "direct-live-server-kill-switch"',
  "authorized: true",
  "serverLiveFinalizeEnabled: false",
  "Direct matter live finalize is disabled by server configuration.",
  "{ status: 403 }",
  "!isAdminRequestAuthorized(req as any)",
  "uploadBufferToClioMatterDocuments(",
].forEach((token) => contains("finalize route", route, token));

const killSwitchIdx = route.indexOf('action: "direct-live-server-kill-switch"');
const adminGuardIdx = route.indexOf("!isAdminRequestAuthorized(req as any)");
const uploadIdx = route.indexOf("uploadBufferToClioMatterDocuments(");
if (killSwitchIdx < 0 || adminGuardIdx < 0 || uploadIdx < 0) fail("required indexes missing");
if (!(killSwitchIdx < adminGuardIdx && adminGuardIdx < uploadIdx)) {
  fail("expected order is kill-switch marker, admin guard, upload helper");
}
pass("expected order is kill-switch marker, admin guard, upload helper");

const killSwitchStart = route.lastIndexOf("if (isDirectMatterLiveFinalizeRequest && !directMatterLiveFinalizeServerEnabled)", killSwitchIdx);
const killSwitchEnd = route.indexOf("  if (", killSwitchIdx + 1);
const killSwitchBlock = route.slice(killSwitchStart, killSwitchEnd > killSwitchIdx ? killSwitchEnd : killSwitchIdx + 1200);
[
  "isDirectMatterLiveFinalizeRequest",
  "!directMatterLiveFinalizeServerEnabled",
  "NextResponse.json",
  'action: "direct-live-server-kill-switch"',
  "authorized: true",
  "serverLiveFinalizeEnabled: false",
  "{ status: 403 }",
].forEach((token) => contains("kill switch response block", killSwitchBlock, token));

const pkg = JSON.parse(pkgText);
if (!pkg.scripts || !pkg.scripts["verify:phase44l-direct-live-server-kill-switch-response-marker-safety"]) {
  fail("package Phase 44L verifier script not registered");
}
pass("package Phase 44L verifier registered");
if (Object.keys(pkg.scripts).some((name) => /phase44l/i.test(name) && /smoke/i.test(name))) {
  fail("Phase 44L must not register a smoke script");
}
pass("package does not register Phase 44L smoke");

console.log("CONTRACT: Phase 44L adds a distinct closed server kill-switch response marker; no env value is set and no upload is run.");
console.log("RESULT: Phase 44L direct live server kill-switch response marker verifier");
