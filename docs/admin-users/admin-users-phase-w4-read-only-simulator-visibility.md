# Admin Users Phase W4 - Read-Only Simulator Visibility

Status: UI visibility only.

This phase surfaces the Phase W3 dry-run simulator summary on `/admin/users`.

No runtime enforcement is enabled.
No UI hiding is enabled.
No backend route blocking is enabled.
No database changes are made.

The visible summary is a planning aid only:
- Owner: 201 allowed, 0 blocked
- Administrator: 166 allowed, 35 blocked
- Full User: 134 allowed, 67 blocked
- Basic User: 110 allowed, 91 blocked
- View Only: 35 allowed, 166 blocked

Next phase should decide whether to refine the route/action classification before any UI hiding or enforcement work.
