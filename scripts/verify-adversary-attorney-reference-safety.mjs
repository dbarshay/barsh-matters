#!/usr/bin/env node

import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustContain(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

const csv = read("data/reference/adversary_attorneys_upload.csv");
const options = read("app/api/reference-data/options/route.ts");
const metadataRoute = read("app/api/lawsuits/update-metadata/route.ts");
const matters = read("app/matters/page.tsx");
const seed = read("scripts/seed-adversary-attorneys-reference.mjs");

const rowCount = csv.split(/\r?\n/).filter((line, index) => index > 0 && line.trim()).length;

mustContain("CSV table exists", csv, "adversary_attorney_id,display_firm_name,firm_name");
mustContain("CSV contains expected row count marker", String(rowCount), "39");
mustContain("Reference options supports adversary_attorney", options, 'adversary_attorney: "Adversary Attorneys"');
mustContain("Reference options aliases adversary", options, 'adversary: "adversary_attorney"');
mustContain("Seed writes ReferenceEntity", seed, "prisma.referenceEntity.upsert");
mustContain("Seed uses PrismaPg adapter", seed, 'import { PrismaPg } from "@prisma/adapter-pg";');
mustContain("Seed uses configured Prisma adapter", seed, "new PrismaClient({ adapter, log: [\"error\"] })");
mustContain("Seed loads local env", seed, "loadLocalEnvFile(path.join(process.cwd(), \".env.local\"));");
mustContain("Seed uses adversary_attorney type", seed, 'const TYPE = "adversary_attorney";');
mustContain("Metadata route stores adversary firm", metadataRoute, "adversaryAttorney: text(body?.adversaryAttorney)");
mustContain("Metadata route stores selected details", metadataRoute, "selectedAdversaryAttorneyDetails");
mustContain("Master UI displays Adversary Attorney", matters, "Adversary Attorney");
mustContain("Master UI persists adversary field", matters, '"adversaryAttorney"');
mustContain("Master UI gets adversary from local metadata", matters, "function masterAdversaryAttorneyDisplayValue()");
mustContain("Master UI treats adversary as contact", matters, '["provider", "patient", "insurer", "adversaryAttorney"].includes(field)');
mustContain("Master UI uses adversary reference type", matters, 'return "adversary_attorney";');
mustContain("Master UI stores adversary details", matters, "selectedAdversaryAttorneyDetails = masterInfoSelectedContact?.details || null");
mustContain("Master UI places adversary near lawsuit info", matters, "Open Adversary Attorney edit dialog");
mustContain("Graph preview grid remains six columns", matters, 'gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, marginBottom: 14, fontSize: 12');

console.log("RESULT: verify Adversary Attorney reference safety");
console.log("EXPECTS_REFERENCE_ENTITY_STORAGE=YES");
console.log("EXPECTS_SEEDED_ADVERSARY_ATTORNEY_TABLE=YES");
console.log("EXPECTS_MASTER_LAWSUIT_FIELD=YES");
console.log("EXPECTS_DROPDOWN_CONTACT_BEHAVIOR=YES");
console.log("EXPECTS_DETAILS_AVAILABLE_FOR_DOCS=YES");
console.log("CSV_ROW_COUNT=" + rowCount);
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
