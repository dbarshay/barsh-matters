const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

let failed = false;
const root = process.cwd();
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const contains = (label, text, token) => text.includes(token) ? pass(label) : fail(`${label} missing token: ${token}`);
const notContains = (label, text, token) => !text.includes(token) ? pass(label) : fail(`${label} contains forbidden token: ${token}`);

function loadEnvFile(envPath, override = false) {
  if (!envPath || !fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (override || !process.env[key]) process.env[key] = value;
  }
}
function loadLocalEnv() {
  for (const file of [".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local", ".env.vercel.production"]) loadEnvFile(file, false);
}
function builtPostgresUrl({ user, password, host, database }) {
  if (!user || !password || !host || !database) return "";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/${encodeURIComponent(database)}?sslmode=require`;
}
function postgresConnectionCandidates() {
  return [process.env.PHASE47B_DATABASE_URL, process.env.DATABASE_URL, process.env.POSTGRES_PRISMA_URL, process.env.POSTGRES_URL, builtPostgresUrl({ user: process.env.POSTGRES_PGUSER, password: process.env.POSTGRES_PGPASSWORD, host: process.env.POSTGRES_PGHOST_UNPOOLED || process.env.POSTGRES_HOST, database: process.env.POSTGRES_PGDATABASE })].map((v) => String(v || "").trim()).filter(Boolean);
}
function createPrismaClient() {
  const candidates = postgresConnectionCandidates();
  if (!candidates.length) throw new Error("Phase 47B verifier requires DATABASE_URL/POSTGRES_URL or Postgres env parts.");
  const pool = new Pool({ connectionString: candidates[0] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool };
}

const docPath = "docs/template-generation-refactor/phase47b-lawsuit-stipulation-template-import.md";
const importScriptPath = "scripts/import-phase47b-lawsuit-stipulation-template.cjs";
const pkgPath = "package.json";
for (const p of [docPath, importScriptPath, pkgPath]) exists(p) ? pass(`required file exists: ${p}`) : fail(`missing required file: ${p}`);

const doc = exists(docPath) ? read(docPath) : "";
const importScript = exists(importScriptPath) ? read(importScriptPath) : "";
const pkg = exists(pkgPath) ? JSON.parse(read(pkgPath)) : { scripts: {} };

for (const token of ["lawsuit-stipulation-of-settlement", "Stipulation of Settlement", "category: lawsuit", "DOCX-based", "Mac and Windows", "imported as-is", "legacy `<<PLACEHOLDER>>`", "owner-admin only"]) contains(`doc contains ${token}`, doc, token);
contains("import script requires explicit confirmation", importScript, "CONFIRM_PHASE47B_TEMPLATE_IMPORT");
contains("import script stores db docx base64", importScript, 'storageKind: "db-docx-base64"');
contains("import script uses stable key", importScript, "lawsuit-stipulation-of-settlement");
contains("import script validates owner_admin", importScript, "owner_admin");
contains("import script extracts placeholders from DOCX zip XML", importScript, "zipfile.ZipFile");
contains("import script writes rollback script", importScript, "rollback-phase47b-lawsuit-stipulation-template.cjs");
contains("import script marks no field mapping performed", importScript, "noFieldMappingPerformed");

for (const token of ["uploadBufferToClioMatterDocuments(", "CONFIRM_LIVE_TERMINAL_FINALIZE=YES", "confirmUpload: true", "documentPrintQueueItem.create(", "sendMail"]) {
  notContains(`doc no external/finalization marker ${token}`, doc, token);
  notContains(`import script no external/finalization marker ${token}`, importScript, token);
}
if (pkg.scripts?.["import:phase47b-lawsuit-stipulation-template"] === "node scripts/import-phase47b-lawsuit-stipulation-template.cjs") pass("package import script registered"); else fail("package import script missing");
if (pkg.scripts?.["verify:phase47b-lawsuit-stipulation-template-safety"] === "node scripts/verify-phase47b-lawsuit-stipulation-template-safety.cjs") pass("package verifier script registered"); else fail("package verifier script missing");

(async () => {
  loadLocalEnv();
  const { prisma, pool } = createPrismaClient();
  try {
    const template = await prisma.documentTemplate.findUnique({ where: { key: "lawsuit-stipulation-of-settlement" }, include: { versions: { orderBy: { versionNumber: "asc" } }, mergeFields: { orderBy: { key: "asc" } } } });
    if (!template) fail("DB template exists");
    else {
      pass("DB template exists");
      template.label === "Stipulation of Settlement" ? pass("DB template label correct") : fail("DB template label incorrect");
      template.category === "lawsuit" ? pass("DB template category lawsuit") : fail(`DB template category incorrect: ${template.category}`);
      template.outputFormat === "docx" ? pass("DB template outputFormat docx") : fail(`DB outputFormat incorrect: ${template.outputFormat}`);
      template.currentVersionId ? pass("DB template currentVersionId set") : fail("DB template currentVersionId missing");
      const metadata = template.metadata && typeof template.metadata === "object" && !Array.isArray(template.metadata) ? template.metadata : {};
      metadata.repositorySource === "barsh-matters-template-upload-db" ? pass("DB metadata repositorySource stored") : fail("DB metadata repositorySource missing");
      metadata.repositoryStatus === "production-template-imported" ? pass("DB metadata repositoryStatus stored") : fail("DB metadata repositoryStatus missing");
      metadata.docxOnlyTemplate === true ? pass("DB metadata docxOnlyTemplate true") : fail("DB metadata docxOnlyTemplate missing");
      metadata.macAndWindowsCompatible === true ? pass("DB metadata Mac/Windows compatibility true") : fail("DB metadata Mac/Windows compatibility missing");
      const version = template.versions?.[0];
      version?.storageKind === "db-docx-base64" ? pass("DB version storageKind db-docx-base64") : fail("DB version storageKind not db-docx-base64");
      version?.contentText && version.contentText.length > 1000 ? pass("DB version has stored DOCX base64") : fail("DB version missing stored DOCX base64");
      template.mergeFields?.length > 0 ? pass("DB merge fields imported from legacy placeholders") : fail("No DB merge fields found");
      const keys = new Set((template.mergeFields || []).map((f) => f.key));
      for (const key of ["INSURANCECOMPANY_NAME", "CASE_ID", "INS_CLAIM_NUMBER", "PROVIDER_SUITNAME", "INDEXORAAA_NUMBER", "ADJUSTER_NAME"]) keys.has(key) ? pass(`legacy placeholder merge field present: ${key}`) : fail(`legacy placeholder missing: ${key}`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
  if (failed) { console.error("FAIL: Phase 47B lawsuit stipulation template verifier failed"); process.exit(1); }
  console.log("PASS: Phase 47B lawsuit stipulation template verifier passed");
})().catch((err) => { console.error("FAIL:", err && err.stack ? err.stack : err); process.exit(1); });
