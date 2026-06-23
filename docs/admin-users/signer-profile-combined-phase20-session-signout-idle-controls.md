# Admin Users / Signer Profile Combined Phase 20 — Session, Signout, and Idle Timeout Runtime Controls

## Baseline

- Combined Phase 19 lock: `admin-users-combined-phase19-password-auth-runtime-foundation-20260623`.
- Runtime mutation: `true`.

## Runtime additions

- Added session runtime helper: `src/lib/auth/admin-user-session-runtime-phase20.ts`.
- Added signout route: `app/api/auth/signout/route.ts`.
- Added Stay Signed In route: `app/api/auth/stay-signed-in/route.ts`.
- Added admin-page session timeout modal contract anchors.

## Locked behavior

- Sign Out clears admin session cookie candidates and updates `lastSignOutAt` / `sessionInvalidatedAt` when email is supplied.
- Stay Signed In extends the active session without requiring password or 2FA.
- Idle timeout warning labels are `Stay Signed In` and `Sign Out Now`.
- Modal contract follows standard Barsh Matters popup expectations: navy header, centered title, no X button, explicit actions.

## Safety limits

- Does not change password reset generated temporary password behavior.
- Does not change signer-profile route.
- Does not change 2FA behavior.
- Does not change document-generation behavior.
- Does not change DOCX templates.

