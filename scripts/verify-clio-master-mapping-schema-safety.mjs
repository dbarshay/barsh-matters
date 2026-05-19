import fs from "node:fs";

let failures = 0;

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (!text.includes(needle)) pass(`${label}: does not contain ${needle}`);
  else fail(`${label}: must not contain ${needle}`);
}

const schemaPath = "prisma/schema.prisma";
const migrationPath = "prisma/migrations/202605190001_add_lawsuit_clio_master_mapping/migration.sql";
const packagePath = "package.json";

const schema = read(schemaPath);
const migration = read(migrationPath);
const packageJson = read(packagePath);

console.log("=== CLIO MASTER MAPPING SCHEMA SAFETY VERIFICATION ===");

mustContain(schemaPath, schema, "clioMasterMatterId");
mustContain(schemaPath, schema, "clioMasterDisplayNumber");
mustContain(schemaPath, schema, "clioMasterMatterDescription");
mustContain(schemaPath, schema, "clioMasterMappedAt");
mustContain(schemaPath, schema, "clioMasterMappingSource");
mustContain(schemaPath, schema, "@@index([clioMasterMatterId])");
mustContain(schemaPath, schema, "@@index([clioMasterDisplayNumber])");

mustContain(migrationPath, migration, 'ALTER TABLE "Lawsuit"');
mustContain(migrationPath, migration, 'ADD COLUMN IF NOT EXISTS "clioMasterMatterId" INTEGER');
mustContain(migrationPath, migration, 'ADD COLUMN IF NOT EXISTS "clioMasterDisplayNumber" TEXT');
mustContain(migrationPath, migration, 'ADD COLUMN IF NOT EXISTS "clioMasterMatterDescription" TEXT');
mustContain(migrationPath, migration, 'ADD COLUMN IF NOT EXISTS "clioMasterMappedAt" TIMESTAMP(3)');
mustContain(migrationPath, migration, 'ADD COLUMN IF NOT EXISTS "clioMasterMappingSource" TEXT');
mustContain(migrationPath, migration, 'CREATE INDEX IF NOT EXISTS "Lawsuit_clioMasterMatterId_idx"');
mustContain(migrationPath, migration, 'CREATE INDEX IF NOT EXISTS "Lawsuit_clioMasterDisplayNumber_idx"');

mustNotContain(migrationPath, migration, "DROP TABLE");
mustNotContain(migrationPath, migration, "DROP COLUMN");
mustNotContain(migrationPath, migration, "DELETE FROM");
mustNotContain(migrationPath, migration, "TRUNCATE");

if (packageJson.includes('"verify:clio-master-mapping-schema-safety"')) {
  pass("package.json: verifier registered");
} else {
  fail("package.json: verifier not registered");
}

if (failures) {
  console.error(`=== CLIO MASTER MAPPING SCHEMA SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== CLIO MASTER MAPPING SCHEMA SAFETY PASSED ===");
