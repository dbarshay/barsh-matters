import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) fail(`${label} missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) fail(`${label} must not contain ${needle}`);
}

const seedPath = "scripts/seed-settled-with-reference-contacts.mjs";
const packagePath = "package.json";

const seed = read(seedPath);
const packageJson = read(packagePath);

const expectedContacts = [
  "Dora Reyes",
  "dora.reyes@libertymutual.com",
  "Victoria Fitzsimmons",
  "Victoria.Fitzsimons@libertymutual.com",
  "Victoria Fitzsimons",
  "Claudia Doherty",
  "Claudia.doherty@libertymutual.com",
  "Diane Hofmann",
  "dhofb@allstate.com",
  "Maryrose Evans",
  "Maryrose.Evans@libertymutual.com",
  "Mayrose Evans",
  "Carrie Goodman",
  "carrie.goodman.jb8g@statefarm.com",
  "Cindy Singh",
  "cindy.singh.vaicig@statefarm.com",
  "Christopher Sciarotto",
  "christopher.sciarrotto@libertymutual.com",
  "Michael Jones",
  "Michael0203.Jones@LibertyMutual.com",
  "Lynnette Marzan-Claudio",
  "Lynette.Marzan-Claudio@libertymutual.com",
  "Lynette Marzan-Claudio",
];

for (const expected of expectedContacts) {
  mustContain("settled-with seed", seed, expected);
}

mustContain("package.json", packageJson, "seed:settled-with-reference-contacts");
mustContain("package.json", packageJson, "verify:settled-with-reference-contacts-seed-safety");

mustContain("settled-with seed", seed, 'import { PrismaPg } from "@prisma/adapter-pg"');
mustContain("settled-with seed", seed, 'import { Pool } from "pg"');
mustContain("settled-with seed", seed, 'import fs from "node:fs"');
mustContain("settled-with seed", seed, 'import path from "node:path"');
mustContain("settled-with seed", seed, "loadLocalEnvFile");
mustContain("settled-with seed", seed, ".env.local");
mustContain("settled-with seed", seed, ".env");
mustContain("settled-with seed", seed, "POSTGRES_DATABASE_URL_UNPOOLED");
mustContain("settled-with seed", seed, "new PrismaClient({");
mustContain("settled-with seed", seed, "adapter");
mustContain("settled-with seed", seed, "prisma.settlementContact.upsert");
mustContain("settled-with seed", seed, "prisma.referenceEntity.upsert");
mustContain("settled-with seed", seed, "prisma.referenceAlias.upsert");
mustContain("settled-with seed", seed, 'type: "individual"');
mustContain("settled-with seed", seed, 'role: "Settled With"');
mustContain("settled-with seed", seed, "settledWith: true");
mustContain("settled-with seed", seed, "name_email");
mustContain("settled-with seed", seed, "type_normalizedName");
mustContain("settled-with seed", seed, "entityId_normalizedAlias");

mustNotContain("settled-with seed", seed, "getValidClioAccessToken");
mustNotContain("settled-with seed", seed, "clioFetch");
mustNotContain("settled-with seed", seed, "CLIO_API_BASE");
mustNotContain("settled-with seed", seed, "fetch(");

if (process.exitCode) {
  process.exit();
}

console.log("Settled-with reference contacts seed safety verifier passed.");
