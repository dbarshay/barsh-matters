// Insert a TEST FiledDocument so the Phase 2 tree has something to render.
//
//   npx tsx scripts/seed-test-filed-document.ts <matterId> [folderKey] [titleKey]
//   default folderKey = claim_documents.bills   default titleKey = bill
//
// Uses a direct pg-adapter PrismaClient (mirrors lib/prisma.ts) to avoid the server-only guard.
// The clioDocumentId here is a placeholder — real filing (Phase 3) supplies a genuine Clio id.

import fs from "fs";
import path from "path";
import crypto from "crypto";

function loadLocalEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}
loadLocalEnvFile(".env.local");
loadLocalEnvFile(".env");

async function main() {
  const [, , matterIdArg, folderKeyArg, titleKeyArg] = process.argv;
  const matterId = Number(matterIdArg);
  if (!Number.isFinite(matterId) || matterId <= 0) {
    console.error("Usage: npx tsx scripts/seed-test-filed-document.ts <matterId> [folderKey] [titleKey]");
    process.exit(1);
  }
  const folderKey = folderKeyArg || "claim_documents.bills";
  const titleKey = titleKeyArg || "bill";

  const { getFolder, isTitleAllowed, composeTitleLabel } = await import("@/lib/documents/folderTaxonomy");
  const folder = getFolder(folderKey);
  if (!folder || !folder.terminal) {
    console.error(`Bad folderKey "${folderKey}" (must be a terminal folder).`);
    process.exit(1);
  }
  if (!isTitleAllowed(folderKey, titleKey)) {
    console.error(`Title "${titleKey}" not allowed in "${folderKey}".`);
    process.exit(1);
  }

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  const url =
    process.env.POSTGRES_DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    "";
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("sslmode=require") ? undefined : { rejectUnauthorized: true },
  });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const titleLabel = composeTitleLabel(folderKey, titleKey, {}, null);
    const row = await db.filedDocument.create({
      data: {
        matterId,
        level: folder.level,
        clioDocumentId: `TEST-${crypto.randomBytes(4).toString("hex")}`,
        fileName: "test-sample.pdf",
        contentType: "application/pdf",
        fileHash: crypto.randomBytes(16).toString("hex"),
        folderKey,
        titleKey,
        titleLabel,
        sourceType: "scan",
      },
    });
    console.log(`Inserted FiledDocument id=${row.id} → matter ${matterId} / ${folderKey} / "${titleLabel}"`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
