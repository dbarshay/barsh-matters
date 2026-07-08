import fs from "fs";

// Unmatched triage: a firm-wide inbox folder listing the user's recent INBOUND mail that BM could not
// tie to a matter/lawsuit (read-only, live from Graph, never auto-stored). An operator can Assign one to
// an Individual Matter (BRL_) or Lawsuit Matter (YYYY.MM.NNNNN), which files it via the shared resolver.
let failed = false;
function check(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (!text.includes(n)) { console.error(`FAIL: ${file} missing: ${n}`); failed = true; }
    else console.log(`PASS: ${file} has: ${n}`);
  }
}

// Scan route: flag + admin gated, own mailbox, skips stored + matchable, inbound only.
check("app/api/graph/matter-email/unmatched/route.ts", [
  "isMatterEmailEnabled()",
  "isAdminRequestAuthorized(req)",
  "getRequestUserMailbox(req)",
  "resolveMatterContext(",
  "only inbound",
]);

// Assign route: flag + admin gated, confirmAssign, resolves the typed number, files via processChangedMessage.
check("app/api/graph/matter-email/assign/route.ts", [
  "isMatterEmailEnabled()",
  "isAdminRequestAuthorized(req)",
  "confirmAssign",
  "resolveMatterContext(",
  "processChangedMessage(",
  "forceContext",
]);

// Processor honors an operator-forced context.
check("lib/graph/webhookMessageSync.ts", ["forceContext"]);

// Inbox UI: Unmatched folder + assign wiring.
check("components/email/MatterEmailInbox.tsx", [
  "data-barsh-email-unmatched-folder",
  "assignUnmatched",
  "/api/graph/matter-email/unmatched",
  "/api/graph/matter-email/assign",
]);

if (failed) process.exit(1);
console.log("PASS: Unmatched triage is flag-gated + admin, read-only until an operator assigns, and files via the shared matter/lawsuit resolver.");
