# Admin Users / Signer Profile Phase 14 — Password Reset Generated Temporary Password Alignment

## Baseline

- Phase 13 lock: `admin-users-phase13-password-reset-route-safety-20260623`.
- Runtime mutation: `true`.
- Route: `app/api/admin/users/password-reset/route.ts`.

## Scope

- Server generates the temporary password.
- Temporary password is returned only on apply, exactly once.
- Password hash is stored; plaintext password is never stored.
- Password history is updated and last-3 reuse is checked.
- Forced password change is set through `forcePasswordChange` and existing `passwordChangeRequired`.
- Failed-login count and lockout are reset as part of password reset.
- Audit log records password reset without storing the temporary password.
- Owner-admin actor gate remains required.
- Does not change signer-profile edit route.
- Does not wire production document-generation signer validation.
- Does not change DOCX templates.

