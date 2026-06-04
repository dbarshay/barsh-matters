#!/usr/bin/env node

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

const CSV_PATH = "data/reference/adversary_attorneys_upload.csv";
const TYPE = "adversary_attorney";

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeName(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((value) => clean(value))) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => clean(value))) rows.push(row);
  }

  return rows;
}

function rowObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = clean(row[index]);
  });
  return obj;
}

async function main() {
  const csv = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csv);
  const headers = rows[0] || [];
  const dataRows = rows.slice(1).map((row) => rowObject(headers, row));

  let upserted = 0;
  let skipped = 0;

  for (const row of dataRows) {
    const displayName = clean(row.display_firm_name || row.firm_name);
    if (!displayName) {
      skipped++;
      continue;
    }

    const normalizedName = normalizeName(displayName);
    const details = {
      adversaryAttorneyId: clean(row.adversary_attorney_id),
      firmName: clean(row.firm_name || displayName),
      addressLine1: clean(row.address_line_1),
      addressLine2: clean(row.address_line_2),
      city: clean(row.city),
      state: clean(row.state),
      zip: clean(row.zip),
      phone: clean(row.phone),
      fax: clean(row.fax),
      email: clean(row.email),
      searchText: clean(row.search_text),
      uploadSource: "data/reference/adversary_attorneys_upload.csv",
      displayOnlyField: "displayName",
      documentMergeFieldsAvailable: true
    };

    await prisma.referenceEntity.upsert({
      where: {
        type_normalizedName: {
          type: TYPE,
          normalizedName
        }
      },
      update: {
        displayName,
        active: clean(row.active).toLowerCase() !== "false",
        details,
        source: "barsh-matters-adversary-attorney-upload"
      },
      create: {
        type: TYPE,
        displayName,
        normalizedName,
        active: clean(row.active).toLowerCase() !== "false",
        details,
        source: "barsh-matters-adversary-attorney-upload"
      }
    });

    upserted++;
  }

  const count = await prisma.referenceEntity.count({
    where: {
      type: TYPE,
      active: true
    }
  });

  console.log("RESULT: seeded adversary attorney reference table");
  console.log(`TYPE=${TYPE}`);
  console.log(`UPSERTED=${upserted}`);
  console.log(`SKIPPED=${skipped}`);
  console.log(`ACTIVE_COUNT=${count}`);
  console.log("WRITES_REFERENCE_ENTITY=true");
  console.log("WRITES_CLIO=false");
}

main()
  .catch((error) => {
    console.error("FAIL: seed adversary attorneys failed");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
