export type AdminPermissionKey =
  | "admin.home.view"
  | "admin.readiness.view"
  | "admin.claimIndex.view"
  | "admin.claimIndex.audit"
  | "admin.lawsuits.audit"
  | "admin.documentReadiness.audit"
  | "admin.lawsuitCleanup.view"
  | "admin.lawsuitCleanup.confirm"
  | "admin.ticklers.view"
  | "admin.ticklers.run"
  | "admin.clients.view"
  | "admin.clients.edit"
  | "admin.invoices.view"
  | "admin.invoices.create"
  | "admin.invoices.finalize"
  | "admin.invoices.void"
  | "admin.referenceData.view"
  | "admin.referenceData.import"
  | "admin.auditHistory.view"
  | "admin.documentTemplates.view"
  | "admin.documentTemplates.manage"
  | "admin.backups.view"
  | "admin.backups.run"
  | "admin.backups.restorePreview";

export type AdminPermissionCategory =
  | "Admin"
  | "Audits"
  | "Clients"
  | "Invoicing"
  | "Reference Data"
  | "Documents"
  | "Ticklers"
  | "Backups"
  | "Cleanup";

export type AdminPermissionDefinition = {
  key: AdminPermissionKey;
  label: string;
  description: string;
  category: AdminPermissionCategory;
  defaultAdminAllowed: true;
};

export type AdminRoutePermission = {
  pattern: string;
  permission: AdminPermissionKey;
  accessType: "page" | "api" | "function";
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "ANY";
  enforcementPlanned: boolean;
};

export const ADMIN_PERMISSION_DEFINITIONS: AdminPermissionDefinition[] = [
  { key: "admin.home.view", label: "Admin Home", description: "Open the Administrator landing page.", category: "Admin", defaultAdminAllowed: true },
  { key: "admin.readiness.view", label: "Readiness Dashboard", description: "View readiness dashboard and linked audit status.", category: "Audits", defaultAdminAllowed: true },
  { key: "admin.claimIndex.view", label: "ClaimIndex Viewer", description: "View and search the local ClaimIndex admin viewer.", category: "Audits", defaultAdminAllowed: true },
  { key: "admin.claimIndex.audit", label: "ClaimIndex Audit", description: "Run or view ClaimIndex audit results.", category: "Audits", defaultAdminAllowed: true },
  { key: "admin.lawsuits.audit", label: "Lawsuit/Master Audit", description: "Run or view local lawsuit and master audit results.", category: "Audits", defaultAdminAllowed: true },
  { key: "admin.documentReadiness.audit", label: "Document Readiness Audit", description: "Run or view document readiness audit results.", category: "Audits", defaultAdminAllowed: true },
  { key: "admin.lawsuitCleanup.view", label: "Lawsuit Cleanup Preview", description: "Open and preview lawsuit cleanup and deaggregation diagnostics.", category: "Cleanup", defaultAdminAllowed: true },
  { key: "admin.lawsuitCleanup.confirm", label: "Lawsuit Cleanup Confirm", description: "Confirm lawsuit cleanup or deaggregation operations.", category: "Cleanup", defaultAdminAllowed: true },
  { key: "admin.ticklers.view", label: "Ticklers", description: "View and search admin ticklers.", category: "Ticklers", defaultAdminAllowed: true },
  { key: "admin.ticklers.run", label: "Tickler Runner", description: "Run bulk tickler completion workflows.", category: "Ticklers", defaultAdminAllowed: true },
  { key: "admin.clients.view", label: "Clients", description: "View client/provider records and child-matter reporting screens.", category: "Clients", defaultAdminAllowed: true },
  { key: "admin.clients.edit", label: "Edit Clients", description: "Edit local client/provider information.", category: "Clients", defaultAdminAllowed: true },
  { key: "admin.invoices.view", label: "Invoices", description: "View invoice previews, history, and cost ledgers.", category: "Invoicing", defaultAdminAllowed: true },
  { key: "admin.invoices.create", label: "Create Draft Invoices", description: "Create draft provider/client invoices.", category: "Invoicing", defaultAdminAllowed: true },
  { key: "admin.invoices.finalize", label: "Finalize Invoices", description: "Finalize provider/client invoices.", category: "Invoicing", defaultAdminAllowed: true },
  { key: "admin.invoices.void", label: "Void Invoices", description: "Void finalized provider/client invoices.", category: "Invoicing", defaultAdminAllowed: true },
  { key: "admin.referenceData.view", label: "Reference Data", description: "View reference data import, history, status, and cleanup screens.", category: "Reference Data", defaultAdminAllowed: true },
  { key: "admin.referenceData.import", label: "Import Reference Data", description: "Preview, confirm, or clean up reference data imports.", category: "Reference Data", defaultAdminAllowed: true },
  { key: "admin.auditHistory.view", label: "Audit History", description: "View local audit and history entries.", category: "Audits", defaultAdminAllowed: true },
  { key: "admin.documentTemplates.view", label: "Document Templates", description: "View document template repository records.", category: "Documents", defaultAdminAllowed: true },
  { key: "admin.documentTemplates.manage", label: "Manage Document Templates", description: "Import, replace, or manage document templates.", category: "Documents", defaultAdminAllowed: true },
  { key: "admin.backups.view", label: "Backup/Restore", description: "View backup status, backup history, and restore preview screens.", category: "Backups", defaultAdminAllowed: true },
  { key: "admin.backups.run", label: "Run Backups", description: "Run manual backup and archive-error-log actions.", category: "Backups", defaultAdminAllowed: true },
  { key: "admin.backups.restorePreview", label: "Restore Preview", description: "Run restore preview diagnostics without restoring production data.", category: "Backups", defaultAdminAllowed: true },
];

