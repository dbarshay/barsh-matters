# Admin Users Phase W3 - Dry-Run Permission Simulator

Status: dry-run simulator only.

No runtime enforcement is enabled.
No UI hiding is enabled.
No backend route blocking is enabled.
No database changes are made.

Based on W2 classification: admin-users-phase-w2-route-action-classification
Classified files evaluated: 201
Simulated actors: 5
Dry-run results: 1005

## Actor summaries

| Actor | Roles | Allowed | Blocked | Blocked Admin | Blocked Payment | Blocked Mutation |
|---|---:|---:|---:|---:|---:|---:|
| Owner Baseline | owner_admin | 201 | 0 | 0 | 0 | 0 |
| Administrator Selected Admin Cards | administrator | 166 | 35 | 35 | 0 | 35 |
| Full User Baseline | full_user | 134 | 67 | 67 | 16 | 67 |
| Basic User Baseline | basic_user | 110 | 91 | 67 | 23 | 91 |
| View Only Baseline | view_only | 35 | 166 | 67 | 23 | 166 |

## Expected dry-run behavior

- Owner allows every classified route/action.
- Administrator allows non-admin routes and only selected Admin-card routes.
- Full User allows non-admin routes, including payment-sensitive routes, and blocks Admin-only routes.
- Basic User allows non-admin, non-payment routes and blocks Admin/payment-sensitive routes.
- View Only allows non-admin view/search-style routes and blocks mutations, payment-sensitive routes, and Admin-only routes.

## Next phase

Phase W4 should expose this simulator in Admin Users or a read-only admin planning view. It should still not enforce blocks.
