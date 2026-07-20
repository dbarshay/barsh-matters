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
    key: "reports.access",
    group: "Reports",
    label: "Reports",
    description: "Build, save, run, and export custom reports over matters and lawsuits. Grantable per-user.",
    routeScopes: ["/admin/reports", "/admin/reports/*", "/api/admin/reports", "/api/admin/reports/*"],
    functionScopes: ["reports-builder"],
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
    key: "emails.view",
    group: "Emails",
    label: "View Emails",
    description: "View matter/lawsuit email (the Outlook-style inbox) and the inbound attachment review queue (read-only). Includes marking messages read.",
    routeScopes: ["/api/graph/thread-sync-preview", "/api/graph/local-thread-preview", "/api/graph/matter-email/unread-count", "/api/graph/matter-email/messages", "/api/graph/matter-email/mark-read", "/api/graph/inbound-attachments"],
    functionScopes: ["email-read"],
    tier: "view",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "emails.send",
    group: "Emails",
    label: "Send & File Emails",
    description: "Send/reply to matter/lawsuit email from your mailbox, save drafts, delete (move to Deleted Items), sync threads from Microsoft Graph, and file inbound email attachments. Excludes View Only.",
    routeScopes: ["/api/graph/matter-email/send", "/api/graph/matter-email/save-draft", "/api/graph/matter-email/delete", "/api/graph/thread-sync", "/api/graph/inbound-attachments"],
    functionScopes: ["email-send", "email-attachment-file"],
    tier: "edit",
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

  // Per-card admin grants. Each Administrator can be granted individual admin screens (stored as
  // AdminUserPermissionOverride rows; see /api/admin/users/card-grants). Scope covers the screen
  // route plus that card's own /api/admin endpoints. Shared operational endpoints a screen also
  // calls (audit-log, reference-data, documents/templates) are intentionally NOT listed here — they
  // are governed by the operational tiers an Administrator already holds. Owner and the master
  // "admin.access" grant both still satisfy these routes. The two security cards (Users & Roles,
  // Permissions Review) are deliberately excluded: those stay Owner-only / never-block.
  {
    key: "admin.card.auditHistory",
    group: "Administrator Cards",
    label: "Audit History",
    description: "Open the Audit History administrator screen.",
    routeScopes: ["/admin/audit-history", "/admin/audit-history/*"],
    functionScopes: ["admin-card:audit_history"],
    tier: "admin",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "admin.card.documentTemplates",
    group: "Administrator Cards",
    label: "Document Templates",
    description: "Open the Document Templates administrator screen.",
    routeScopes: ["/admin/document-templates", "/admin/document-templates/*", "/api/admin/document-templates", "/api/admin/document-templates/*"],
    functionScopes: ["admin-card:document_templates"],
    tier: "admin",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "admin.card.referenceData",
    group: "Administrator Cards",
    label: "Reference Data",
    description: "Open the Reference Data administrator screen.",
    routeScopes: ["/admin/reference-data", "/admin/reference-data/*", "/api/admin/email-automation-status"],
    functionScopes: ["admin-card:reference_data"],
    tier: "admin",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "admin.card.claimIndex",
    group: "Administrator Cards",
    label: "Claim Index",
    description: "Open the Claim Index administrator screen.",
    routeScopes: ["/admin/claim-index", "/admin/claim-index/*", "/api/admin/claim-index", "/api/admin/claim-index/*"],
    functionScopes: ["admin-card:claim_index"],
    tier: "admin",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "admin.card.ticklers",
    group: "Administrator Cards",
    label: "Ticklers",
    description: "Open the Ticklers administrator screen.",
    routeScopes: ["/admin/ticklers", "/admin/ticklers/*", "/api/admin/ticklers", "/api/admin/ticklers/*"],
    functionScopes: ["admin-card:ticklers"],
    tier: "admin",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "admin.card.clientsBilling",
    group: "Administrator Cards",
    label: "Clients / Billing",
    description: "Open the Clients / Billing administrator screen.",
    routeScopes: ["/admin/clients", "/admin/clients/*", "/api/admin/clients", "/api/admin/clients/*", "/api/admin/invoices", "/api/admin/invoices/*"],
    functionScopes: ["admin-card:clients_billing"],
    tier: "admin",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "admin.card.backupRestore",
    group: "Administrator Cards",
    label: "Backup / Restore",
    description: "Open the Backup / Restore administrator screen.",
    routeScopes: ["/admin/backup-restore", "/admin/backup-restore/*", "/api/admin/backups", "/api/admin/backups/*"],
    functionScopes: ["admin-card:backup_restore"],
    tier: "admin",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "admin.card.readinessDashboard",
    group: "Administrator Cards",
    label: "Readiness Dashboard",
    description: "Open the Readiness Dashboard administrator screen.",
    routeScopes: ["/admin/readiness-dashboard", "/admin/readiness-dashboard/*"],
    functionScopes: ["admin-card:readiness_dashboard"],
    tier: "admin",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "admin.card.documentReadiness",
    group: "Administrator Cards",
    label: "Document Readiness",
    description: "Open the Document Readiness administrator screen.",
    routeScopes: ["/admin/document-readiness", "/admin/document-readiness/*", "/api/admin/document-readiness", "/api/admin/document-readiness/*"],
    functionScopes: ["admin-card:document_readiness"],
    tier: "admin",
    enforcementStatus: "planned-not-enforced",
  },
  {
    key: "admin.card.lawsuitCleanup",
    group: "Administrator Cards",
    label: "Lawsuit Cleanup",
    description: "Open the Lawsuit Cleanup administrator screen.",
    routeScopes: ["/admin/lawsuit-cleanup", "/admin/lawsuit-cleanup/*", "/api/admin/lawsuits", "/api/admin/lawsuits/*"],
    functionScopes: ["admin-card:lawsuit_cleanup"],
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
