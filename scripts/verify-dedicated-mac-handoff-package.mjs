#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function fileIncludes(file, fragments) {
  if (!fs.existsSync(file)) {
    fail(`Missing required file: ${file}`);
    return;
  }

  const text = fs.readFileSync(file, "utf8");

  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      fail(`${file}: missing required fragment: ${fragment}`);
    } else {
      pass(`${file}: contains ${fragment}`);
    }
  }
}

console.log("RESULT: dedicated Mac handoff package verifier");
console.log("MODE=read-only");
console.log("RESTORE_EXECUTION=NO");
console.log("CLIO_CALLS=NO");

fileIncludes("docs/dedicated-mac-backup-restore-handoff.md", [
  "Barsh Matters Dedicated Mac Backup / Restore / Handoff Plan",
  "A different dedicated Mac will ultimately run Barsh Matters",
  "CLOUD_TARGET.txt is machine-specific and should remain untracked",
  "Restore drill result - 2026-06-05",
  "RESTORE_COMPLETE=YES",
  "Clio is the document vault",
]);

fileIncludes("docs/dedicated-mac-secrets-inventory-template.md", [
  "Do not write secret values in this file",
  "DATABASE_URL",
  "DIRECT_URL",
  "CLIO_CLIENT_SECRET",
  "MICROSOFT_GRAPH_CLIENT_SECRET",
  "CLOUD_TARGET.txt",
]);

fileIncludes("docs/removable-disk-backup-checklist.md", [
  "Dropbox protects against loss of the local machine",
  "Time Machine",
  "backups/indexes",
  ".env or .env.local",
  "LaunchAgent",
]);

fileIncludes("backups/indexes/backup-cloud-target.example.txt", [
  "Dropbox example",
  "Barsh Matters Backups/indexes",
  "CLOUD_TARGET.txt",
  "ignored by Git",
]);

fileIncludes(".gitignore", [
  ".env*",
  "backups/indexes/*",
  "!backups/indexes/.gitkeep",
  "!backups/indexes/backup-cloud-target.example.txt",
]);

const requiredScripts = [
  "scripts/backup-local-indexes.mjs",
  "scripts/backup-local-indexes-monitored.mjs",
  "scripts/restore-local-indexes-preview.mjs",
  "scripts/restore-local-indexes-postgres-guarded.mjs",
  "scripts/verify-admin-backup-prisma-model-archive-coverage.mjs",
  "scripts/verify-dropbox-backup-mirror-safety.mjs",
  "scripts/verify-dedicated-mac-backup-readiness.mjs",
];

for (const script of requiredScripts) {
  if (fs.existsSync(script)) {
    pass(`Required script exists: ${script}`);
  } else {
    fail(`Required script missing: ${script}`);
  }
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const requiredPackageScripts = {
  "backup:indexes": "node scripts/backup-local-indexes.mjs",
  "backup:indexes:monitored": "node scripts/backup-local-indexes-monitored.mjs",
  "restore:indexes-preview": "node scripts/restore-local-indexes-preview.mjs",
  "restore:indexes-postgres-guarded": "node scripts/restore-local-indexes-postgres-guarded.mjs",
  "verify:dropbox-backup-mirror-safety": "node scripts/verify-dropbox-backup-mirror-safety.mjs",
  "verify:dedicated-mac-backup-readiness": "node scripts/verify-dedicated-mac-backup-readiness.mjs",
  "verify:admin-backup-prisma-model-archive-coverage": "node scripts/verify-admin-backup-prisma-model-archive-coverage.mjs",
};

for (const [name, command] of Object.entries(requiredPackageScripts)) {
  if (pkg.scripts?.[name] === command) {
    pass(`package.json script present: ${name}`);
  } else {
    fail(`package.json script missing or changed: ${name}`);
  }
}

if (fs.existsSync("backups/indexes/CLOUD_TARGET.txt")) {
  try {
    const ignored = execSync("git check-ignore backups/indexes/CLOUD_TARGET.txt", { encoding: "utf8" })
      .trim();

    if (ignored) {
      pass("backups/indexes/CLOUD_TARGET.txt is ignored by Git.");
    } else {
      fail("backups/indexes/CLOUD_TARGET.txt exists but is not ignored by Git.");
    }
  } catch {
    fail("backups/indexes/CLOUD_TARGET.txt exists but git check-ignore did not confirm it is ignored.");
  }
} else {
  pass("backups/indexes/CLOUD_TARGET.txt is absent; dedicated Mac must create it locally.");
}

console.log(`FAILURES=${failures}`);

if (failures) {
  process.exit(1);
}

console.log("PASS: Dedicated Mac handoff package is complete at the repo level.");
