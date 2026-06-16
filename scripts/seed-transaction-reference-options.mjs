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
  { displayName: "Collection Payment", aliases: ["Collection Payment", "Collection"], details: { remittanceCategory: "principal_interest", directMatterAllowed: false, lawsuitAllowed: true, defaultStatus: "Show on Remittance", includeOnInvoicePreview: true, retainerEligible: true, sortOrder: 10 } },
  { displayName: "Voluntary Payment", aliases: ["Voluntary Payment", "Voluntary"], details: { remittanceCategory: "principal_interest", directMatterAllowed: true, lawsuitAllowed: false, defaultStatus: "Show on Remittance", includeOnInvoicePreview: true, retainerEligible: true, sortOrder: 20 } },
  { displayName: "Interest", aliases: ["Interest"], details: { remittanceCategory: "principal_interest", directMatterAllowed: true, lawsuitAllowed: true, defaultStatus: "Show on Remittance", includeOnInvoicePreview: true, retainerEligible: true, retainerRateKind: "interest", sortOrder: 30 } },
  { displayName: "Index Fee", aliases: ["Index Fee", "Filing Fee", "Filing Fee Collected", "Index Fee Collected"], details: { remittanceCategory: "cost_recovery", directMatterAllowed: false, lawsuitAllowed: true, defaultStatus: "Show on Remittance", includeOnInvoicePreview: true, retainerEligible: false, costCategory: "index_fee", sortOrder: 40 } },
  { displayName: "Service Fee", aliases: ["Service Fee", "Service Fee Collected"], details: { remittanceCategory: "cost_recovery", directMatterAllowed: false, lawsuitAllowed: true, defaultStatus: "Show on Remittance", includeOnInvoicePreview: true, retainerEligible: false, costCategory: "service_fee", sortOrder: 50 } },
  { displayName: "Other Court Costs", aliases: ["Other Court Costs", "Other Court Fees Collected", "Other Court Costs Collected"], details: { remittanceCategory: "cost_recovery", directMatterAllowed: false, lawsuitAllowed: true, defaultStatus: "Show on Remittance", includeOnInvoicePreview: true, retainerEligible: false, costCategory: "other_court_costs", sortOrder: 60 } },
  { displayName: "PreC to Provider", aliases: ["PreC to Provider", "Direct Pay to Provider", "Direct Pay to Provider (Pre-suit)"], details: { remittanceCategory: "direct_pay_to_provider", directMatterAllowed: true, lawsuitAllowed: true, defaultStatus: "Show on Remittance", includeOnInvoicePreview: true, retainerEligible: true, sortOrder: 70 } },
  { displayName: "Attorney Fee", aliases: ["Attorney Fee"], details: { remittanceCategory: "attorney_fee", directMatterAllowed: false, lawsuitAllowed: true, defaultStatus: "Do Not Show on Remittance", includeOnInvoicePreview: false, retainerEligible: false, sortOrder: 80 } },
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

function transactionReferenceDisplayName(option) {
  return typeof option === "string" ? option : option.displayName;
}

function transactionReferenceAliases(option) {
  return typeof option === "string" ? [] : option.aliases || [];
}

function transactionReferenceDetails(option) {
  const base = {
    source: "seed:transaction-reference-options",
    paymentReferenceOption: true,
  };
  if (typeof option === "string") return base;
  return { ...base, ...(option.details || {}) };
}


async function upsertReferenceOption(type, displayName, aliases = [], details = {}) {
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
      details,
      source: "barsh-matters-local",
    },
    update: {
      displayName,
      active: true,
      notes: "Seeded payment transaction reference option",
      details,
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
  for (const option of TRANSACTION_TYPES) {
    await upsertReferenceOption("transaction_type", transactionReferenceDisplayName(option), transactionReferenceAliases(option), transactionReferenceDetails(option));
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
