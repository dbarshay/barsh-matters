# Admin Users / Signer Profile Phase 3 — Primary Admin All-Permissions Guard

## Baseline

- Phase 2 lock: `admin-users-signer-profile-phase2-real-wiring-map-20260623`.
- Requirement: Dave/the primary admin should default to access to all permissions.
- Owner-admin/bootstrap behavior must preserve full permission access unless explicitly changed.

## Guard purpose

This phase locks an executable map and verifier around the owner-admin/default-admin permission model before additional signer/security mutations. The objective is to prevent later password, signer-profile, 2FA, lockout, or user-edit wiring from accidentally narrowing the primary admin account.

## Candidate permission files

- `app/court-calendar/page.tsx` — hits: 
- `app/admin/page.tsx` — hits: permissions
- `app/admin/permissions/page.tsx` — hits: owner_admin, permissions, adminpermission
- `app/admin/users/page.tsx` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/admin/audit-history/page.tsx` — hits: 
- `app/api/auth/login/route.ts` — hits: bootstrapSafe, bootstrap
- `app/api/auth/session/route.ts` — hits: permissions, adminpermission
- `app/api/graph/token-health/route.ts` — hits: permissions
- `app/api/admin/permissions/route.ts` — hits: permissions, adminpermission
- `app/api/admin/permissions/deployment-package/route.ts` — hits: permissions, adminpermission
- `app/api/admin/permissions/catalog/route.ts` — hits: permissions, adminpermission
- `app/api/admin/permissions/activation-status/route.ts` — hits: permissions, adminpermission
- `app/api/admin/permissions/role-matrix/route.ts` — hits: owner_admin, permissions, adminpermission
- `app/api/admin/permissions/check/route.ts` — hits: permissions, adminpermission
- `app/api/admin/users/remove-role/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/assign-role/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/planning/route.ts` — hits: permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap
- `app/api/admin/users/password-reset/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/create/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/permission-override/route.ts` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `app/api/admin/users/lockout/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `lib/adminPermissions.ts` — hits: permissions, adminpermission
- `lib/adminUsersWriteContracts.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `lib/adminUsersPlanning.ts` — hits: owner_admin, permissions, adminpermission, bootstrap
- `lib/adminAuth.ts` — hits: permissions
- `lib/admin-permissions/roleMatrix.ts` — hits: owner_admin, permissions, adminpermission
- `lib/admin-permissions/catalog.ts` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase4-route-map-readiness-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase3-create-user-ui-safety.mjs` — hits: owner_admin, permissions
- `scripts/verify-admin-permission-lockout-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-prod-auth-admin-smoke.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase7-completion-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-permissions-registry-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-user-role-seed-preview-safety.mjs` — hits: permissions, permissionRegistry
- `scripts/verify-admin-users-db-preview-readonly-safety.mjs` — hits: permissions, adminrolepermission
- `scripts/verify-admin-page-permission-enforcement-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-write-contract-preview-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase5-simulation-completion-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase6-audit-visibility-readiness-safety.mjs` — hits: permissions
- `scripts/verify-admin-users-phase7-activation-planning-readiness-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase3-completion-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-user-role-migration-sql-safety.mjs` — hits: adminrolepermission
- `scripts/verify-admin-permissions-matrix-coverage-safety.mjs` — hits: permissions, adminpermission, bootstrap
- `scripts/verify-admin-users-phase3-permission-override-ui-safety.mjs` — hits: owner_admin, permissions
- `scripts/verify-admin-users-phase5-enforcement-simulation-negative-path-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase3-assign-role-route-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-planning-readonly-safety.mjs` — hits: permissions, adminpermission
- `scripts/apply-admin-user-role-seed.mjs` — hits: owner_admin, permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap, permissionRegistry
- `scripts/verify-admin-permission-check-endpoint-enforcement-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-api-permission-enforcement-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase3-remove-role-ui-safety.mjs` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase6-completion-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-session-control-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-write-controls-preview-safety.mjs` — hits: permissions
- `scripts/verify-admin-users-phase7-no-lockout-smoke-plan-readiness-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase6-negative-path-diagnostics-readiness-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase3-permission-override-route-safety.mjs` — hits: owner_admin, permissions, adminpermission
- `scripts/preview-admin-user-role-seed.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap, permissionRegistry
- `scripts/verify-admin-users-phase3-create-user-route-safety.mjs` — hits: owner_admin, permissions, adminpermission
- `scripts/verify-admin-users-phase4-dry-run-decision-path-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-permissions-blocked-notice-safety.mjs` — hits: permissions
- `scripts/verify-admin-users-phase7-first-target-planning-readiness-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-templates-phase10-admin-exposure-readiness-plan.mjs` — hits: 
- `scripts/verify-admin-users-phase4-completion-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase5-permission-check-negative-path-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-permissions-enforcement-engine-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-permissions-readonly-page-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-signer-profile-phase2-real-wiring-map.mjs` — hits: permissions
- `scripts/verify-admin-user-role-schema-foundation-safety.mjs` — hits: permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase4-env-deployment-readiness-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase3-assign-role-ui-safety.mjs` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `scripts/verify-admin-permissions-dry-run-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase2-completion-safety.mjs` — hits: owner_admin, permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-user-role-seed-apply-guard-safety.mjs` — hits: permissions, adminrolepermission
- `scripts/verify-admin-permission-check-endpoint-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-permissions-enforcement-flag-preview-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-effective-permissions-readonly-safety.mjs` — hits: permissions
- `scripts/verify-admin-permissions-config-preview-safety.mjs` — hits: permissions, adminpermission
- `scripts/verify-admin-users-phase3-remove-role-route-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `prisma/schema.prisma` — hits: permissions, adminrolepermission, bootstrapSafe, bootstrap

## Candidate owner-admin / role seed files

- `app/admin/permissions/page.tsx` — hits: owner_admin, permissions, adminpermission
- `app/admin/users/page.tsx` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/permissions/role-matrix/route.ts` — hits: owner_admin, permissions, adminpermission
- `app/api/admin/users/remove-role/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/assign-role/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/planning/route.ts` — hits: permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap
- `app/api/admin/users/password-reset/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/create/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/permission-override/route.ts` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `app/api/admin/users/lockout/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `lib/adminUsersWriteContracts.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `lib/adminUsersPlanning.ts` — hits: owner_admin, permissions, adminpermission, bootstrap
- `lib/admin-permissions/roleMatrix.ts` — hits: owner_admin, permissions, adminpermission
- `scripts/verify-admin-users-phase3-create-user-ui-safety.mjs` — hits: owner_admin, permissions
- `scripts/verify-admin-users-db-preview-readonly-safety.mjs` — hits: permissions, adminrolepermission
- `scripts/verify-admin-users-write-contract-preview-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase7-activation-planning-readiness-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase3-completion-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-user-role-migration-sql-safety.mjs` — hits: adminrolepermission
- `scripts/verify-admin-users-phase3-permission-override-ui-safety.mjs` — hits: owner_admin, permissions
- `scripts/verify-admin-users-phase3-assign-role-route-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/apply-admin-user-role-seed.mjs` — hits: owner_admin, permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap, permissionRegistry
- `scripts/verify-admin-users-phase3-remove-role-ui-safety.mjs` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase6-negative-path-diagnostics-readiness-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase3-permission-override-route-safety.mjs` — hits: owner_admin, permissions, adminpermission
- `scripts/preview-admin-user-role-seed.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap, permissionRegistry
- `scripts/verify-admin-users-phase3-create-user-route-safety.mjs` — hits: owner_admin, permissions, adminpermission
- `scripts/verify-admin-user-role-schema-foundation-safety.mjs` — hits: permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase3-assign-role-ui-safety.mjs` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase2-completion-safety.mjs` — hits: owner_admin, permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-user-role-seed-apply-guard-safety.mjs` — hits: permissions, adminrolepermission
- `scripts/verify-admin-users-phase3-remove-role-route-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `prisma/schema.prisma` — hits: permissions, adminrolepermission, bootstrapSafe, bootstrap

