# Barsh Matters Removable Disk / Time Machine Backup Checklist

## Purpose

Dropbox protects against loss of the local machine, but the dedicated Mac also needs a local/removable disk backup. This protects machine-specific configuration, local backup folders, logs, and secrets that are intentionally not committed to Git.

## Required disk backup scope

The disk backup should include:

- The Barsh Matters repo folder.
- The local backups/indexes folder.
- backups/indexes/CLOUD_TARGET.txt.
- backups/indexes/LATEST_BACKUP.txt.
- backups/indexes/logs.
- backups/indexes/backup-alert-state.json.
- .env or .env.local, if stored in or near the repo.
- Any external secure location used for Barsh Matters secrets.
- LaunchAgent plist files used for scheduled backups.
- Any machine-local setup notes.

## Time Machine setup checklist

1. Attach the removable disk or configure the Time Machine network target.
2. Confirm the Barsh Matters repo folder is not excluded.
3. Confirm hidden files and environment files are included if they are stored inside the repo folder.
4. Confirm Dropbox local sync folder is not the only backup location.
5. Run a first Time Machine backup.
6. Confirm the backup completed.
7. Browse the Time Machine backup and confirm the repo folder is visible.
8. Confirm backups/indexes is visible.
9. Confirm at least one timestamped backup folder is visible.
10. Confirm .env/.env.local location is recoverable through the chosen secure backup method.

## Monthly check

At least monthly, confirm:

- Time Machine or removable disk backup is current.
- Dropbox backup mirror is current.
- Admin Backup / Restore shows a recent latest backup.
- npm run verify:dedicated-mac-backup-readiness passes on the dedicated Mac.
- npm run verify:dropbox-backup-mirror-safety passes on the dedicated Mac.

## Restore note

The removable disk backup is not a replacement for the PostgreSQL restore drill. It protects local files and machine-specific configuration. PostgreSQL database recovery still uses the guarded restore workflow.
