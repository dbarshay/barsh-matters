# Admin Users / Signer Profile Phase 11 — Dedicated Signer-Profile Update Route

## Baseline

- Phase 10 lock: `admin-users-phase10-create-user-api-signer-profile-wiring-20260623`.
- Runtime mutation: `true`.
- New route: `app/api/admin/users/signer-profile/route.ts`.

## Scope

- Adds a dedicated PATCH route for signer/contact/status/2FA profile fields.
- Does not use lockout, password, assign-role, remove-role, or permission-override routes for signer-profile edits.
- Requires an active `owner_admin` actor.
- Supports preview mode unless `apply` is true.
- Uses the Phase 7 payload normalization contract.
- Preserves Phase 5 owner-admin all-permissions behavior.
- Does not wire production document-generation signer validation.
- Does not change DOCX templates.

## Fields

- firstName
- lastName
- displayName
- username
- email / emailNormalized
- usernameNormalized
- phoneExtension
- faxNumber
- signatureBlockName
- locked
- inactive
- twoFactorPhone
- twoFactorDisabled
- twoFactorPendingSetup