## Candidate bootstrap files

- `app/admin/users/page.tsx` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/auth/login/route.ts` — hits: bootstrapSafe, bootstrap
- `app/api/admin/users/remove-role/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/assign-role/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/planning/route.ts` — hits: permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap
- `app/api/admin/users/password-reset/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/create/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `app/api/admin/users/permission-override/route.ts` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `app/api/admin/users/lockout/route.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `lib/adminUsersWriteContracts.ts` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `lib/adminUsersPlanning.ts` — hits: owner_admin, permissions, adminpermission, bootstrap
- `scripts/verify-admin-users-write-contract-preview-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase7-activation-planning-readiness-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase3-completion-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-permissions-matrix-coverage-safety.mjs` — hits: permissions, adminpermission, bootstrap
- `scripts/verify-admin-users-phase3-assign-role-route-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/apply-admin-user-role-seed.mjs` — hits: owner_admin, permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap, permissionRegistry
- `scripts/verify-admin-users-phase3-remove-role-ui-safety.mjs` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase6-negative-path-diagnostics-readiness-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `scripts/preview-admin-user-role-seed.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap, permissionRegistry
- `scripts/verify-admin-user-role-schema-foundation-safety.mjs` — hits: permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase3-assign-role-ui-safety.mjs` — hits: owner_admin, permissions, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase2-completion-safety.mjs` — hits: owner_admin, permissions, adminpermission, adminrolepermission, bootstrapSafe, bootstrap
- `scripts/verify-admin-users-phase3-remove-role-route-safety.mjs` — hits: owner_admin, permissions, adminpermission, bootstrapSafe, bootstrap
- `prisma/schema.prisma` — hits: permissions, adminrolepermission, bootstrapSafe, bootstrap

