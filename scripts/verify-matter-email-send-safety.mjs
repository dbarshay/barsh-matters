import fs from "fs";

// Phase A — native matter email send via Graph. Flag-gated, admin-only, operator-confirmed per send,
// draft-then-send to capture real ids, records an outbound thread/message + matter link.
let failed = false;
function check(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (!text.includes(n)) { console.error(`FAIL: ${file} missing: ${n}`); failed = true; }
    else console.log(`PASS: ${file} has: ${n}`);
  }
}

check("lib/graph/matterEmailConfig.ts", ["isMatterEmailEnabled", "BARSH_MATTER_EMAIL_ENABLED"]);

check("lib/graph/matterEmail.ts", [
  "ensureMatterSubjectTag",
  "/users/${enc(mailbox)}/messages",          // create draft
  "/send",                                      // then send
  "emailThread.create",
  "emailMessage.create",
  "emailMatterLink.create",
  'direction: "outbound"',
]);

check("app/api/graph/matter-email/send/route.ts", [
  "isMatterEmailEnabled()",
  "isAdminRequestAuthorized(req)",
  "body?.confirmSend !== true",
  "sendMatterEmail(",
]);

// Reusable Outlook-style compose component posts to the send route with confirmSend.
check("components/email/MatterEmailCompose.tsx", [
  "/api/graph/matter-email/send",
  "confirmSend: true",
  "bmConfirm(",
]);

// Dedicated Emails action group on both pages (separate from Documents), with View + Send triggers.
check("app/matter/[id]/page.tsx", [
  'label: "Emails"',
  'directActionGroup === "emails"',
  "data-barsh-direct-send-email-button",
  "MatterEmailCompose",
]);
check("app/matters/page.tsx", [
  'label: "Emails"',
  'masterActionGroup === "emails"',
  "data-barsh-master-send-email-button",
  "renderMasterEmailComposePopup",
]);

if (failed) process.exit(1);
console.log("PASS: matter email send (Phase A) is flag-gated, admin-only, operator-confirmed; dedicated Emails buttons on both pages.");
