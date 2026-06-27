# Admin Users Phase V3 - Final Role DB Seed Update

Status: guarded DB seed update phase.

This phase creates or updates the five final AdminRole records:
Owner owner_admin
Administrator administrator
Full User full_user
Basic User basic_user
View Only view_only

Safety decisions:
owner_admin remains the internal Owner key.
Existing legacy role records operations_admin, billing_admin, and read_only_admin are preserved.
No users are created or deleted.
No user role assignments are changed.
Runtime permission enforcement is not enabled.
Session behavior is not changed.
2FA behavior is not changed.
Passwords are not changed.

Preview command:
node scripts/apply-admin-users-phase-v3-final-role-db-seed.mjs

Apply command:
node scripts/apply-admin-users-phase-v3-final-role-db-seed.mjs --apply-admin-users-phase-v3-final-role-db-seed

Next phase: add Administrator card-grant persistence and read model without enabling runtime enforcement.
