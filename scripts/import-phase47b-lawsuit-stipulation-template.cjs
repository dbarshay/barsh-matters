const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const TEMPLATE_KEY = "lawsuit-stipulation-of-settlement";
const TEMPLATE_LABEL = "Stipulation of Settlement";
const TEMPLATE_CATEGORY = "lawsuit";
const OWNER_EMAIL = process.env.BARSH_OWNER_ADMIN_EMAIL || "dbarshay15@gmail.com";

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
  return [
    process.env.PHASE47B_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    builtPostgresUrl({ user: process.env.POSTGRES_PGUSER, password: process.env.POSTGRES_PGPASSWORD, host: process.env.POSTGRES_PGHOST_UNPOOLED || process.env.POSTGRES_HOST, database: process.env.POSTGRES_PGDATABASE }),
  ].map((v) => String(v || "").trim()).filter(Boolean);
}
function createPrismaClient() {
  const candidates = postgresConnectionCandidates();
  if (!candidates.length) throw new Error("Phase 47B import requires DATABASE_URL/POSTGRES_URL or Postgres env parts.");
  const pool = new Pool({ connectionString: candidates[0] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool, connectionSource: candidates[0].includes("neon") ? "neon/postgres-url" : "postgres-url" };
}
function replacer(_key, value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
}
function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
function extractLegacyPlaceholders(docxPath) {
  const py = String.raw`
import sys, zipfile, re, html, json
path = sys.argv[1]
found = set()
with zipfile.ZipFile(path) as z:
    for name in z.namelist():
        if not name.startswith("word/") or not name.endswith(".xml"):
            continue
        data = z.read(name).decode("utf-8", "ignore")
        data = html.unescape(re.sub(r"<[^>]+>", "", data))
        for m in re.finditer(r"<<([A-Z0-9_]+)>>", data):
            found.add(m.group(1))
print(json.dumps(sorted(found)))
`;
  const out = execFileSync("python3", ["-c", py, docxPath], { encoding: "utf8" });
  return JSON.parse(out || "[]");
}
function labelForLegacyKey(key) {
  return key.toLowerCase().split("_").map((part) => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
}
async function verifyOwnerAdmin(prisma) {
  const owner = await prisma.adminUser.findUnique({ where: { email: OWNER_EMAIL }, include: { roles: { include: { role: true } } } }).catch(() => null);
  if (!owner) throw new Error(`Owner admin user not found for ${OWNER_EMAIL}. Template import is owner-admin only.`);
  const hasOwnerRole = (owner.roles || []).some((entry) => entry.role?.key === "owner_admin" && entry.role?.status === "active");
  if (!hasOwnerRole) throw new Error(`Owner admin user ${OWNER_EMAIL} does not have active owner_admin role.`);
  return { email: owner.email, displayName: owner.displayName || "", ownerAdmin: true };
}
async function main() {
  loadLocalEnv();
  if (process.env.CONFIRM_PHASE47B_TEMPLATE_IMPORT !== "YES") throw new Error("Set CONFIRM_PHASE47B_TEMPLATE_IMPORT=YES to import the production template.");

  const docxPath = process.env.DOCX_TEMPLATE_PATH || "";
  if (!fs.existsSync(docxPath)) throw new Error(`DOCX template file not found: ${docxPath}`);
  if (!docxPath.toLowerCase().endsWith(".docx")) throw new Error("Template source must be a .docx file.");

  const backupDir = process.env.PHASE47B_BACKUP_DIR || path.join(process.env.HOME || ".", "Desktop", "barsh-template-db-import-backups", `phase47b-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-")}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const { prisma, pool, connectionSource } = createPrismaClient();
  try {
    const ownerProof = await verifyOwnerAdmin(prisma);
    const docxBuffer = fs.readFileSync(docxPath);
    const docxBase64 = docxBuffer.toString("base64");
    const docxHash = sha256(docxBuffer);
    const legacyPlaceholders = extractLegacyPlaceholders(docxPath);

    if (legacyPlaceholders.length === 0) throw new Error("No legacy <<PLACEHOLDER>> fields were detected in the DOCX XML.");

    const before = {
      templates: await prisma.documentTemplate.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }, { key: "asc" }], include: { versions: { orderBy: { versionNumber: "asc" } }, mergeFields: { orderBy: { key: "asc" } } } }),
      counts: {
        documentTemplates: await prisma.documentTemplate.count(),
        documentTemplateVersions: await prisma.documentTemplateVersion.count(),
        documentTemplateMergeFields: await prisma.documentTemplateMergeField.count(),
      },
    };

    fs.writeFileSync(path.join(backupDir, "template-db-before-phase47b-import.json"), JSON.stringify(before, replacer, 2));
    fs.copyFileSync(docxPath, path.join(backupDir, "source-Stipulation-of-Settlement.docx"));

    const existing = await prisma.documentTemplate.findUnique({ where: { key: TEMPLATE_KEY }, include: { versions: true, mergeFields: true } });
    if (existing) throw new Error(`Template key already exists and will not be overwritten by Phase 47B: ${TEMPLATE_KEY}`);

    const result = await prisma.$transaction(async (tx) => {
      const template = await tx.documentTemplate.create({
        data: {
          key: TEMPLATE_KEY,
          label: TEMPLATE_LABEL,
          category: TEMPLATE_CATEGORY,
          description: "Lawsuit workflow DOCX template for Stipulation of Settlement and Stipulation of Discontinuance packet. Imported as-is from legacy DOCX placeholders.",
          defaultFilenameSuffix: TEMPLATE_LABEL,
          generationEndpoint: "",
          outputFormat: "docx",
          sourceOfTruth: "barsh-matters-local",
          enabled: true,
          editableInRepository: true,
          metadata: {
            importedBy: "phase47b-guarded-script",
            importedAt: new Date().toISOString(),
            repositorySource: "barsh-matters-template-upload-db",
            repositoryStatus: "production-template-imported",
            productionTemplateReady: false,
            finalProductionDocument: false,
            templateWorkflow: "lawsuit",
            userFacingWorkflow: "Lawsuit",
            docxOnlyTemplate: true,
            macAndWindowsCompatible: true,
            placeholderSyntax: "legacy-double-angle",
            futureMergeSyntax: "{{camelCase}}",
            legacyPlaceholders,
            sourceFilename: path.basename(docxPath),
            sourceSha256: docxHash,
            sourceByteLength: docxBuffer.byteLength,
            ownerAdminOnly: true,
          },
        },
      });

      const version = await tx.documentTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: 1,
          status: "imported-as-is",
          bodyFormat: "docx-template",
          storageKind: "db-docx-base64",
          contentText: docxBase64,
          contentJson: {
            uploadedTemplateFile: {
              name: path.basename(docxPath),
              size: docxBuffer.byteLength,
              sha256: docxHash,
              storageKind: "db-docx-base64",
              actualFileStored: true,
              contentRead: true,
              importedAsIs: true,
              placeholderSyntax: "legacy-double-angle",
            },
          },
          mergeFieldSet: "lawsuit-stipulation-of-settlement-legacy",
        },
      });

      await tx.documentTemplate.update({ where: { id: template.id }, data: { currentVersionId: version.id } });

      for (const legacyKey of legacyPlaceholders) {
        await tx.documentTemplateMergeField.create({
          data: {
            templateId: template.id,
            key: legacyKey,
            label: labelForLegacyKey(legacyKey),
            description: `Legacy DOCX placeholder <<${legacyKey}>> imported as-is. Mapping to {{camelCase}} will be handled in a later phase.`,
            source: "legacy-docx-placeholder",
            required: false,
            exampleValue: "",
            metadata: { visibility: "hidden_internal", placeholderSyntax: "legacy-double-angle", legacyPlaceholder: `<<${legacyKey}>>`, futureCamelCaseMappingPending: true },
          },
        });
      }

      return { template, version, mergeFieldCount: legacyPlaceholders.length };
    });

    const rollbackScript = `const { PrismaClient } = require("@prisma/client");\nconst { PrismaPg } = require("@prisma/adapter-pg");\nconst { Pool } = require("pg");\nconst connectionString = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;\nif (!connectionString) throw new Error("Missing DATABASE_URL/POSTGRES_URL");\nconst pool = new Pool({ connectionString });\nconst prisma = new PrismaClient({ adapter: new PrismaPg(pool) });\n(async()=>{ const key="${TEMPLATE_KEY}"; const t=await prisma.documentTemplate.findUnique({where:{key}}); if(!t){ console.log("No template found for rollback:", key); return; } await prisma.$transaction(async(tx)=>{ await tx.documentTemplateMergeField.deleteMany({where:{templateId:t.id}}); await tx.documentTemplateVersion.deleteMany({where:{templateId:t.id}}); await tx.documentTemplate.delete({where:{id:t.id}}); }); console.log("Rolled back template:", key); })().finally(async()=>{ await prisma.$disconnect(); await pool.end(); });\n`;
    fs.writeFileSync(path.join(backupDir, "rollback-phase47b-lawsuit-stipulation-template.cjs"), rollbackScript);

    const after = {
      template: await prisma.documentTemplate.findUnique({ where: { key: TEMPLATE_KEY }, include: { versions: { orderBy: { versionNumber: "asc" } }, mergeFields: { orderBy: { key: "asc" } } } }),
      counts: {
        documentTemplates: await prisma.documentTemplate.count(),
        documentTemplateVersions: await prisma.documentTemplateVersion.count(),
        documentTemplateMergeFields: await prisma.documentTemplateMergeField.count(),
      },
    };

    const proof = {
      ok: Boolean(after.template && after.template.category === TEMPLATE_CATEGORY && after.template.versions?.[0]?.storageKind === "db-docx-base64" && after.template.mergeFields?.length > 0),
      action: "phase47b-import-lawsuit-stipulation-of-settlement-template",
      connectionSource,
      ownerProof,
      templateKey: TEMPLATE_KEY,
      templateLabel: TEMPLATE_LABEL,
      templateCategory: TEMPLATE_CATEGORY,
      backupDir,
      docxPath,
      sourceSha256: docxHash,
      sourceByteLength: docxBuffer.byteLength,
      legacyPlaceholderCount: legacyPlaceholders.length,
      legacyPlaceholders,
      beforeCounts: before.counts,
      afterCounts: after.counts,
      created: { templateId: result.template.id, versionId: result.version.id, versionNumber: result.version.versionNumber, mergeFieldCount: result.mergeFieldCount },
      safety: { docxBasedTemplate: true, macAndWindowsCompatible: true, importedAsIs: true, noFieldMappingPerformed: true, clioTouched: false, graphTouched: false, documentsFinalized: false, printQueueChanged: false, emailSent: false, ownerAdminOnly: true },
    };

    fs.writeFileSync(path.join(backupDir, "phase47b-import-proof.json"), JSON.stringify(proof, replacer, 2));
    console.log(JSON.stringify(proof, replacer, 2));
    if (!proof.ok) throw new Error("Phase 47B import proof failed.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch((err) => { console.error("FAIL:", err && err.stack ? err.stack : err); process.exit(1); });
