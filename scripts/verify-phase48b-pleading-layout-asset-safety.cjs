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
function createPrismaClient() {
  const connectionString = [process.env.PHASE48B_DATABASE_URL, process.env.DATABASE_URL, process.env.POSTGRES_PRISMA_URL, process.env.POSTGRES_URL, builtPostgresUrl({ user: process.env.POSTGRES_PGUSER, password: process.env.POSTGRES_PGPASSWORD, host: process.env.POSTGRES_PGHOST_UNPOOLED || process.env.POSTGRES_HOST, database: process.env.POSTGRES_PGDATABASE })].map((v) => String(v || "").trim()).find(Boolean);
  if (!connectionString) throw new Error("Missing DB URL for Phase 48B verifier.");
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool };
}

const docPath = "docs/template-generation-refactor/phase48b-pleading-layout-asset-and-layout-merge-fields.md";
const importScriptPath = "scripts/import-phase48b-pleading-layout-asset.cjs";
const pkgPath = "package.json";
for (const p of [docPath, importScriptPath, pkgPath]) exists(p) ? pass(`required file exists: ${p}`) : fail(`missing required file: ${p}`);

const doc = exists(docPath) ? read(docPath) : "";
const importScript = exists(importScriptPath) ? read(importScriptPath) : "";
const pkg = exists(pkgPath) ? JSON.parse(read(pkgPath)) : { scripts: {} };


for (const token of [
  "all visible UI fields in Barsh Matters",
  "all non-viewable fields in the database tables already created",
  "hidden/internal fields needed for document generation",
  "layout-level merge fields for letterhead and pleading paper",
  "template-specific fields from uploaded DOCX placeholders",
]) contains(`doc contains comprehensive BM merge-field scope ${token}`, doc, token);

for (const token of ["pleading-paper", "Pleading Paper", "layout asset", "non-generation", "DOCX-based", "Mac and Windows", "pleading_paper", "merge-field inventory", "mapping pending user review", "letterhead-simple", "Generate Documents"]) contains(`doc contains ${token}`, doc, token);
contains("import script requires explicit confirmation", importScript, "CONFIRM_PHASE48B_PLEADING_LAYOUT_IMPORT");
contains("import script stores db docx base64", importScript, 'storageKind: "db-docx-base64"');
contains("import script imports pleading as layout asset", importScript, 'layoutFamily: "pleading_paper"');
contains("import script disables normal selection", importScript, "selectableForNormalGeneration: false");
contains("import script uses enabled false", importScript, "enabled: false");
contains("import script extracts legacy placeholders", importScript, "extractLegacyPlaceholders");
contains("import script adds letterhead inventory", importScript, "letterheadLayoutFields");
contains("import script marks mapping pending user review", importScript, "mappingPendingUserReview");

for (const token of ["uploadBufferToClioMatterDocuments(", "CONFIRM_LIVE_TERMINAL_FINALIZE=YES", "confirmUpload: true", "documentPrintQueueItem.create(", "sendMail"]) {
  notContains(`doc no external/finalization marker ${token}`, doc, token);
  notContains(`import script no external/finalization marker ${token}`, importScript, token);
}

if (pkg.scripts?.["import:phase48b-pleading-layout-asset"] === "node scripts/import-phase48b-pleading-layout-asset.cjs") pass("package import script registered"); else fail("package import script missing");
if (pkg.scripts?.["verify:phase48b-pleading-layout-asset-safety"] === "node scripts/verify-phase48b-pleading-layout-asset-safety.cjs") pass("package verifier script registered"); else fail("package verifier script missing");

(async () => {
  loadLocalEnv();
  const { prisma, pool } = createPrismaClient();
  try {
    const pleading = await prisma.documentTemplate.findUnique({ where: { key: "pleading-paper" }, include: { versions: { orderBy: { versionNumber: "asc" } }, mergeFields: { orderBy: { key: "asc" } } } });
    if (!pleading) fail("DB pleading layout asset exists");
    else {
      pass("DB pleading layout asset exists");
      pleading.label === "Pleading Paper" ? pass("DB pleading label correct") : fail("DB pleading label incorrect");
      pleading.enabled === false ? pass("DB pleading enabled false / non-generation") : fail("DB pleading should be enabled false");
      pleading.outputFormat === "docx" ? pass("DB pleading outputFormat docx") : fail(`DB outputFormat incorrect: ${pleading.outputFormat}`);
      pleading.currentVersionId ? pass("DB pleading currentVersionId set") : fail("DB pleading currentVersionId missing");
      const metadata = pleading.metadata && typeof pleading.metadata === "object" && !Array.isArray(pleading.metadata) ? pleading.metadata : {};
      metadata.templateKind === "layout_asset" ? pass("DB pleading templateKind layout_asset") : fail("DB pleading templateKind missing");
      metadata.nonGenerationAsset === true ? pass("DB pleading nonGenerationAsset true") : fail("DB pleading nonGenerationAsset missing");
      metadata.selectableForNormalGeneration === false ? pass("DB pleading selectableForNormalGeneration false") : fail("DB pleading selectableForNormalGeneration not false");
      metadata.layoutFamily === "pleading_paper" ? pass("DB pleading layoutFamily pleading_paper") : fail("DB pleading layoutFamily missing");
      metadata.mappingPendingUserReview === true ? pass("DB pleading mapping pending user review") : fail("DB pleading mapping pending missing");
      metadata.fieldMappingPerformed === false ? pass("DB pleading field mapping not performed") : fail("DB pleading field mapping flag not false");
      const version = pleading.versions?.[0];
      version?.storageKind === "db-docx-base64" ? pass("DB pleading version storageKind db-docx-base64") : fail("DB pleading version storageKind not db-docx-base64");
      version?.contentText && version.contentText.length > 1000 ? pass("DB pleading version has stored DOCX base64") : fail("DB pleading version missing stored DOCX base64");
      const keys = new Set((pleading.mergeFields || []).map((f) => f.key));
      for (const key of ["Matter.Client.Name", "Matter.CustomField.DebtCollector.Name", "Matter.CustomField.DocketNumber", "Matter.Number"]) {
        keys.has(key) ? pass(`DB pleading legacy placeholder present: ${key}`) : fail(`DB pleading legacy placeholder missing: ${key}`);
      }
    }
    const letterhead = await prisma.documentTemplate.findUnique({ where: { key: "letterhead-simple" }, include: { mergeFields: { orderBy: { key: "asc" } } } });
    if (!letterhead) fail("DB letterhead layout asset exists");
    else {
      pass("DB letterhead layout asset exists");
      const letterheadKeys = new Set((letterhead.mergeFields || []).map((f) => f.key));
      for (const key of ["todayLong", "userName", "firmName", "firmAddressLine1", "firmPhone", "firmFax", "firmEmail"]) {
        letterheadKeys.has(key) ? pass(`DB letterhead layout merge field present: ${key}`) : fail(`DB letterhead layout merge field missing: ${key}`);
      }
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
  if (failed) { console.error("FAIL: Phase 48B pleading layout asset verifier failed"); process.exit(1); }
  console.log("PASS: Phase 48B pleading layout asset verifier passed");
})().catch((err) => { console.error("FAIL:", err && err.stack ? err.stack : err); process.exit(1); });
