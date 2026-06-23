const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const PLEADING_KEY = "pleading-paper";
const PLEADING_LABEL = "Pleading Paper";
const PLEADING_CATEGORY = "general";
const LETTERHEAD_KEY = "letterhead-simple";
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
    process.env.PHASE48B_DATABASE_URL,
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
  if (!candidates.length) throw new Error("Phase 48B import requires DATABASE_URL/POSTGRES_URL or Postgres env parts.");
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
function cleanLegacyPlaceholder(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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
        for m in re.finditer(r"<<\s*([^<>]+?)\s*>>", data, re.I | re.S):
            found.add(re.sub(r"\s+", " ", m.group(1)).strip())
print(json.dumps(sorted(found)))
`;
  const out = execFileSync("python3", ["-c", py, docxPath], { encoding: "utf8" });
  return JSON.parse(out || "[]").map(cleanLegacyPlaceholder).filter(Boolean);
}
function labelForKey(key) {
  return String(key || "")
    .replace(/[{}<>]/g, "")
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : "")
    .join(" ");
}
async function verifyOwnerAdmin(prisma) {
  const owner = await prisma.adminUser.findUnique({ where: { email: OWNER_EMAIL }, include: { roles: { include: { role: true } } } }).catch(() => null);
  if (!owner) throw new Error(`Owner admin user not found for ${OWNER_EMAIL}. Layout asset import is owner-admin only.`);
  const hasOwnerRole = (owner.roles || []).some((entry) => entry.role?.key === "owner_admin" && entry.role?.status === "active");
  if (!hasOwnerRole) throw new Error(`Owner admin user ${OWNER_EMAIL} does not have active owner_admin role.`);
  return { email: owner.email, displayName: owner.displayName || "", ownerAdmin: true };
}
async function createMergeFieldIfMissing(tx, templateId, data) {
  const existing = await tx.documentTemplateMergeField.findFirst({
    where: { templateId, key: data.key },
    select: { id: true },
  });
  if (existing) return { created: false, id: existing.id, key: data.key };
  const created = await tx.documentTemplateMergeField.create({ data: { templateId, ...data } });
  return { created: true, id: created.id, key: data.key };
}
const letterheadLayoutFields = [
  { key: "todayLong", label: "Today Long", description: "Dynamic generation date for letterhead documents; tabbed once to the right.", source: "layout-standard-pending", required: false, metadata: { layoutFamily: "letterhead", futureMergeSyntax: "{{camelCase}}", mappingPending: true } },
  { key: "userName", label: "User Name", description: "Signer/user name under Very truly yours.", source: "layout-standard-pending", required: false, metadata: { layoutFamily: "letterhead", futureMergeSyntax: "{{camelCase}}", mappingPending: true } },
  { key: "firmName", label: "Firm Name", description: "Firm name for letterhead footer/signature reference.", source: "layout-standard-pending", required: false, metadata: { layoutFamily: "letterhead", futureMergeSyntax: "{{camelCase}}", mappingPending: true } },
  { key: "firmAddressLine1", label: "Firm Address Line 1", description: "Firm address line 1.", source: "layout-standard-pending", required: false, metadata: { layoutFamily: "letterhead", futureMergeSyntax: "{{camelCase}}", mappingPending: true } },
  { key: "firmAddressLine2", label: "Firm Address Line 2", description: "Firm address line 2.", source: "layout-standard-pending", required: false, metadata: { layoutFamily: "letterhead", futureMergeSyntax: "{{camelCase}}", mappingPending: true } },
  { key: "firmPhone", label: "Firm Phone", description: "Firm phone number.", source: "layout-standard-pending", required: false, metadata: { layoutFamily: "letterhead", futureMergeSyntax: "{{camelCase}}", mappingPending: true } },
  { key: "firmFax", label: "Firm Fax", description: "Firm fax number.", source: "layout-standard-pending", required: false, metadata: { layoutFamily: "letterhead", futureMergeSyntax: "{{camelCase}}", mappingPending: true } },
  { key: "firmEmail", label: "Firm Email", description: "Firm email address.", source: "layout-standard-pending", required: false, metadata: { layoutFamily: "letterhead", futureMergeSyntax: "{{camelCase}}", mappingPending: true } },
];
async function main() {
  loadLocalEnv();
  if (process.env.CONFIRM_PHASE48B_PLEADING_LAYOUT_IMPORT !== "YES") throw new Error("Set CONFIRM_PHASE48B_PLEADING_LAYOUT_IMPORT=YES to import the pleading layout asset.");

  const docxPath = process.env.PLEADING_DOCX_PATH || "";
  if (!fs.existsSync(docxPath)) throw new Error(`Pleading DOCX file not found: ${docxPath}`);
  if (!docxPath.toLowerCase().endsWith(".docx")) throw new Error("Pleading source must be a .docx file.");

  const backupDir = process.env.PHASE48B_BACKUP_DIR || path.join(process.env.HOME || ".", "Desktop", "barsh-template-db-import-backups", `phase48b-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-")}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const { prisma, pool, connectionSource } = createPrismaClient();
  try {
    const ownerProof = await verifyOwnerAdmin(prisma);
    const docxBuffer = fs.readFileSync(docxPath);
    const docxBase64 = docxBuffer.toString("base64");
    const docxHash = sha256(docxBuffer);
    const legacyPlaceholders = extractLegacyPlaceholders(docxPath);

    const before = {
      templates: await prisma.documentTemplate.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }, { key: "asc" }], include: { versions: { orderBy: { versionNumber: "asc" } }, mergeFields: { orderBy: { key: "asc" } } } }),
      counts: {
        documentTemplates: await prisma.documentTemplate.count(),
        documentTemplateVersions: await prisma.documentTemplateVersion.count(),
        documentTemplateMergeFields: await prisma.documentTemplateMergeField.count(),
      },
    };
    fs.writeFileSync(path.join(backupDir, "template-db-before-phase48b-pleading-layout-import.json"), JSON.stringify(before, replacer, 2));
    fs.copyFileSync(docxPath, path.join(backupDir, "source-pleading.docx"));

    const existing = await prisma.documentTemplate.findUnique({ where: { key: PLEADING_KEY }, include: { versions: true } });
    if (existing) throw new Error(`Layout asset key already exists and will not be overwritten by Phase 48B: ${PLEADING_KEY}`);

    const letterhead = await prisma.documentTemplate.findUnique({ where: { key: LETTERHEAD_KEY }, include: { mergeFields: true } });
    if (!letterhead) throw new Error("Expected letterhead-simple layout asset to exist before importing pleading-paper.");

    const result = await prisma.$transaction(async (tx) => {
      const pleading = await tx.documentTemplate.create({
        data: {
          key: PLEADING_KEY,
          label: PLEADING_LABEL,
          category: PLEADING_CATEGORY,
          description: "Non-generation DOCX layout asset for pleading paper documents. Used as the base layout family for court pleading templates.",
          defaultFilenameSuffix: PLEADING_LABEL,
          generationEndpoint: "",
          outputFormat: "docx",
          sourceOfTruth: "barsh-matters-local",
          enabled: false,
          editableInRepository: true,
          metadata: {
            importedBy: "phase48b-guarded-script",
            importedAt: new Date().toISOString(),
            repositorySource: "barsh-matters-template-repository",
            repositoryStatus: "production-layout-asset-imported",
            templateKind: "layout_asset",
            nonGenerationAsset: true,
            selectableForNormalGeneration: false,
            docxOnlyTemplate: true,
            macAndWindowsCompatible: true,
            layoutFamily: "pleading_paper",
            layoutAssetKey: PLEADING_KEY,
            placeholderSyntax: "legacy-double-angle",
            futureMergeSyntax: "{{camelCase}}",
            legacyPlaceholders,
            mergeFieldInventoryOnly: true,
            fieldMappingPerformed: false,
            mappingPendingUserReview: true,
            sourceFilename: path.basename(docxPath),
            sourceSha256: docxHash,
            sourceByteLength: docxBuffer.byteLength,
            ownerAdminOnly: true,
          },
        },
      });

      const version = await tx.documentTemplateVersion.create({
        data: {
          templateId: pleading.id,
          versionNumber: 1,
          status: "imported-as-layout-asset",
          bodyFormat: "docx-layout-asset",
          storageKind: "db-docx-base64",
          contentText: docxBase64,
          contentJson: {
            uploadedLayoutFile: {
              name: path.basename(docxPath),
              size: docxBuffer.byteLength,
              sha256: docxHash,
              storageKind: "db-docx-base64",
              actualFileStored: true,
              contentRead: true,
              importedAsLayoutAsset: true,
            },
          },
          mergeFieldSet: "layout-pleading-paper-v1",
        },
      });

      await tx.documentTemplate.update({ where: { id: pleading.id }, data: { currentVersionId: version.id } });

      const pleadingCreatedFields = [];
      for (const legacyKey of legacyPlaceholders) {
        pleadingCreatedFields.push(await createMergeFieldIfMissing(tx, pleading.id, {
          key: legacyKey,
          label: labelForKey(legacyKey),
          description: `Legacy pleading layout placeholder <<${legacyKey}>> imported as-is. Mapping to {{camelCase}} is pending user review.`,
          source: "legacy-pleading-layout-placeholder",
          required: false,
          exampleValue: "",
          metadata: {
            layoutFamily: "pleading_paper",
            visibility: "hidden_internal",
            placeholderSyntax: "legacy-double-angle",
            legacyPlaceholder: `<<${legacyKey}>>`,
            futureCamelCaseMappingPending: true,
            mappingPendingUserReview: true,
          },
        }));
      }

      const letterheadCreatedFields = [];
      for (const field of letterheadLayoutFields) {
        letterheadCreatedFields.push(await createMergeFieldIfMissing(tx, letterhead.id, field));
      }

      const letterheadMetadata = letterhead.metadata && typeof letterhead.metadata === "object" && !Array.isArray(letterhead.metadata) ? letterhead.metadata : {};
      await tx.documentTemplate.update({
        where: { id: letterhead.id },
        data: {
          metadata: {
            ...letterheadMetadata,
            mergeFieldInventoryOnly: true,
            fieldMappingPerformed: false,
            layoutMergeFieldsAddedAt: new Date().toISOString(),
            layoutMergeFieldKeys: letterheadLayoutFields.map((field) => field.key),
          },
        },
      });

      return { pleading, version, pleadingCreatedFields, letterheadCreatedFields };
    }, { timeout: 120000, maxWait: 15000 });

    const rollbackScript = `const { PrismaClient } = require("@prisma/client");\nconst { PrismaPg } = require("@prisma/adapter-pg");\nconst { Pool } = require("pg");\nconst connectionString = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;\nif (!connectionString) throw new Error("Missing DATABASE_URL/POSTGRES_URL");\nconst pool = new Pool({ connectionString });\nconst prisma = new PrismaClient({ adapter: new PrismaPg(pool) });\n(async()=>{ const pleading=await prisma.documentTemplate.findUnique({where:{key:"${PLEADING_KEY}"}}); if(pleading){ await prisma.$transaction(async(tx)=>{ await tx.documentTemplateMergeField.deleteMany({where:{templateId:pleading.id}}); await tx.documentTemplateVersion.deleteMany({where:{templateId:pleading.id}}); await tx.documentTemplate.delete({where:{id:pleading.id}}); }); console.log("Rolled back layout asset:", "${PLEADING_KEY}"); } else { console.log("No pleading layout asset found."); } })().finally(async()=>{ await prisma.$disconnect(); await pool.end(); });\n`;
    fs.writeFileSync(path.join(backupDir, "rollback-phase48b-pleading-layout-asset.cjs"), rollbackScript);

    const after = {
      pleading: await prisma.documentTemplate.findUnique({ where: { key: PLEADING_KEY }, include: { versions: { orderBy: { versionNumber: "asc" } }, mergeFields: { orderBy: { key: "asc" } } } }),
      letterhead: await prisma.documentTemplate.findUnique({ where: { key: LETTERHEAD_KEY }, include: { versions: true, mergeFields: { orderBy: { key: "asc" } } } }),
      counts: {
        documentTemplates: await prisma.documentTemplate.count(),
        documentTemplateVersions: await prisma.documentTemplateVersion.count(),
        documentTemplateMergeFields: await prisma.documentTemplateMergeField.count(),
      },
    };

    const pleadingMeta = after.pleading?.metadata || {};
    const letterheadMeta = after.letterhead?.metadata || {};
    const proof = {
      ok: Boolean(after.pleading && after.pleading.enabled === false && after.pleading.versions?.[0]?.storageKind === "db-docx-base64" && pleadingMeta.templateKind === "layout_asset" && pleadingMeta.selectableForNormalGeneration === false && after.pleading.mergeFields?.length > 0 && after.letterhead?.mergeFields?.length >= letterheadLayoutFields.length),
      action: "phase48b-import-pleading-paper-layout-asset-and-layout-merge-inventory",
      connectionSource,
      ownerProof,
      pleadingKey: PLEADING_KEY,
      pleadingLabel: PLEADING_LABEL,
      pleadingCategory: PLEADING_CATEGORY,
      backupDir,
      docxPath,
      sourceSha256: docxHash,
      sourceByteLength: docxBuffer.byteLength,
      legacyPlaceholderCount: legacyPlaceholders.length,
      legacyPlaceholders,
      beforeCounts: before.counts,
      afterCounts: after.counts,
      created: {
        pleadingLayoutId: result.pleading.id,
        pleadingVersionId: result.version.id,
        pleadingVersionNumber: result.version.versionNumber,
        pleadingMergeFieldCount: after.pleading?.mergeFields?.length || 0,
        letterheadMergeFieldCount: after.letterhead?.mergeFields?.length || 0,
      },
      layoutRules: {
        pleadingPaper: {
          layoutFamily: "pleading_paper",
          nonGenerationAsset: true,
          selectableForNormalGeneration: false,
          mappingPendingUserReview: true,
        },
        letterhead: {
          layoutFamily: letterheadMeta.layoutFamily,
          mergeFieldInventoryOnly: letterheadMeta.mergeFieldInventoryOnly === true,
          fieldMappingPerformed: letterheadMeta.fieldMappingPerformed === false,
        },
      },
      safety: {
        docxBasedLayoutAsset: true,
        macAndWindowsCompatible: true,
        nonGenerationAsset: true,
        selectableForNormalGeneration: false,
        mergeFieldInventoryOnly: true,
        fieldMappingPerformed: false,
        mappingPendingUserReview: true,
        clioTouched: false,
        graphTouched: false,
        documentsFinalized: false,
        printQueueChanged: false,
        emailSent: false,
        ownerAdminOnly: true,
      },
    };
    fs.writeFileSync(path.join(backupDir, "phase48b-pleading-layout-import-proof.json"), JSON.stringify(proof, replacer, 2));
    console.log(JSON.stringify(proof, replacer, 2));
    if (!proof.ok) throw new Error("Phase 48B pleading layout import proof failed.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch((err) => { console.error("FAIL:", err && err.stack ? err.stack : err); process.exit(1); });
