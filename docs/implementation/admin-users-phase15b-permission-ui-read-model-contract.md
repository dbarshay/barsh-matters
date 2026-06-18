# Admin Users Phase 15B Permission UI Read-Model Contract

Date: 2026-06-18

## Scope

Phase 15B defines the planned permission UI/read-model for `/admin/permissions`.

This phase is still contract-only unless a later phase explicitly changes runtime behavior.

## Hard Safety Rule

Phase 15B must not broaden runtime enforcement.

Current locked runtime behavior remains:

- Owner/admin may access administrator pages and administrator APIs.
- Jane Doe / read_only_admin may access regular non-admin application routes.
- Jane Doe / read_only_admin is blocked from administrator pages and administrator APIs.
- Enforcement scope remains admin-functions-only.
- No password viewing.
- No impersonation.

## Intended `/admin/permissions` Read Model

The permissions page should eventually display three layers:

1. Permission catalog.
2. Role permission matrix.
3. User-specific override matrix.

## Permission Catalog Display

Each permission key should display:

- Permission key.
- Group.
- Label.
- Description.
- Route/function scope.
- Enforcement status.
- Risk level.

Initial groups:

- Administrator.
- Matters.
- Lawsuits.
- Documents.
- Settlements.
- Court Calendar.
- Print Queue.
- Claim Index / Search.

Enforcement statuses:

- enforced-currently.
- planned-not-enforced.
- never-block.

Risk levels:

- view.
- edit.
- financial.
- destructive.
- administrative.

## Role Matrix Display

The role matrix should show rows for roles and columns for permission keys.

Initial roles:

- owner_admin.
- read_only_admin.

Each role/permission cell should display one of:

- allow.
- block.
- inherited.
- not-configured.

Phase 15B does not change role assignments or runtime access.

## User Override Matrix Display

The user override matrix should show user-specific allow/block overrides.

Fields:

- User.
- Role keys.
- Permission key.
- Override value.
- Reason.
- Updated by.
- Updated at.

Override values:

- allow.
- block.
- none.

Phase 15B does not activate override enforcement.

## Proposed Jane Doe Read-Only Matrix For Later Phase

Jane Doe / read_only_admin planned baseline:

Allowed view permissions:

- matters.view.
- lawsuits.view.
- documents.view.
- settlements.view.
- courtCalendar.view.
- printQueue.view.
- claimIndex.search.

Blocked action permissions:

- admin.access.
- admin.users.manage.
- admin.permissions.manage.
- matters.edit.
- matters.close.
- matters.payments.post.
- matters.payments.void.
- lawsuits.create.
- lawsuits.edit.
- lawsuits.close.
- lawsuits.payments.post.
- lawsuits.payments.void.
- documents.generate.
- documents.finalize.
- documents.printQueue.manage.
- settlements.edit.
- settlements.close.
- settlements.void.
- courtCalendar.edit.
- printQueue.manage.
- claimIndex.rebuild.

## UI Safety Requirements

The UI must not expose password hashes, password reset secrets, temporary passwords, or session cookie contents.

The UI must not include impersonation.

Any later editing UI must be owner_admin-only.

Any later permission changes must be audit logged.

## Phase 15B Completion Criteria

Phase 15B is complete only if:

- This read-model contract exists.
- A verifier confirms key read-model markers.
- Existing Phase 13C/14A/14B/15A verifiers still pass.
- Full build passes.
- Runtime behavior is not changed.
