const fs = require("fs");

let failed = false;
function pass(message) {
  console.log("PASS: " + message);
}
function fail(message) {
  failed = true;
  console.error("FAIL: " + message);
}
function contains(label, text, token) {
  if (text.includes(token)) pass(label);
  else fail(`${label} missing token: ${token}`);
}
function notContains(label, text, token) {
  if (!text.includes(token)) pass(label);
  else fail(`${label} unexpectedly includes token: ${token}`);
}

const route = fs.readFileSync("app/api/documents/finalize/route.ts", "utf8");

contains("finalize route contains const isDirectMatterLiveFinalizeRequest =", route, "const isDirectMatterLiveFinalizeRequest =");
contains("finalize route contains uploadTargetMode === \"direct-matter\"", route, 'uploadTargetMode === "direct-matter"');
contains("finalize route contains confirmUpload === true", route, "confirmUpload === true");
contains("finalize route contains singleMasterDryRun !== true", route, "singleMasterDryRun !== true");
contains("finalize route contains BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED", route, "BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED");
contains("finalize route contains direct-live-server-kill-switch", route, "direct-live-server-kill-switch");
contains("finalize route contains serverLiveFinalizeEnabled: false", route, "serverLiveFinalizeEnabled: false");
contains("finalize route contains Direct matter live finalize is disabled by server configuration.", route, "Direct matter live finalize is disabled by server configuration.");
contains("finalize route contains useDirectFinalizePreview", route, "useDirectFinalizePreview");
contains("finalize route contains directMatterId", route, "directMatterId");
contains("finalize route contains directMatterDisplayNumber", route, "directMatterDisplayNumber");
contains("finalize route contains masterLawsuitId", route, "masterLawsuitId");
contains("finalize route documents normal user access", route, "direct/live finalize is production-enabled for normal Barsh Matters users");
contains("finalize route documents app/user access layer", route, "Normal app/user access controls must be handled by the application session/proxy layer.");

notContains("direct-live route no longer has route-level adminUnauthorizedJson gate", route, "if (isDirectMatterLiveFinalizeRequest && !isAdminRequestAuthorized(req as any))");
notContains("direct-live route no longer returns adminUnauthorizedJson for live finalize", route, "return adminUnauthorizedJson(403);");

const predicateMatch = route.match(/const isDirectMatterLiveFinalizeRequest =[\s\S]*?;/);
if (!predicateMatch) {
  fail("direct-live predicate block found");
} else {
  const block = predicateMatch[0];
  if (!block.includes("useDirectFinalizePreview")) pass("direct-live kill-switch predicate does not depend on useDirectFinalizePreview");
  else fail("direct-live kill-switch predicate should not depend on useDirectFinalizePreview");

  if (
    block.includes('uploadTargetMode === "direct-matter"') &&
    block.includes("confirmUpload === true") &&
    block.includes("singleMasterDryRun !== true")
  ) {
    pass("direct-live predicate is based on direct target + confirmed live upload + non-dry-run");
  } else {
    fail("direct-live predicate is not based on expected direct target + confirmed live upload + non-dry-run");
  }
}

const killIndex = route.indexOf("direct-live-server-kill-switch");
const normalUserAccessIndex = route.indexOf("direct/live finalize is production-enabled for normal Barsh Matters users");
const previewIndex = route.indexOf("const preview =");

if (killIndex >= 0 && normalUserAccessIndex >= 0 && killIndex < normalUserAccessIndex) {
  pass("server kill switch remains before normal-user finalize access marker");
} else {
  fail("server kill switch should remain before normal-user finalize access marker");
}

if (killIndex >= 0 && previewIndex >= 0 && killIndex < previewIndex) {
  pass("server kill switch remains before preview/document handling");
} else {
  fail("server kill switch should remain before preview/document handling");
}

const killMarkers = (route.match(/direct-live-server-kill-switch/g) || []).length;
if (killMarkers === 1) pass("exactly one direct-live server kill-switch marker remains");
else fail(`expected exactly one direct-live server kill-switch marker, found ${killMarkers}`);

console.log("RESULT: Phase 44O/45J direct-live kill-switch condition safety verifier passed");
if (failed) process.exit(1);
