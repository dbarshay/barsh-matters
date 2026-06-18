# Admin Users Phase 22 Final Activation Package

Generated: 2026-06-18T20:23:49.688Z

## Scope

admin-functions-only

## Activation environment

```json
{
  "BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED": "true",
  "BARSH_ADMIN_PERMISSION_OVERRIDES_JSON": "{\"block\":[\"admin.users.manage\",\"admin.lawsuitCleanup.confirm\",\"admin.ticklers.run\",\"admin.clients.edit\",\"admin.invoices.create\",\"admin.invoices.finalize\",\"admin.invoices.void\",\"admin.referenceData.import\",\"admin.documentTemplates.manage\",\"admin.backups.run\",\"admin.backups.restorePreview\"],\"allow\":[\"admin.home.view\"]}"
}
```

## Rollback environment

```json
{
  "BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED": "false"
}
```

## Required smoke proof after manual env activation

1. owner_admin can access /admin.
2. owner_admin can access /admin/permissions.
3. read_only_admin/Jane Doe is blocked from administrator functions.
4. read_only_admin/Jane Doe retains intended non-admin operational access.
5. rollback env is available and can be applied immediately if any smoke fails.

## Forbidden

- No password visibility.
- No impersonation or access-as.
- No app-side self-activation.
- No mutation of users, roles, overrides, sessions, Clio, documents, email, or print queue from this package.
