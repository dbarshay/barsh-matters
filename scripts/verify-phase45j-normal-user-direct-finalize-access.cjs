const fs = require("fs");

let failed = false;
function pass(message) { console.log("PASS: " + message); }
function fail(message) { failed = true; console.error("FAIL: " + message); }
function mustInclude(label, text, token) {
  if (text.includes(token)) pass(label);
  else fail(label + " missing token: " + token);
}
function mustNotInclude(label, text, token) {
  if (!text.includes(token)) pass(label);
  else fail(label + " unexpectedly includes token: " + token);
}

const route = fs.readFileSync("app/api/documents/finalize/route.ts", "utf8");

mustInclude("direct live request predicate remains", route, "const isDirectMatterLiveFinalizeRequest =");
mustInclude("server kill switch env remains", route, "BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED");
mustInclude("server kill switch marker remains", route, "direct-live-server-kill-switch");
mustInclude("server kill switch disabled flag remains", route, "serverLiveFinalizeEnabled: false");
mustInclude("direct live finalize now documents normal user access", route, "direct/live finalize is production-enabled for normal Barsh Matters users");
mustInclude("admin-only gate replacement references normal app access controls", route, "Normal app/user access controls must be handled by the application session/proxy layer.");
mustNotInclude("direct live finalize no longer returns adminUnauthorizedJson for live request", route, "if (isDirectMatterLiveFinalizeRequest && !isAdminRequestAuthorized(req as any))");
mustInclude("storage identity filenames remain", route, "buildStorageIdentityFinalizedPdfFilename(");
mustInclude("default finalized timestamp remains", route, " - Finalized ");
mustInclude("exact duplicate user message remains", route, "This Document has Previously Been Uploaded. It Will Not Be Uploaded Again");
mustInclude("duplicate prevention remains", route, "findExistingClioDocumentsByFilename");
mustInclude("duplicate prevention default remains", route, "duplicatePreventionDefault");

console.log("RESULT: Phase 45J normal-user direct finalize access verifier");
if (failed) process.exit(1);
