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

const pool = new Pool({
  connectionString: databaseUrl,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["error"],
});

const SETTLED_WITH_CONTACTS = [
  {
    name: "Dora Reyes",
    email: "dora.reyes@libertymutual.com",
    company: "Liberty Mutual",
  },
  {
    name: "Victoria Fitzsimmons",
    email: "Victoria.Fitzsimons@libertymutual.com",
    company: "Liberty Mutual",
    aliases: ["Victoria Fitzsimons"],
  },
  {
    name: "Claudia Doherty",
    email: "Claudia.doherty@libertymutual.com",
    company: "Liberty Mutual",
  },
  {
    name: "Diane Hofmann",
    email: "dhofb@allstate.com",
    company: "Allstate",
  },
  {
    name: "Maryrose Evans",
    email: "Maryrose.Evans@libertymutual.com",
    company: "Liberty Mutual",
    aliases: ["Mayrose Evans"],
  },
  {
    name: "Carrie Goodman",
    email: "carrie.goodman.jb8g@statefarm.com",
    company: "State Farm",
  },
  {
    name: "Cindy Singh",
    email: "cindy.singh.vaicig@statefarm.com",
    company: "State Farm",
  },
  {
    name: "Christopher Sciarotto",
    email: "christopher.sciarrotto@libertymutual.com",
    company: "Liberty Mutual",
  },
  {
    name: "Michael Jones",
    email: "Michael0203.Jones@LibertyMutual.com",
    company: "Liberty Mutual",
  },
  {
    name: "Lynnette Marzan-Claudio",
    email: "Lynette.Marzan-Claudio@libertymutual.com",
    company: "Liberty Mutual",
    aliases: ["Lynette Marzan-Claudio"],
  },
  {
    name: "Christine Madigan",
    email: "christine_madigan@progressive.com",
    company: "Progressive",
  },
  {
    name: "Jennifer Michaels",
    email: "Jennifer_Michaels@progressive.com",
    company: "Progressive",
  },
  {
    name: "Shawn Scheidecker",
    email: "shawn.scheidecker.u1zn@statefarm.com",
    company: "State Farm",
  },
  {
    name: "Anxhela Ringer",
    email: "anxhela.ringer.umlg@statefarm.com",
    company: "State Farm",
  },
  {
    name: "Christopher Harris",
    email: "christopher.harris@allstate.com",
    company: "Allstate",
  },
  {
    name: "David Streiner",
    email: "DStreiner@streinerlaw.com",
    company: "Streiner Law",
  },
  {
    name: "Clarissa Moreno",
    email: "Cmoreno@streinerlaw.com",
    company: "Streiner Law",
  },
  {
    name: "Theresa Balzer",
    email: "Theresa_Balzer@Progressive.com",
    company: "Progressive",
  },
  {
    name: "Nicole Perry",
    email: "nicole.perry.cw8a@statefarm.com",
    company: "State Farm",
  },
  {
    name: "Michelle Oleksy",
    email: "OleksyM@nationwide.com",
    company: "Nationwide",
  },
];

function cleanText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeReferenceText(value) {
  return cleanText(value).toLowerCase();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function displayContact(contact) {
  const name = cleanText(contact.name);
  const email = cleanText(contact.email);
  return email ? `${name} <${email}>` : name;
}

function assertValidContact(contact) {
  const name = cleanText(contact.name);
  const email = cleanText(contact.email);

  if (!name) {
    throw new Error("Settled-with reference contact is missing a name.");
  }

  if (!email || !email.includes("@")) {
    throw new Error(`Settled-with reference contact has invalid email: ${name}`);
  }
}

async function upsertSettlementContact(contact) {
  const name = cleanText(contact.name);
  const email = cleanText(contact.email);
  const company = cleanText(contact.company);

  return prisma.settlementContact.upsert({
    where: {
      name_email: {
        name,
        email,
      },
    },
    create: {
      name,
      email,
      company,
      role: "Settled With",
      isActive: true,
      metadata: {
        source: "seed:settled-with-reference-contacts",
        referenceType: "individual",
        settledWith: true,
      },
    },
    update: {
      company,
      role: "Settled With",
      isActive: true,
      metadata: {
        source: "seed:settled-with-reference-contacts",
        referenceType: "individual",
        settledWith: true,
      },
    },
  });
}

async function upsertReferenceEntity(contact) {
  const name = cleanText(contact.name);
  const email = cleanText(contact.email);
  const company = cleanText(contact.company);
  const normalizedName = normalizeReferenceText(name);

  const entity = await prisma.referenceEntity.upsert({
    where: {
      type_normalizedName: {
        type: "individual",
        normalizedName,
      },
    },
    create: {
      type: "individual",
      displayName: name,
      normalizedName,
      active: true,
      notes: "Settled With contact",
      details: {
        email,
        company,
        role: "Settled With",
        source: "seed:settled-with-reference-contacts",
        settledWith: true,
      },
      source: "barsh-matters-local",
    },
    update: {
      displayName: name,
      active: true,
      notes: "Settled With contact",
      details: {
        email,
        company,
        role: "Settled With",
        source: "seed:settled-with-reference-contacts",
        settledWith: true,
      },
      source: "barsh-matters-local",
    },
  });

  const aliases = new Set(
    [
      name,
      email,
      normalizeEmail(email),
      displayContact(contact),
      company ? `${name} ${company}` : "",
      ...(Array.isArray(contact.aliases) ? contact.aliases : []),
    ]
      .map(cleanText)
      .filter(Boolean),
  );

  for (const alias of aliases) {
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
  for (const contact of SETTLED_WITH_CONTACTS) {
    assertValidContact(contact);
    await upsertSettlementContact(contact);
    await upsertReferenceEntity(contact);
  }

  const emails = SETTLED_WITH_CONTACTS.map((contact) => cleanText(contact.email));
  const names = SETTLED_WITH_CONTACTS.map((contact) => cleanText(contact.name));

  const settlementContactCount = await prisma.settlementContact.count({
    where: {
      OR: [{ email: { in: emails } }, { name: { in: names } }],
    },
  });

  const referenceEntityCount = await prisma.referenceEntity.count({
    where: {
      type: "individual",
      normalizedName: {
        in: names.map(normalizeReferenceText),
      },
    },
  });

  console.log("Seeded settled-with reference contacts.");
  console.log(`SETTLEMENT_CONTACT_COUNT=${settlementContactCount}`);
  console.log(`REFERENCE_ENTITY_COUNT=${referenceEntityCount}`);
  console.log(`EXPECTED_COUNT=${SETTLED_WITH_CONTACTS.length}`);
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
