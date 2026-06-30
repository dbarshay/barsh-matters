// Reworked permission model — see docs/permission-model.md.
//
// Every permission is tagged with exactly one TIER:
//   view     — read-only.
//   edit     — routine create/modify + document drafting.
//   process  — high-stakes operational actions: payments, settlement amounts, invoices/billing,
//              finalize documents, close/void matters/lawsuits/settlements (money + irreversible).
//   admin    — general administrator functions (audits, backups, reference-data admin, templates,
//              ticklers, cleanup, claim-index rebuild, admin-area access). Grantable per-user.
//   security — manage admin users, roles, permissions, and security settings. OWNER ONLY.
//
// Role tiers (cumulative ladder + security split):
//   View Only   = view
//   Partial User= view + edit
//   Full User   = view + edit + process
//   Administrator = view + edit + process + admin (only the admin functions granted to that user)
//   Owner       = view + edit + process + admin (all) + security

export type AdminPermissionTier = "view" | "edit" | "process" | "admin" | "security";
export type AdminPermissionEnforcementStatus = "enforced-currently" | "planned-not-enforced" | "never-block";

export type AdminPermissionCatalogItem = {
  key: string;
  group: string;
  label: string;
  description: string;
  routeScopes: string[];
  functionScopes: string[];
  tier: AdminPermissionTier;
  enforcementStatus: AdminPermissionEnforcementStatus;
};