export const ADMIN_ROUTE_PERMISSIONS: AdminRoutePermission[] = [
  { pattern: "/admin", permission: "admin.home.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/readiness-dashboard", permission: "admin.readiness.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/claim-index", permission: "admin.claimIndex.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/claim-index/audit", permission: "admin.claimIndex.audit", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/lawsuits/audit", permission: "admin.lawsuits.audit", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/document-readiness/audit", permission: "admin.documentReadiness.audit", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/lawsuit-cleanup", permission: "admin.lawsuitCleanup.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/ticklers", permission: "admin.ticklers.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/ticklers/runner", permission: "admin.ticklers.run", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/clients", permission: "admin.clients.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/clients/:id", permission: "admin.clients.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/clients/:id/invoice", permission: "admin.invoices.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/clients/:id/invoice/client-costs-ledger", permission: "admin.invoices.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/clients/:id/invoice/history", permission: "admin.invoices.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/invoices", permission: "admin.invoices.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/permissions", permission: "admin.home.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/reference-data", permission: "admin.referenceData.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/audit-history", permission: "admin.auditHistory.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/document-templates", permission: "admin.documentTemplates.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/document-templates/:key", permission: "admin.documentTemplates.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/admin/backup-restore", permission: "admin.backups.view", accessType: "page", enforcementPlanned: false },
  { pattern: "/api/admin/permissions", permission: "admin.home.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/claim-index/search", permission: "admin.claimIndex.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/claim-index/audit", permission: "admin.claimIndex.audit", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/lawsuits/audit", permission: "admin.lawsuits.audit", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/document-readiness/audit", permission: "admin.documentReadiness.audit", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/lawsuits/cleanup-preview", permission: "admin.lawsuitCleanup.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/lawsuits/cleanup-confirm", permission: "admin.lawsuitCleanup.confirm", accessType: "api", method: "POST", enforcementPlanned: false },
  { pattern: "/api/admin/ticklers/search", permission: "admin.ticklers.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/ticklers/duplicates", permission: "admin.ticklers.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/ticklers/duplicates/cleanup-preview", permission: "admin.ticklers.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/ticklers/run", permission: "admin.ticklers.run", accessType: "api", method: "POST", enforcementPlanned: false },
  { pattern: "/api/admin/clients", permission: "admin.clients.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/clients/:id", permission: "admin.clients.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/clients/:id", permission: "admin.clients.edit", accessType: "api", method: "PATCH", enforcementPlanned: false },
  { pattern: "/api/admin/clients/:id/invoice", permission: "admin.invoices.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/clients/:id/invoice/cost-ledger", permission: "admin.invoices.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/clients/:id/invoice/create-preview", permission: "admin.invoices.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/clients/:id/invoice/create", permission: "admin.invoices.create", accessType: "api", method: "POST", enforcementPlanned: false },
  { pattern: "/api/admin/clients/:id/invoice/:invoiceId/finalize", permission: "admin.invoices.finalize", accessType: "api", method: "POST", enforcementPlanned: false },
  { pattern: "/api/admin/clients/:id/invoice/:invoiceId/void", permission: "admin.invoices.void", accessType: "api", method: "POST", enforcementPlanned: false },
  { pattern: "/api/admin/invoices", permission: "admin.invoices.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/email-automation-status", permission: "admin.referenceData.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/backups/status", permission: "admin.backups.view", accessType: "api", method: "GET", enforcementPlanned: false },
  { pattern: "/api/admin/backups/run", permission: "admin.backups.run", accessType: "api", method: "POST", enforcementPlanned: false },
  { pattern: "/api/admin/backups/archive-error-log", permission: "admin.backups.run", accessType: "api", method: "POST", enforcementPlanned: false },
  { pattern: "/api/admin/backups/restore-preview", permission: "admin.backups.restorePreview", accessType: "api", method: "POST", enforcementPlanned: false },
];

export function allAdminPermissionKeys(): AdminPermissionKey[] {
  return ADMIN_PERMISSION_DEFINITIONS.map((permission) => permission.key);
}

export function isKnownAdminPermissionKey(value: string): value is AdminPermissionKey {
  return allAdminPermissionKeys().includes(value as AdminPermissionKey);
}

export function defaultAdminPermissionAllowed(permission: AdminPermissionKey): boolean {
  return isKnownAdminPermissionKey(permission);
}

export function adminPermissionForRoute(pathname: string, method = "GET"): AdminRoutePermission | null {
  const normalizedMethod = method.toUpperCase();
  return ADMIN_ROUTE_PERMISSIONS.find((entry) => {
    if (entry.method && entry.method !== "ANY" && entry.method !== normalizedMethod) return false;
    if (entry.pattern === pathname) return true;
    const patternParts = entry.pattern.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);
    if (patternParts.length !== pathParts.length) return false;
    return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
  }) || null;
}


