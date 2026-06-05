# Barsh Matters Dedicated Mac Secrets Inventory Template

## Purpose

This file lists the secret/configuration categories that must be preserved outside Git before moving Barsh Matters to the dedicated Mac.

Do not write secret values in this file. Store values in an approved secure location such as a password manager, encrypted disk image, or other firm-approved secure vault.

## Required database configuration

Record where the value is stored, not the value itself.

- DATABASE_URL
- DIRECT_URL
- RESTORE_DATABASE_URL, only when doing a restore drill
- PG_DUMP_BIN, if pg_dump is not on PATH
- PG_RESTORE_BIN, if pg_restore is not on PATH

## Clio configuration

- CLIO_CLIENT_ID
- CLIO_CLIENT_SECRET
- CLIO_REDIRECT_URI
- Clio token storage expectations
- Clio app/account ownership notes

## Microsoft Graph / email configuration

- MICROSOFT_GRAPH_TENANT_ID
- MICROSOFT_GRAPH_CLIENT_ID
- MICROSOFT_GRAPH_CLIENT_SECRET
- MICROSOFT_GRAPH_MAILBOX_USER_ID
- Backup alert recipient configuration
- Email automation configuration, if enabled

## Backup configuration

- Local repo path on dedicated Mac
- Local Dropbox sync path
- backups/indexes/CLOUD_TARGET.txt path and expected contents
- Time Machine or removable disk target
- Backup alert recipient list
- Scheduled backup LaunchAgent path

## Vercel / deployment configuration

- Vercel organization/project ownership
- Environment variable location
- Deployment URL
- Production database project identity

## Verification checklist

Before staff deployment, confirm:

- Secrets restored to the dedicated Mac without committing them to Git.
- npm install completed.
- npm run backup:indexes completed.
- npm run verify:dropbox-backup-mirror-safety passed.
- npm run verify:dedicated-mac-backup-readiness passed.
- npm run verify:admin-backup-prisma-model-archive-coverage passed.
- Restore preview passed.
- A non-production guarded restore drill was completed or intentionally scheduled.
