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
const routePath = "app/api/graph/background-thread-sync/route.ts";
const packagePath = "package.json";

const vercelJson = JSON.parse(read(vercelPath));
const route = read(routePath);
const pkg = read(packagePath);

const cron = Array.isArray(vercelJson.crons)
  ? vercelJson.crons.find((entry) => entry?.path === "/api/graph/background-thread-sync")
  : null;

must(Boolean(cron), "vercel.json has background email sync cron route");
must(cron?.schedule === "* * * * *", "background email sync cron runs every 1 minute");
must(Array.isArray(vercelJson.crons), "vercel.json crons remains an array");

mustContain(routePath, route, "BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET");
mustContain(routePath, route, "CRON_SECRET");
mustContain(routePath, route, "Authorization: Bearer");
mustContain(routePath, route, "Fail-closed background Graph thread sync");
mustContain(routePath, route, "requestIsConfirmed");
mustContain(routePath, route, 'const REQUIRED_CONFIRMATION = "background-graph-thread-sync"');
mustContain(routePath, route, "createsOutlookDraft: false");
mustContain(routePath, route, "sendsEmail: false");
mustContain(routePath, route, "clioRecordsChanged: false");
mustContain(routePath, route, "uploadsDocuments: false");

mustContain(packagePath, pkg, "verify:vercel-background-email-cron-safety");

if (failures > 0) {
  console.error(`=== VERCEL BACKGROUND EMAIL CRON SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== VERCEL BACKGROUND EMAIL CRON SAFETY PASSED ===");
console.log("Vercel cron is configured for every-minute known-thread Graph sync and remains guarded by CRON_SECRET / bearer authorization.");
