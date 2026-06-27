# Admin Users Phase W1 - Final Role Permission Coverage Map

Status: planning and contract only.

This phase defines how the final five roles should map to non-admin app areas, payment-sensitive areas, read/write operations, and selected Admin-card access.

No runtime enforcement is enabled.
No UI hiding is enabled.
No backend route blocking is enabled.
No user or role data is mutated.

## Roles

Owner:
Everything. Full non-admin access, all Admin cards, payment functions, user/security controls, and owner no-lockout protection.

Administrator:
Everything outside Admin. Admin access is limited to selected Admin-card grants.

Full User:
Full non-admin app access, including payment functions. No Admin screen.

Basic User:
Full non-admin app access except payment, billing, invoice, and settlement-payment functions. No Admin screen.

View Only:
Can view non-admin screens only. No create, edit, delete, upload, finalize, payment, or Admin actions.

## Area coverage

W1 defines app areas and whether each area is admin-only or payment-sensitive.

Payment-sensitive areas:
- Client Billing / Payments
- Settlement Payment Status

Admin-only areas:
- Admin Screen
- Admin Cards

## Next phase

Phase W2 should classify actual pages, API routes, and server actions into:
- view
- search
- create
- edit
- delete/archive
- generate/finalize/upload
- payment/billing
- admin-card

W2 should still not enforce blocking.
