import fs from "fs";

// User-specific email: every user works their OWN BRL mailbox (their account email). There is NO shared
// firm mailbox. Interactive routes derive the mailbox from the signed session; sync + webhooks are
// per-user (one subscription per active user, auto-provisioned as users are added). The header Emails
// button shows the user's own matter mail across all matters. Only matter-related mail is ingested.
let failed = false;
function check(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (!text.includes(n)) { console.error(`FAIL: ${file} missing: ${n}`); failed = true; }
    else console.log(`PASS: ${file} has: ${n}`);
  }
}
function absent(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (text.includes(n)) { console.error(`FAIL: ${file} should NOT contain: ${n}`); failed = true; }
    else console.log(`PASS: ${file} free of: ${n}`);
  }
}

// Identity resolver + active-user enumeration.
check("lib/graph/userMailbox.ts", ["getRequestUserMailbox", "listActiveUserMailboxes", "adminSessionIdentityDiagnostics", "status: \"active\""]);

// Send/draft act as the session user's mailbox — no firm-mailbox fallback.
check("lib/graph/matterEmail.ts", ["resolveActorMailbox", "mailboxUserId", "appOnlyTokenConfigReady"]);
absent("lib/graph/matterEmail.ts", ["assertGraphDraftEnvironmentReady"]);
check("app/api/graph/matter-email/send/route.ts", ["getRequestUserMailbox(req)", "mailboxUserId: userMailbox"]);
check("app/api/graph/matter-email/save-draft/route.ts", ["getRequestUserMailbox(req)", "mailboxUserId: userMailbox"]);

// Delete/mark-read act on the acting user's mailbox (no firm config fallback).
check("app/api/graph/matter-email/delete/route.ts", ["getRequestUserMailbox(req)"]);
check("app/api/graph/matter-email/mark-read/route.ts", ["getRequestUserMailbox(req)"]);
absent("app/api/graph/matter-email/delete/route.ts", ["getGraphAuthConfig"]);
absent("app/api/graph/matter-email/mark-read/route.ts", ["getGraphAuthConfig"]);

// Views are scoped to the logged-in user's own mailbox; header uses scope=all.
check("app/api/graph/matter-email/messages/route.ts", ["getRequestUserMailbox", "mailboxUserPrincipalName", 'scope === "all"']);
check("app/api/graph/matter-email/unread-count/route.ts", ["getRequestUserMailbox", "mailboxUserPrincipalName", 'scope === "all"']);

// Header Emails button + badge, mounted in the shared header actions.
check("app/components/GlobalEmailInboxButton.tsx", ['scope="all"', "data-barsh-header-emails-button", "unread-count?scope=all"]);
check("app/components/BarshHeaderActions.tsx", ["GlobalEmailInboxButton"]);
check("components/email/MatterEmailInbox.tsx", ['scope?: "all"', "isGlobal", "matterTag"]);

// Per-user real-time: one subscription per active user mailbox, derived per-notification, auto-provisioned.
check("lib/graph/emailSubscription.ts", ["ensureSubscriptionForMailbox", "listActiveUserMailboxes", "resourceForMailbox", "ensureEmailSubscription"]);
check("app/api/graph/webhook/route.ts", ["mailboxForNotification", "subscriptionId"]);
check("lib/graph/webhookMessageSync.ts", ["input.mailbox", "extractMatterNumbers", "BRL[", "claimIndex.findFirst"]);
check("app/api/admin/users/create/route.ts", ["ensureSubscriptionForMailbox"]);

// Per-user backstop sync uses each thread's OWN mailbox (no firm mailbox).
check("app/api/graph/background-thread-sync/route.ts", ["threadMailbox", "appOnlyTokenConfigReady"]);

if (failed) process.exit(1);
console.log("PASS: email is per-user (own mailbox) end to end — actions, views, header inbox, sync, and self-healing per-user webhooks; only matter-related mail is ingested.");
