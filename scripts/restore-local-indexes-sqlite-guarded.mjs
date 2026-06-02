#!/usr/bin/env node
console.error('FAIL: SQLite guarded restore is not active for the current PostgreSQL-backed Barsh Matters database.');
console.error('Use restore:indexes-postgres-guarded with CONFIRM_RESTORE=YES_RESTORE_LOCAL_POSTGRES_DATABASE for PostgreSQL restores.');
process.exit(1);