## Candidate permission keys

- `${file}\n${read(file)}`
- `${permission}`
- `${row.roleKey}:${row.permissionKey}`
- `);

assert(auditHistoryPage.includes(`
- `);

assert(permissionCheck.includes(`
- `);

assert(permissionsPage.includes(`
- `);

assert(usersPage.includes(`
- `);
assert(auditPage.includes(`
- `);
assert(permissionCheck.includes(`
- `);
assert(permissionsApi.includes(`
- `);
assert(permissionsPage.includes(`
- `);
assert(read(envDeploymentVerifierFile).includes(`
- `);
assert(read(files.phase4Completion).includes(`
- `);
assert(usersPage.includes(`
- `);
}

assert(read(envDeploymentVerifierFile).includes(`
- `);
}

assert(read(files.phase4Env).includes(`
- `--apply-admin-user-role-seed`
- `.audit`
- `.create(`
- `.createMany(`
- `.delete(`
- `.deleteMany(`
- `.update(`
- `.updateMany(`
- `ADMIN_PERMISSION_DEFINITIONS`
- `ADMIN_PERMISSION_KEYS`
- `ADMIN_PERMISSION_NEVER_BLOCK_PATTERNS`
- `ADMIN_ROLE_PLANNING_DEFINITIONS`
- `ADMIN_ROUTE_PERMISSIONS`
- `ADMIN_USER_PLANNING_ROWS`
- `Admin`
- `AdminPermissionDryRunDecision`
- `AdminPermissionEnforcementDecision`
- `AdminPermissionOverrideConfig`
- `AdminRole`
- `AdminRolePermission`
- `AdminRolePermission\`
- `AdminRolePermission_roleId_fkey`
- `AdminRolePermission_roleId_permissionKey_key`
- `AdminRole\`
- `AdminRole_key_key`
- `AdminUser`
- `AdminUser.passwordHash`
- `AdminUser.status`
- `AdminUserPermissionOverride`
- `AdminUserPermissionOverride.find`
- `AdminUserPermissionOverride_userId_fkey`
- `AdminUserPermissionOverride_userId_permissionKey_key`
- `AdminUserRole`
- `AdminUserRole\`
- `AdminUserRole_roleId_fkey`
- `AdminUserRole_userId_fkey`
- `AdminUserRole_userId_roleId_key`
- `AdminUser\`
- `AdminUser_email_key`
- `Administrator`
- `Audits`
- `BARSH_ADMIN_PERMISSIONS_ENFORCEMENT`
- `BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1`
- `BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED`
- `BARSH_ADMIN_PERMISSION_OVERRIDES_JSON`
- `Clients`
- `Court`
- `Created`
- `Created.`
- `DELETE`
- `DELETE\\\`
- `Documents`
- `Invoices`
- `Lawsuits`
- `Matters`
- `Permissions`
- `Permissions\`
- `UPDATE`
- `Updated`
- `User`
- `VALID_ADMIN_USER_STATUSES`
- `activeBootstrapOwnerAdminCount`
- `activeDbUsers`
- `admin`
- `admin-api-permission-blocked`
- `admin-apis`
- `admin-client-info`
- `admin-functions-only`
- `admin-page-permission-blocked\`
- `admin-pages`
- `admin-permission-check`
- `admin-permission-check-blocked`
- `admin-permissions-catalog`
- `admin-permissions-phase20-activation-status`
- `admin-permissions-phase21-deployment-package`
- `admin-permissions-read-only`
- `admin-permissions-role-matrix`
- `admin-proxy`
- `admin-user-assign-role`
- `admin-user-create`
- `admin-user-lock`
- `admin-user-lockout`
- `admin-user-management`
- `admin-user-password-reset`
- `admin-user-permission-override`
- `admin-user-remove-role`
- `admin-user-role-seed-apply`
- `admin-user-role-seed-preview`
- `admin-user-unlock`
- `admin-users-phase12j`
- `admin-users-phase12k`
- `admin-users-phase3`
- `admin-users-roles-planning-read-only`
- `admin-users-roles-planning-read-only\`
- `admin-users-signer-profile-phase1-security-repair-20260623`
- `admin-users-write-contract-preview`
- `admin.access`
- `admin.auditHistory.view`
- `admin.backups.restorePreview`
- `admin.backups.run`
- `admin.backups.view`
- `admin.claimIndex.audit`
- `admin.claimIndex.view`
- `admin.clients.edit`
- `admin.clients.view`
- `admin.documentReadiness.audit`
- `admin.documentTemplates.manage`
- `admin.documentTemplates.view`
- `admin.home.view`
- `admin.invoices.`
- `admin.invoices.create`
- `admin.invoices.finalize`
- `admin.invoices.view`
- `admin.invoices.view\`
- `admin.invoices.void`
- `admin.lawsuitCleanup.confirm`
- `admin.lawsuitCleanup.view`
- `admin.lawsuits.audit`
- `admin.permissions.manage`
- `admin.readiness.view`
- `admin.referenceData.import`
- `admin.referenceData.view`
- `admin.ticklers.run`
- `admin.ticklers.view`
- `admin.users.manage`
- `adminPermissionDryRunDecisions`
- `adminPermissionEnforcementDecision`
- `adminPermissionEnforcementDecision(`
- `adminPermissionForRoute`
- `adminRole.create`
- `adminRolePermission.find`
- `adminRoutePermissionDryRunDecisions`
- `adminUser.create`
- `adminUserPermissionOverride.create`
- `adminUserPermissionOverride.find`
- `adminUserRole.create`
- `adminUserRole.delete`
- `admin_user`
- `admin_user_permission_override`
- `admin_user_role`
- `administrative`
- `allAdminPermissionKeys`
- `apply:admin-user-role-seed`
- `assignPreviewReady`
- `audit-history`
- `barsh-admin-dev`
- `barsh-admin-dev-session`
- `barsh-admin-user-role-seed-${Date.now()}.sql`
- `barsh-matters-local`
- `barsh_admin_gate`
- `barsh_admin_identity`
- `billing_admin`
- `blockedPermissionLabel`
- `clearAdminGateCookie(response)`
- `clientName`
- `client_credentials`
- `configuredAdminPermissionOverridesFromEnv`
- `configuredAdminPermissionsEnforcementEnabled`
- `configuredAdminPermissionsEnforcementEnabled()`
- `court`
- `court-calendar`
- `court-calendar-read`
- `court-calendar-report`
- `court-calendar-write`
- `court-group\`
- `court-heading\`
- `courtCalendar.edit`
- `courtCalendar.view`
- `create-new-override`
- `create-preview`
- `createMatterAuditLogEntry`
- `createdAt`
- `data-barsh-admin-audit-history=`
- `data-barsh-admin-logout-button=\`
- `data-barsh-admin-permissions-blocked-notice=`
- `data-barsh-admin-permissions-blocked-notice=\`
- `data-barsh-admin-permissions-definitions=\`
- `data-barsh-admin-permissions-dry-run=\`
- `data-barsh-admin-permissions-override-config=\`
- `data-barsh-admin-permissions-page=\`
- `data-barsh-admin-permissions-route-map=\`
- `data-barsh-admin-permissions-summary=\`
- `data-barsh-admin-session-control=\`
- `data-barsh-admin-session-status=\`
- `data-barsh-admin-users-assign-actor-email=`
- `data-barsh-admin-users-assign-role-control=`
- `data-barsh-admin-users-assign-role-key=`
- `data-barsh-admin-users-assign-target-email=`
- `data-barsh-admin-users-audit-history-focus=`
- `data-barsh-admin-users-audit-history-link=`
- `data-barsh-admin-users-audit-visibility=`
- `data-barsh-admin-users-create-user-control=`
- `data-barsh-admin-users-db-preview=`
- `data-barsh-admin-users-effective-permissions=`
- `data-barsh-admin-users-enforcement-banner=`
- `data-barsh-admin-users-override-action=`
- `data-barsh-admin-users-override-actor-email=`
- `data-barsh-admin-users-override-permission-key=`
- `data-barsh-admin-users-override-reason=`
- `data-barsh-admin-users-override-target-email=`
- `data-barsh-admin-users-permission-override-control=`
- `data-barsh-admin-users-planning-page=`
- `data-barsh-admin-users-planning-page=\`
- `data-barsh-admin-users-planning-roles=\`
- `data-barsh-admin-users-planning-summary=\`
- `data-barsh-admin-users-planning-users=\`
- `data-barsh-admin-users-remove-actor-email=`
- `data-barsh-admin-users-remove-role-control=`
- `data-barsh-admin-users-remove-role-key=`
- `data-barsh-admin-users-remove-target-email=`
- `data-barsh-admin-users-write-controls-preview=`
- `data-barsh-court-calendar-results-table=`
- `data-barsh-court-calendar-search-text-filter=`
- `date-write-line\`
- `dedicated-court-calendar-page-create`
- `default-admin-allow-all`
- `default-admin-allow-all\`
- `defaultAdminPermissionAllowed`
- `direct-payment-post`
- `direct-payment-void`
- `document-finalize`
- `document-generate`
- `document-read`
- `documents.finalize`

## Required guardrails for the next implementation phase

1. `owner_admin` must represent all permissions or must be assigned every registered permission.
2. Dave/the primary admin bootstrap/default account must receive `owner_admin` or equivalent all-permissions access.
3. No signer-profile, password, 2FA, lockout, or inactive-user wiring may reduce the primary admin below all-permissions access unless explicitly changed by an owner-admin action.
4. Stale exact-fragment verifiers must not block this phase; use semantic checks against the current registry/seed surfaces.
5. Do not change DOCX templates.
6. Do not wire production document-generation signer validation.

