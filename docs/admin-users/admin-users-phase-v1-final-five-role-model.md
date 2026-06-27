# Admin Users Phase V1 — Final Five-Role Model Contract

## Status

Planning/contract only. This phase does not enable runtime permission enforcement, does not migrate existing users, does not remove existing seeded roles, does not alter sessions, and does not change access behavior.

## Final roles

| Label | Internal key | Access |
|---|---|---|
| Owner | `owner_admin` | Everything. Full application access, all Admin cards, user/role/password/security controls, and owner no-lockout protection. |
| Administrator | `administrator` | Full non-admin app access. Admin access is selected card-by-card. |
| Full User | `full_user` | Full non-admin app access, including payment functions. No Admin screen. |
| Basic User | `basic_user` | Full non-admin app access except payment/billing/payment-status functions. No Admin screen. |
| View Only | `view_only` | View all non-admin screens, but cannot mutate anything. No Admin screen. |

## Owner compatibility decision

The Owner role keeps the internal key `owner_admin` because existing bootstrap and no-lockout safety code already depends on that key. The visible label becomes Owner.

## Administrator card-by-card model

Administrator is not a single broad Admin grant. An Administrator receives all non-admin functionality and then receives explicit Admin-card grants. The first planned Admin cards are:

- Users & Roles
- Permissions Review
- Audit History
- Document Templates
- Reference Data
- Claim Index
- Ticklers
- Clients / Billing
- Backup / Restore
- Readiness Dashboard
- Document Readiness
- Lawsuit Cleanup

Sensitive cards such as Users & Roles, Permissions Review, and Backup / Restore remain owner-only by recommendation unless explicitly granted later.

## Payment function model

Payment-related functionality is separated from normal non-admin access so Basic User and View Only can be enforced cleanly later.

Payment permission families planned in this contract:

- `payments.view`
- `payments.manage`
- `invoices.view`
- `invoices.create`
- `invoices.finalize`
- `invoices.void`
- `settlements.paymentStatus.manage`
- `settlements.paymentStatus.view`

## Non-activation guarantees

Phase V1 must preserve all of the following:

- `/api/auth/session` remains in the existing default/non-enforcing mode.
- Existing admin bootstrap/no-lockout behavior remains intact.
- Existing 2FA setup verification remains intact.
- Existing seeded roles may remain in the database until a later migration/seed phase.
- No runtime user access changes occur in this phase.

## Next phases

Phase V2 should expose Administrator Admin-card grants in the Users UI.

Phase V3 should update the DB seed/migration path for the final five roles and selected card grants.

Phase V4 should add read/write/payment/non-admin route coverage.

Phase V5 should activate enforcement only after owner no-lockout, 2FA, and rollback smoke tests pass.
