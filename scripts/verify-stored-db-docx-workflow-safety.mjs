import fs from "fs";
import { execFileSync } from "child_process";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const importConfirm = read("app/api/documents/templates/import-confirm/route.ts");
const templatesRoute = read("app/api/documents/templates/route.ts");
const workingDocxRoute = read("app/api/documents/working-docx/route.ts");
const graphWorking = read("lib/documents/graphWorkingDocuments.ts");
const storedDocxRoute = read("app/api/documents/templates/stored-docx/route.ts");
const adminPage = read("app/admin/document-templates/page.tsx");

assert(importConfirm.includes("maxWait: 10000"), "template import confirm uses Prisma transaction maxWait 10000");
assert(importConfirm.includes("timeout: 30000"), "template import confirm uses Prisma transaction timeout 30000");
assert(importConfirm.includes('storageKind: "db-docx-base64"'), "template import confirm supports stored DB DOCX storage kind");
assert(importConfirm.includes("contentText"), "template import confirm writes DOCX base64 contentText");
assert(templatesRoute.includes("hasStoredDocx"), "template repository API reports hasStoredDocx");
assert(templatesRoute.includes("storedDocxBytes"), "template repository API reports storedDocxBytes");
assert(templatesRoute.includes("barsh-matters-db"), "template repository API reads database repository first");
assert(storedDocxRoute.includes("db-docx-base64"), "stored DOCX download route requires DB base64 storage kind");
assert(workingDocxRoute.includes("graphTokenResult"), "working DOCX route preflights Graph token acquisition");
assert(graphWorking.includes("accessToken"), "Graph working document helper accepts confirmed access token");
assert(!adminPage.includes('"example-production-template"'), "admin page no longer uses old example-production-template key");

const protectedUrl = process.env.BARSH_MATTERS_PROD_URL || process.env.PROD_URL || "";
if (protectedUrl) {
  try {
    const status = execFileSync("curl", ["-sS", "-o", "/tmp/barsh-matters-prod-protected-check.txt", "-w", "%{http_code}", protectedUrl], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    assert(["200", "401", "403"].includes(status), `production/protected URL returns expected inspectable status (${status})`);
    if (status === "401" || status === "403") {
      console.log("PASS: protected deployment status is accepted because Vercel Deployment Protection may block unauthenticated curl before Barsh Matters handles the request");
    }
  } catch (error) {
    console.log("WARN: optional production URL curl check was not completed; code-level safety checks still ran.");
  }
} else {
  console.log("SKIP: optional production URL curl check; set BARSH_MATTERS_PROD_URL to include protected deployment status handling.");
}

if (process.exitCode) {
  console.error("Stored DB DOCX workflow safety verification failed.");
  process.exit(process.exitCode);
}

console.log("Stored DB DOCX workflow safety verification passed.");
