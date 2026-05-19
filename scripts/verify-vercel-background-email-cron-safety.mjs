import fs from "node:fs";

let failures = 0;

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function must(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

function mustContain(path, text, marker) {
  must(text.includes(marker), `${path} contains ${marker}`);
}

console.log("=== VERCEL BACKGROUND EMAIL CRON SAFETY VERIFICATION ===");

const vercelPath = "vercel.json";
const knownThreadRoutePath = "app/api/graph/background-thread-sync/route.ts";
const maildropRoutePath = "app/api/graph/maildrop-discovery/route.ts";
const packagePath = "package.json";

const vercelJson = JSON.parse(read(vercelPath));
const knownThreadRoute = read(knownThreadRoutePath);
const maildropRoute = read(maildropRoutePath);
const pkg = read(packagePath);

const knownThreadCron = Array.isArray(vercelJson.crons)
  ? vercelJson.crons.find((entry) => entry?.path === "/api/graph/background-thread-sync")
  : null;

const maildropCron = Array.isArray(vercelJson.crons)
  ? vercelJson.crons.find((entry) => entry?.path === "/api/graph/maildrop-discovery")
  : null;

must(Boolean(knownThreadCron), "vercel.json has known-thread background email sync cron route");
must(knownThreadCron?.schedule === "* * * * *", "known-thread background email sync cron runs every 1 minute");

must(Boolean(maildropCron), "vercel.json has MailDrop discovery cron route");
must(maildropCron?.schedule === "* * * * *", "MailDrop discovery cron runs every 1 minute");

must(Array.isArray(vercelJson.crons), "vercel.json crons remains an array");

console.log("\n=== VERIFY KNOWN-THREAD CRON ROUTE REMAINS GUARDED ===");
mustContain(knownThreadRoutePath, knownThreadRoute, "BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET");
mustContain(knownThreadRoutePath, knownThreadRoute, "CRON_SECRET");
mustContain(knownThreadRoutePath, knownThreadRoute, "Authorization: Bearer");
mustContain(knownThreadRoutePath, knownThreadRoute, "Fail-closed background Graph thread sync");
mustContain(knownThreadRoutePath, knownThreadRoute, "requestIsConfirmed");
mustContain(knownThreadRoutePath, knownThreadRoute, 'const REQUIRED_CONFIRMATION = "background-graph-thread-sync"');
mustContain(knownThreadRoutePath, knownThreadRoute, "createsOutlookDraft: false");
mustContain(knownThreadRoutePath, knownThreadRoute, "sendsEmail: false");
mustContain(knownThreadRoutePath, knownThreadRoute, "clioRecordsChanged: false");
mustContain(knownThreadRoutePath, knownThreadRoute, "uploadsDocuments: false");

console.log("\n=== VERIFY MAILDROP DISCOVERY CRON ROUTE REMAINS GUARDED ===");
mustContain(maildropRoutePath, maildropRoute, "BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET");
mustContain(maildropRoutePath, maildropRoute, "CRON_SECRET");
mustContain(maildropRoutePath, maildropRoute, "Authorization: Bearer");
mustContain(maildropRoutePath, maildropRoute, "Fail-closed MailDrop discovery");
mustContain(maildropRoutePath, maildropRoute, "confirmMode");
mustContain(maildropRoutePath, maildropRoute, 'const REQUIRED_PREVIEW_CONFIRMATION = "preview-maildrop-discovery"');
mustContain(maildropRoutePath, maildropRoute, 'const REQUIRED_SYNC_CONFIRMATION = "sync-maildrop-discovery"');
mustContain(maildropRoutePath, maildropRoute, "createsOutlookDraft: false");
mustContain(maildropRoutePath, maildropRoute, "sendsEmail: false");
mustContain(maildropRoutePath, maildropRoute, "clioRecordsChanged: false");
mustContain(maildropRoutePath, maildropRoute, "uploadsDocuments: false");

mustContain(packagePath, pkg, "verify:vercel-background-email-cron-safety");

if (failures > 0) {
  console.error(`=== VERCEL BACKGROUND EMAIL CRON SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== VERCEL BACKGROUND EMAIL CRON SAFETY PASSED ===");
console.log("Vercel cron is configured for every-minute known-thread Graph sync and every-minute MailDrop discovery, both guarded by CRON_SECRET / bearer authorization.");
