#!/usr/bin/env node
import fs from "fs";

const schemaPath = "prisma/schema.prisma";
const migrationPath = "prisma/migrations/20260520203000_add_document_template_repository/migration.sql";

const schema = fs.readFileSync(schemaPath, "utf8");
const migration = fs.readFileSync(migrationPath, "utf8");

const checks = [
  ["DocumentTemplate model exists", schema.includes("model DocumentTemplate ")],
  ["DocumentTemplateVersion model exists", schema.includes("model DocumentTemplateVersion ")],
  ["DocumentTemplateMergeField model exists", schema.includes("model DocumentTemplateMergeField ")],
  ["template key unique", /key\s+String\s+@unique/.test(schema)],
  ["template versions relation", schema.includes("versions                   DocumentTemplateVersion[]") || schema.includes("DocumentTemplateVersion[]")],
  ["merge fields relation", schema.includes("mergeFields                DocumentTemplateMergeField[]") || schema.includes("DocumentTemplateMergeField[]")],
  ["metadata json supported", /metadata\s+Json\?/.test(schema)],
  ["migration creates DocumentTemplate", migration.includes('CREATE TABLE "DocumentTemplate"')],
  ["migration creates DocumentTemplateVersion", migration.includes('CREATE TABLE "DocumentTemplateVersion"')],
  ["migration creates DocumentTemplateMergeField", migration.includes('CREATE TABLE "DocumentTemplateMergeField"')],
  ["migration has foreign keys", migration.includes("DocumentTemplateVersion_templateId_fkey") && migration.includes("DocumentTemplateMergeField_templateId_fkey")],
];

let failed = false;
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    console.log(`FAIL: ${label}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("PASS: document template DB schema foundation verifier");
