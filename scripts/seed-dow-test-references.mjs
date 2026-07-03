#!/usr/bin/env node
// SUPERSEDED — do not run.
// A standalone `new PrismaClient()` fails on Prisma 7 (it needs the app's configured client/adapter).
// Seed the Dow test carriers + provider from the app instead:
//   - UI: /admin/import  ->  "Test data: Seed carriers + provider" / "Remove test seed"
//   - or: POST /api/import/dev-seed-references   (DELETE to remove)   [requires BARSH_IMPORT_ENABLED=1]
console.error("Superseded. Use /admin/import (Test data buttons) or the /api/import/dev-seed-references route.");
process.exit(1);
