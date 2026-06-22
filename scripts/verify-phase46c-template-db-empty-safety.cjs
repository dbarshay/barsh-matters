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

function contains(label, text, token) {
  text.includes(token) ? pass(label) : fail(`${label} missing token: ${token}`);
}
function notContains(label, text, token) {
  !text.includes(token) ? pass(label) : fail(`${label} contains forbidden token: ${token}`);
}
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
  for (const file of [".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local", ".env.vercel.production"]) {
    loadEnvFile(file, false);
  }
}
function builtPostgresUrl({ user, password, host, database }) {
  if (!user || !password || !host || !database) return "";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/${encodeURIComponent(database)}?sslmode=require`;
}
function postgresConnectionCandidates() {
  return [
    process.env.PHASE46C_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    builtPostgresUrl({
      user: process.env.POSTGRES_PGUSER,
      password: process.env.POSTGRES_PGPASSWORD,
      host: process.env.POSTGRES_PGHOST_UNPOOLED || process.env.POSTGRES_HOST,
      database: process.env.POSTGRES_PGDATABASE,
    }),
  ].map((v) => String(v || "").trim()).filter(Boolean);
}
function createPrismaClient() {
  const candidates = postgresConnectionCandidates();
  if (!candidates.length) throw new Error("Phase 46C verifier requires DATABASE_URL/POSTGRES_URL or Postgres env parts.");
  const pool = new Pool({ connectionString: candidates[0] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool };
}

const docPath = "docs/template-generation-refactor/phase46c-delete-all-test-document-templates.md";
const pkgPath = "package.json";

for (const p of [docPath, pkgPath]) {
  exists(p) ? pass(`required file exists: ${p}`) : fail(`missing required file: ${p}`);
}

const doc = exists(docPath) ? read(docPath) : "";
const pkg = exists(pkgPath) ? JSON.parse(read(pkgPath)) : { scripts: {} };

contains("doc states all stored DB templates were test templates", doc, "All stored database document templates were test templates");
contains("doc lists DocumentTemplate deletion", doc, "all `DocumentTemplate` rows");
contains("doc lists DocumentTemplateVersion deletion", doc, "all `DocumentTemplateVersion` rows");
contains("doc lists merge-field deletion", doc, "all `DocumentTemplateMergeField` rows");
contains("doc confirms no Clio upload", doc, "upload to Clio");
contains("doc notes placeholder generators remain", doc, "hardcoded master/lawsuit placeholder document generators");
contains("doc notes code-registry fallback remains for later phase", doc, "code-registry fallback definitions");
contains("doc records repair after initial raw Prisma failure", doc, "Phase 46C repair");
contains("doc records adapter-pg", doc, "adapter-pg");

if (pkg.scripts && pkg.scripts["verify:phase46c-template-db-empty-safety"] === "node scripts/verify-phase46c-template-db-empty-safety.cjs") {
  pass("package Phase 46C verifier script registered");
} else {
  fail("package Phase 46C verifier script missing");
}

for (const token of [
  "confirmUpload: true",
  "CONFIRM_LIVE_TERMINAL_FINALIZE=YES",
  "uploadBufferToClioMatterDocuments(",
  "documentPrintQueueItem.create("
]) {
  notContains(`doc no live/write marker ${token}`, doc, token);
}

(async () => {
  loadLocalEnv();
  const { prisma, pool } = createPrismaClient();
  try {
    const counts = {
      documentTemplates: await prisma.documentTemplate.count(),
      documentTemplateVersions: await prisma.documentTemplateVersion.count(),
      documentTemplateMergeFields: await prisma.documentTemplateMergeField.count(),
    };

    console.log("TEMPLATE_DB_COUNTS=" + JSON.stringify(counts));

    if (counts.documentTemplates === 0) pass("DocumentTemplate table empty");
    else fail(`DocumentTemplate table not empty: ${counts.documentTemplates}`);

    if (counts.documentTemplateVersions === 0) pass("DocumentTemplateVersion table empty");
    else fail(`DocumentTemplateVersion table not empty: ${counts.documentTemplateVersions}`);

    if (counts.documentTemplateMergeFields === 0) pass("DocumentTemplateMergeField table empty");
    else fail(`DocumentTemplateMergeField table not empty: ${counts.documentTemplateMergeFields}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  if (failed) {
    console.error("FAIL: Phase 46C template DB empty safety verifier failed");
    process.exit(1);
  }

  console.log("PASS: Phase 46C template DB empty safety verifier passed");
})().catch((err) => {
  console.error("FAIL:", err && err.stack ? err.stack : err);
  process.exit(1);
});