export const ADMIN_PERMISSION_CATALOG: AdminPermissionCatalogItem[] = [
  {
    key: "admin.access",
    group: "Administrator",
    label: "Admin Access",
    description: "Access administrator pages and administrator APIs.",
    routeScopes: ["/admin", "/admin/*", "/api/admin", "/api/admin/*"],
    functionScopes: ["admin-pages", "admin-apis"],
    tier: "admin",
    enforcementStatus: "enforced-currently",
  },
  {
    key: "admin.users.manage",
    group: "Security",
    label: "Manage Admin Users",
    description: "Create, lock, unlock, assign roles, and reset admin user passwords.",
    routeScopes: ["/admin/users", "/api/admin/users/*"],
    functionScopes: ["admin-user-management"],
    tier: "security",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "admin.permissions.manage",
    group: "Security",
    label: "Manage Permissions",
    description: "Manage roles, permission catalog visibility, and user permission overrides.",
    routeScopes: ["/admin/permissions", "/api/admin/permissions/*"],
    functionScopes: ["permission-management"],
    tier: "security",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "matters.view",
    group: "Matters",
    label: "View Matters",
    description: "View matter lists, matter details, and matter-linked read-only information.",
    routeScopes: ["/matters", "/matter/[id]", "/api/matters/*"],
    functionScopes: ["matter-read"],
    tier: "view",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "matters.edit",
    group: "Matters",
    label: "Edit Matters",
    description: "Edit direct matter fields, identity fields, status, and metadata.",
    routeScopes: ["/matter/[id]", "/api/matters/update-direct-field", "/api/matters/identity-field/*"],
    functionScopes: ["matter-write"],
    tier: "edit",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "matters.close",
    group: "Matters",
    label: "Close Matters",
    description: "Close or reopen direct matters.",
    routeScopes: ["/api/matters/close"],
    functionScopes: ["matter-close"],
    tier: "process",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "matters.payments.post",
    group: "Matters",
    label: "Post Matter Payments",
    description: "Post payments against direct matters.",
    routeScopes: ["/api/matters/apply-payment"],
    functionScopes: ["direct-payment-post"],
    tier: "process",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "matters.payments.void",
    group: "Matters",
    label: "Void Matter Payments",
    description: "Void posted direct matter payment receipts.",
    routeScopes: ["/api/matters/apply-payment"],
    functionScopes: ["direct-payment-void"],
    tier: "process",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "lawsuits.view",
    group: "Lawsuits",
    label: "View Lawsuits",
    description: "View lawsuit list, master lawsuit pages, and lawsuit read-only details.",
    routeScopes: ["/lawsuits", "/api/lawsuits/*"],
    functionScopes: ["lawsuit-read"],
    tier: "view",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "lawsuits.create",
    group: "Lawsuits",
    label: "Create Lawsuits",
    description: "Create master lawsuits and aggregate child matters into lawsuits.",
    routeScopes: ["/api/lawsuits/local-generation-create", "/api/aggregation/*"],
    functionScopes: ["lawsuit-create"],
    tier: "edit",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "lawsuits.edit",
    group: "Lawsuits",
    label: "Edit Lawsuits",
    description: "Edit lawsuit metadata and options.",
    routeScopes: ["/api/lawsuits/update-metadata"],
    functionScopes: ["lawsuit-write"],
    tier: "edit",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "lawsuits.close",
    group: "Lawsuits",
    label: "Close Lawsuits",
    description: "Close master lawsuits and cascade local close status to child matters.",
    routeScopes: ["/api/lawsuits/close"],
    functionScopes: ["lawsuit-close"],
    tier: "process",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "lawsuits.payments.post",
    group: "Lawsuits",
    label: "Post Lawsuit Payments",
    description: "Post master/lawsuit payments to child matter receipts.",
    routeScopes: ["/api/matters/apply-payment"],
    functionScopes: ["lawsuit-payment-post"],
    tier: "process",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "lawsuits.payments.void",
    group: "Lawsuits",
    label: "Void Lawsuit Payments",
    description: "Void child receipts created through lawsuit/master payment workflows.",
    routeScopes: ["/api/matters/apply-payment"],
    functionScopes: ["lawsuit-payment-void"],
    tier: "process",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "documents.view",
    group: "Documents",
    label: "View Documents",
    description: "View document status, packets, history, previews, and print queue read-only state.",
    routeScopes: ["/print-queue", "/api/documents/*"],
    functionScopes: ["document-read"],
    tier: "view",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "documents.generate",
    group: "Documents",
    label: "Generate Documents",
    description: "Generate document drafts and previews.",
    routeScopes: ["/api/documents/generate-preview", "/api/documents/working-docx", "/api/documents/preview-pdf"],
    functionScopes: ["document-generate"],
    tier: "edit",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "documents.finalize",
    group: "Documents",
    label: "Finalize Documents",
    description: "Finalize documents and write finalization records.",
    routeScopes: ["/api/documents/finalize", "/api/documents/finalize-preview"],
    functionScopes: ["document-finalize"],
    tier: "process",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "documents.printQueue.manage",
    group: "Documents",
    label: "Manage Print Queue",
    description: "Manage print queue actions and document print workflows.",
    routeScopes: ["/print-queue", "/api/documents/print-queue", "/api/documents/print-queue-preview"],
    functionScopes: ["print-queue-manage"],
    tier: "edit",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "settlements.view",
    group: "Settlements",
    label: "View Settlements",
    description: "View settlement values, previews, summaries, and settlement history.",
    routeScopes: ["/api/settlements/current-values", "/api/settlements/history", "/api/settlements/settlement-summary"],
    functionScopes: ["settlement-read"],
    tier: "view",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "settlements.edit",
    group: "Settlements",
    label: "Edit Settlements",
    description: "Create or update settlement records and local settlement workflow state.",
    routeScopes: ["/api/settlements/local-record", "/api/settlements/writeback"],
    functionScopes: ["settlement-write"],
    tier: "process",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "settlements.close",
    group: "Settlements",
    label: "Close Settlements",
    description: "Run settlement close workflows.",
    routeScopes: ["/api/settlements/close"],
    functionScopes: ["settlement-close"],
    tier: "process",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "settlements.void",
    group: "Settlements",
    label: "Void Settlements",
    description: "Void local settlement records.",
    routeScopes: ["/api/settlements/local-void"],
    functionScopes: ["settlement-void"],
    tier: "process",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "courtCalendar.view",
    group: "Court Calendar",
    label: "View Court Calendar",
    description: "View court calendar page, event lists, and filter options.",
    routeScopes: ["/court-calendar", "/api/court-calendar/events", "/api/court-calendar/filter-options"],
    functionScopes: ["court-calendar-read"],
    tier: "view",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "courtCalendar.edit",
    group: "Court Calendar",
    label: "Edit Court Calendar",
    description: "Import or update court calendar events.",
    routeScopes: ["/api/court-calendar/import-webcivil-local"],
    functionScopes: ["court-calendar-write"],
    tier: "edit",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "printQueue.view",
    group: "Print Queue",
    label: "View Print Queue",
    description: "View print queue page and queue status.",
    routeScopes: ["/print-queue", "/api/documents/print-queue-preview"],
    functionScopes: ["print-queue-read"],
    tier: "view",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "printQueue.manage",
    group: "Print Queue",
    label: "Manage Print Queue",
    description: "Manage print queue actions.",
    routeScopes: ["/print-queue", "/api/documents/print-queue"],
    functionScopes: ["print-queue-manage"],
    tier: "edit",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "claimIndex.search",
    group: "Claim Index / Search",
    label: "Search Claim Index",
    description: "Use matter/lawsuit/search APIs and claim-index lookup routes.",
    routeScopes: ["/api/claim-index/search", "/api/claim-index/search-grouped", "/api/advanced-search/*"],
    functionScopes: ["claim-index-search"],
    tier: "view",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "claimIndex.rebuild",
    group: "Claim Index / Search",
    label: "Rebuild Claim Index",
    description: "Rebuild or refresh the local claim index.",
    routeScopes: ["/api/claim-index/rebuild", "/api/claim-index/refresh-cluster"],
    functionScopes: ["claim-index-rebuild"],
    tier: "admin",
    enforcementStatus: "planned-not-enforced",
  },
];

export const ADMIN_PERMISSION_TIERS: AdminPermissionTier[] = ["view", "edit", "process", "admin", "security"];

export function getAdminPermissionCatalog() {
  return ADMIN_PERMISSION_CATALOG;
}

export function getAdminPermissionCatalogGroups() {
  return Array.from(new Set(ADMIN_PERMISSION_CATALOG.map((item) => item.group))).sort();
}

export function findAdminPermissionCatalogItem(key: string) {
  return ADMIN_PERMISSION_CATALOG.find((item) => item.key === key) || null;
}

export function adminPermissionKeysForTier(tier: AdminPermissionTier): string[] {
  return ADMIN_PERMISSION_CATALOG.filter((item) => item.tier === tier).map((item) => item.key);
}
