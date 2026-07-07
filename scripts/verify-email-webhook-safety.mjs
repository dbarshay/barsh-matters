import fs from "fs";

// Real-time inbound email via Microsoft Graph change notifications. Flag-gated. The public receiver is
// authenticated by the subscription validation handshake + a clientState secret (never admin creds).
// Actions stay safe: notifications only trigger read+persist; a delete in Outlook mirrors as a local
// soft delete (deletedLocal), never a hard purge. The subscription self-heals (create/renew/recreate)
// on a renewal cron, with the every-few-minutes sync kept as a backstop.
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

// Flag + config.
check("lib/graph/webhookConfig.ts", ["isEmailWebhookEnabled", "BARSH_EMAIL_WEBHOOK_ENABLED", "getWebhookClientState", "getWebhookNotificationUrl"]);

// Subscription lifecycle: create / renew / self-heal, on a message subscription under Graph's cap.
check("lib/graph/emailSubscription.ts", [
  "ensureEmailSubscription",
  '"created"',
  '"renewed"',
  '"recreated"',
  '"created,updated,deleted"',
  "/subscriptions",
  "clientState",
]);

// Public receiver: validation handshake + clientState verification + read/persist only.
check("app/api/graph/webhook/route.ts", [
  "validationToken",
  "isEmailWebhookEnabled()",
  "getWebhookClientState()",
  "clientState !== expectedClientState",
  "processChangedMessage(",
  "status: 202",
]);
// The receiver must NOT gate notifications on an admin session (Graph calls it unauthenticated).
absent("app/api/graph/webhook/route.ts", ["isAdminRequestAuthorized"]);

// Per-message processing: persist on create/update, soft-delete on delete. Never hard-deletes.
check("lib/graph/webhookMessageSync.ts", [
  "processChangedMessage",
  "persistGraphThreadSyncMessages",
  "deletedLocal: true",
  'changeType.includes("deleted")',
]);
absent("lib/graph/webhookMessageSync.ts", ["emailMessage.delete(", "deleteMany({ where: { graphMessageId }, data: {} })"]);

// Subscribe/renew endpoint is flag-gated + admin-or-cron-secret and drives the self-heal.
check("app/api/graph/webhook/subscribe/route.ts", ["isEmailWebhookEnabled()", "isAdminRequestAuthorized(req)", "bearerSecretOk(req)", "ensureEmailSubscription()"]);

// Cron: renewal job present; backstop syncs relaxed off every-minute; dead placeholder removed.
check("vercel.json", ["/api/graph/webhook/subscribe", "*/5 * * * *"]);
absent("vercel.json", ["process-webhooks", '"* * * * *"']);

// Schema: subscription state table.
check("prisma/schema.prisma", ["model GraphSubscription", "subscriptionId", "expirationDateTime"]);

if (failed) process.exit(1);
console.log("PASS: Graph email webhook is flag-gated, clientState-authenticated, read/persist-only, soft-delete-mirroring, and self-healing with a backstop cron.");
