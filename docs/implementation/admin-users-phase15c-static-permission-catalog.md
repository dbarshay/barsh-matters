# Admin Users Phase 15C Static Permission Catalog

Date: 2026-06-18

## Scope

Phase 15C adds a static permission catalog and a read-only administrator API endpoint.

## Hard Safety Rule

Phase 15C must not broaden runtime enforcement.

Current locked runtime behavior remains:

- Owner/admin may access administrator pages and administrator APIs.
- Jane Doe / read_only_admin may access regular non-admin application routes.
- Jane Doe / read_only_admin is blocked from administrator pages and administrator APIs.
- Enforcement scope remains admin-functions-only.
- No password viewing.
- No impersonation.

## Added Files

- `lib/admin-permissions/catalog.ts`
- `app/api/admin/permissions/catalog/route.ts`

## API

`GET /api/admin/permissions/catalog`

The endpoint returns:

- `ok`
- `action`
- `phase`
- `enforcementScope`
- `runtimeEnforcementChanged`
- `catalogCount`
- `groups`
- `catalog`

This endpoint is under `/api/admin/*`, so the existing Phase 14 admin-function block applies.

## Enforcement

No new non-admin route is blocked in Phase 15C.

The catalog is read-only metadata for later permission UI and later explicit enforcement phases.