export type AdminPermissionOverrideAction = "allow" | "block";

export type AdminPermissionOverride = {
  permission: AdminPermissionKey;
  action: AdminPermissionOverrideAction;
  source: "env";
};

export type AdminPermissionOverrideConfig = {
  ok: boolean;
  source: "BARSH_ADMIN_PERMISSION_OVERRIDES_JSON";
  enforcementEnabled: false;
  overrides: AdminPermissionOverride[];
  errors: string[];
};

function permissionOverrideEntriesFromArray(value: unknown, action: AdminPermissionOverrideAction, errors: string[]): AdminPermissionOverride[] {
  if (!Array.isArray(value)) return [];
  const overrides: AdminPermissionOverride[] = [];
  for (const item of value) {
    const permission = String(item ?? "").trim();
    if (!permission) continue;
    if (!isKnownAdminPermissionKey(permission)) {
      errors.push(`Unknown admin permission override ignored: ${permission}`);
      continue;
    }
    overrides.push({ permission, action, source: "env" });
  }
  return overrides;
}

export function configuredAdminPermissionOverridesFromEnv(): AdminPermissionOverrideConfig {
  const raw = String(process.env.BARSH_ADMIN_PERMISSION_OVERRIDES_JSON ?? "").trim();
  const errors: string[] = [];
  if (!raw) {
    return { ok: true, source: "BARSH_ADMIN_PERMISSION_OVERRIDES_JSON", enforcementEnabled: false, overrides: [], errors };
  }
  try {
    const parsed = JSON.parse(raw);
    const allow = permissionOverrideEntriesFromArray(parsed?.allow, "allow", errors);
    const block = permissionOverrideEntriesFromArray(parsed?.block, "block", errors);
    return { ok: errors.length === 0, source: "BARSH_ADMIN_PERMISSION_OVERRIDES_JSON", enforcementEnabled: false, overrides: [...allow, ...block], errors };
  } catch (error: any) {
    return { ok: false, source: "BARSH_ADMIN_PERMISSION_OVERRIDES_JSON", enforcementEnabled: false, overrides: [], errors: [error?.message || "Invalid permission override JSON."] };
  }
}


export type AdminPermissionDryRunDecision = {
  permission: AdminPermissionKey;
  defaultAllowed: boolean;
  overrideAction: AdminPermissionOverrideAction | null;
  wouldAllow: boolean;
  wouldBlock: boolean;
  enforcementEnabled: false;
};

export type AdminRoutePermissionDryRunDecision = AdminPermissionDryRunDecision & {
  pattern: string;
  method: string;
  accessType: AdminRoutePermission["accessType"];
};

export function adminPermissionDryRunDecisions(overrides = configuredAdminPermissionOverridesFromEnv()): AdminPermissionDryRunDecision[] {
  const overrideMap = new Map<AdminPermissionKey, AdminPermissionOverrideAction>();
  for (const override of overrides.overrides) overrideMap.set(override.permission, override.action);
  return ADMIN_PERMISSION_DEFINITIONS.map((definition) => {
    const overrideAction = overrideMap.get(definition.key) || null;
    const defaultAllowed = defaultAdminPermissionAllowed(definition.key);
    const wouldAllow = overrideAction === "allow" ? true : overrideAction === "block" ? false : defaultAllowed;
    return { permission: definition.key, defaultAllowed, overrideAction, wouldAllow, wouldBlock: !wouldAllow, enforcementEnabled: false };
  });
}

export function adminRoutePermissionDryRunDecisions(overrides = configuredAdminPermissionOverridesFromEnv()): AdminRoutePermissionDryRunDecision[] {
  const decisionMap = new Map(adminPermissionDryRunDecisions(overrides).map((decision) => [decision.permission, decision]));
  return ADMIN_ROUTE_PERMISSIONS.map((route) => {
    const decision = decisionMap.get(route.permission);
    return {
      permission: route.permission,
      pattern: route.pattern,
      method: route.method || "ANY",
      accessType: route.accessType,
      defaultAllowed: decision?.defaultAllowed ?? true,
      overrideAction: decision?.overrideAction ?? null,
      wouldAllow: decision?.wouldAllow ?? true,
      wouldBlock: !(decision?.wouldAllow ?? true),
      enforcementEnabled: false,
    };
  });
}
