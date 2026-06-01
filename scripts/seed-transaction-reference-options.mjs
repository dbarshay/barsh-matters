import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function loadLocalEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const equalsIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile(path.join(process.cwd(), ".env.local"));
loadLocalEnvFile(path.join(process.cwd(), ".env"));

const databaseUrl =
  process.env.POSTGRES_DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("No Postgres database URL found.");
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

const TRANSACTION_TYPES = [
  "Collection Payment",
  "Voluntary Payment",
  "Attorney Fee",
  "Filing Fee Collected",
  "Filing Fee Billed",
  "Index Fee Collected",
  "Index Fee Billed",
  "Interest",
  "PreC to Provider",
  "Service Fee Collected",
  "Service Fee Billed",
  "Other Court Fees Collected",
  "Other Court Fees Billed",
];

const TRANSACTION_STATUSES = [
  "Show on Remittance",
  "Do Not Show on Remittance",
];

function cleanText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeReferenceText(value) {
  return cleanText(value).toLowerCase();
}

async function upsertReferenceOption(type, displayName, aliases = []) {
  const normalizedName = normalizeReferenceText(displayName);

  const entity = await prisma.referenceEntity.upsert({
    where: {
      type_normalizedName: {
        type,
        normalizedName,
      },
    },
    create: {
      type,
      displayName,
      normalizedName,
      active: true,
      notes: "Seeded payment transaction reference option",
      details: {
        source: "seed:transaction-reference-options",
        paymentReferenceOption: true,
      },
      source: "barsh-matters-local",
    },
    update: {
      displayName,
      active: true,
      notes: "Seeded payment transaction reference option",
      details: {
        source: "seed:transaction-reference-options",
        paymentReferenceOption: true,
      },
      source: "barsh-matters-local",
    },
  });

  for (const alias of new Set([displayName, ...aliases].map(cleanText).filter(Boolean))) {
    await prisma.referenceAlias.upsert({
      where: {
        entityId_normalizedAlias: {
          entityId: entity.id,
          normalizedAlias: normalizeReferenceText(alias),
        },
      },
      create: {
        entityId: entity.id,
        alias,
        normalizedAlias: normalizeReferenceText(alias),
      },
      update: {
        alias,
      },
    });
  }

  return entity;
}

async function main() {
  for (const value of TRANSACTION_TYPES) {
    await upsertReferenceOption("transaction_type", value);
  }

  for (const value of TRANSACTION_STATUSES) {
    await upsertReferenceOption("transaction_status", value);
  }

  const typeCount = await prisma.referenceEntity.count({
    where: { type: "transaction_type", active: true },
  });
  const statusCount = await prisma.referenceEntity.count({
    where: { type: "transaction_status", active: true },
  });

  console.log("Seeded transaction reference options.");
  console.log(`TRANSACTION_TYPE_COUNT=${typeCount}`);
  console.log(`TRANSACTION_STATUS_COUNT=${statusCount}`);
  console.log(`EXPECTED_TRANSACTION_TYPE_COUNT=${TRANSACTION_TYPES.length}`);
  console.log(`EXPECTED_TRANSACTION_STATUS_COUNT=${TRANSACTION_STATUSES.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
