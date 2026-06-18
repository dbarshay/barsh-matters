# Admin Users Phase 15E Static Role Permission Matrix

Date: 2026-06-18

## Scope

Phase 15E adds a planning-only static role permission matrix for `owner_admin` and `read_only_admin`.

## Hard Safety Rule

Phase 15E must not broaden runtime enforcement.

Current locked runtime behavior remains:

- Owner/admin may access administrator pages and administrator APIs.
- Jane Doe / read_only_admin may access regular non-admin application routes.
- Jane Doe / read_only_admin is blocked from administrator pages and administrator APIs.
- Enforcement scope remains admin-functions-only.
- No password viewing.
- No impersonation.

## Added Files

- `lib/admin-permissions/roleMatrix.ts`
- `app/api/admin/permissions/role-matrix/route.ts`

## UI Change

`/admin/permissions` now fetches and displays `/api/admin/permissions/role-matrix`.

The role matrix is planning-only and read-only.

## Enforcement

No new non-admin route is blocked in Phase 15E.

The role matrix does not change role assignments, user overrides, enforcement flags, passwords, sessions, or authorization runtime.
