export const ADMIN_USERS_PHASE_V1_FINAL_ROLE_MODEL = true as const;

export type AdminUsersPhaseV1RoleKey =
  | "owner_admin"
  | "administrator"
  | "full_user"
  | "basic_user"
  | "view_only";

export type AdminUsersPhaseV1AdminAccessMode =
  | "all_admin_cards"
  | "selected_admin_cards"
  | "no_admin_screen";

export type AdminUsersPhaseV1NonAdminAccessMode =
  | "all_non_admin"
  | "all_non_admin_except_payment_functions"
  | "non_admin_view_only";

export type AdminUsersPhaseV1PaymentAccessMode =
  | "all_payment_functions"
  | "no_payment_functions"
  | "payment_view_only";

export type AdminUsersPhaseV1MutationMode =
  | "all_mutations"
  | "non_admin_mutations"
  | "non_payment_non_admin_mutations"
  | "view_only_no_mutations";

export type AdminUsersPhaseV1AdminCardKey =
  | "users_roles"
  | "audit_history"
  | "document_templates"
  | "reference_data"
  | "claim_index"
  | "ticklers"
  | "clients_billing"
  | "backup_restore"
  | "readiness_dashboard"
  | "document_readiness"
  | "lawsuit_cleanup"
  | "permissions_review";

export type AdminUsersPhaseV1AdminCardDefinition = {
  key: AdminUsersPhaseV1AdminCardKey;
  label: string;
  route: string;
  grantPermissionKey: string;
  sensitive: boolean;
  ownerOnlyRecommended: boolean;
  description: string;
};

export type AdminUsersPhaseV1RoleDefinition = {
  key: AdminUsersPhaseV1RoleKey;
  label: string;
  description: string;
  adminAccessMode: AdminUsersPhaseV1AdminAccessMode;
  nonAdminAccessMode: AdminUsersPhaseV1NonAdminAccessMode;
  paymentAccessMode: AdminUsersPhaseV1PaymentAccessMode;
  mutationMode: AdminUsersPhaseV1MutationMode;
  protectedFromLockout: boolean;
  mayManageUsersAndRoles: boolean;
  mayResetPasswords: boolean;
  mayConfigureTwoFactor: boolean;
  adminCardGrantMode: "all" | "selectable_per_card" | "none";
  notes: string[];
};

export const ADMIN_USERS_PHASE_V1_ADMIN_CARDS: AdminUsersPhaseV1AdminCardDefinition[] = [
  {
    key: "users_roles",
    label: "Users & Roles",
    route: "/admin/users",
    grantPermissionKey: "admin.card.usersRoles",
    sensitive: true,
    ownerOnlyRecommended: true,
    description: "Create users, edit signer profiles, assign roles, reset passwords, lock users, and manage 2FA setup.",
  },
  {
    key: "permissions_review",
    label: "Permissions Review",
    route: "/admin/permissions",
    grantPermissionKey: "admin.card.permissionsReview",
    sensitive: true,
    ownerOnlyRecommended: true,
    description: "Review permission catalog, role matrix, readiness diagnostics, and future enforcement status.",
  },
  {
    key: "audit_history",
    label: "Audit History",
    route: "/admin/audit-history",
    grantPermissionKey: "admin.card.auditHistory",
    sensitive: false,
    ownerOnlyRecommended: false,
    description: "View read-only administrative audit/history entries.",
  },
  {
    key: "document_templates",
    label: "Document Templates",
    route: "/admin/document-templates",
    grantPermissionKey: "admin.card.documentTemplates",
    sensitive: true,
    ownerOnlyRecommended: false,
    description: "Manage document template builder, template metadata, template lifecycle, and template readiness.",
  },
  {
    key: "reference_data",
    label: "Reference Data",
    route: "/admin/reference-data",
    grantPermissionKey: "admin.card.referenceData",
    sensitive: true,
    ownerOnlyRecommended: false,
    description: "Manage local reference entities used by matters, lawsuits, templates, addressees, and signers.",
  },
  {
    key: "claim_index",
    label: "Claim Index",
    route: "/admin/claim-index",
    grantPermissionKey: "admin.card.claimIndex",
    sensitive: false,
    ownerOnlyRecommended: false,
    description: "Review and administer ClaimIndex data and related audit screens.",
  },
  {
    key: "ticklers",
    label: "Ticklers",
    route: "/admin/ticklers",
    grantPermissionKey: "admin.card.ticklers",
    sensitive: true,
    ownerOnlyRecommended: false,
    description: "Review, run, and administer tickler workflows.",
  },
  {
    key: "clients_billing",
    label: "Clients / Billing",
    route: "/admin/clients",
    grantPermissionKey: "admin.card.clientsBilling",
    sensitive: true,
    ownerOnlyRecommended: false,
    description: "Manage client, invoice, cost ledger, invoice finalization, voiding, and billing history workflows.",
  },
  {
    key: "backup_restore",
    label: "Backup / Restore",
    route: "/admin/backup-restore",
    grantPermissionKey: "admin.card.backupRestore",
    sensitive: true,
    ownerOnlyRecommended: true,
    description: "Review backup health and guarded backup/restore tooling.",
  },
  {
    key: "readiness_dashboard",
    label: "Readiness Dashboard",
    route: "/admin/readiness-dashboard",
    grantPermissionKey: "admin.card.readinessDashboard",
    sensitive: false,
    ownerOnlyRecommended: false,
    description: "View read-only system readiness diagnostics.",
  },
  {
    key: "document_readiness",
    label: "Document Readiness",
    route: "/admin/document-readiness/audit",
    grantPermissionKey: "admin.card.documentReadiness",
    sensitive: false,
    ownerOnlyRecommended: false,
    description: "View document readiness, finalization, and document-generation audit diagnostics.",
  },
  {
    key: "lawsuit_cleanup",
    label: "Lawsuit Cleanup",
    route: "/admin/lawsuit-cleanup",
    grantPermissionKey: "admin.card.lawsuitCleanup",
    sensitive: true,
    ownerOnlyRecommended: false,
    description: "Review and confirm guarded lawsuit cleanup workflows.",
  },
] as const;

export const ADMIN_USERS_PHASE_V1_PAYMENT_PERMISSION_FAMILIES = [
  "payments.view",
  "payments.manage",
  "invoices.view",
  "invoices.create",
  "invoices.finalize",
  "invoices.void",
  "settlements.paymentStatus.manage",
  "settlements.paymentStatus.view",
] as const;

export const ADMIN_USERS_PHASE_V1_FINAL_ROLE_DEFINITIONS: AdminUsersPhaseV1RoleDefinition[] = [
  {
    key: "owner_admin",
    label: "Owner",
    description: "Everything. Full application access, all Admin cards, all user/role/password/security functions, and protected owner no-lockout behavior.",
    adminAccessMode: "all_admin_cards",
    nonAdminAccessMode: "all_non_admin",
    paymentAccessMode: "all_payment_functions",
    mutationMode: "all_mutations",
    protectedFromLockout: true,
    mayManageUsersAndRoles: true,
    mayResetPasswords: true,
    mayConfigureTwoFactor: true,
    adminCardGrantMode: "all",
    notes: [
      "Keep the internal key owner_admin for compatibility with existing bootstrap/no-lockout protections.",
      "This role is intended for Dav Bars / true owner-level administrators only.",
    ],
  },
  {
    key: "administrator",
    label: "Administrator",
    description: "Everything outside Admin. Admin access is selectable on an Admin-card basis.",
    adminAccessMode: "selected_admin_cards",
    nonAdminAccessMode: "all_non_admin",
    paymentAccessMode: "all_payment_functions",
    mutationMode: "all_mutations",
    protectedFromLockout: false,
    mayManageUsersAndRoles: false,
    mayResetPasswords: false,
    mayConfigureTwoFactor: false,
    adminCardGrantMode: "selectable_per_card",
    notes: [
      "Administrator can be granted specific Admin cards without receiving all Admin functions.",
      "Users & Roles, Permissions Review, and Backup / Restore should remain owner-only unless explicitly granted.",
    ],
  },
  {
    key: "full_user",
    label: "Full User",
    description: "Full non-admin app access, including payment functions. No Admin screen.",
    adminAccessMode: "no_admin_screen",
    nonAdminAccessMode: "all_non_admin",
    paymentAccessMode: "all_payment_functions",
    mutationMode: "non_admin_mutations",
    protectedFromLockout: false,
    mayManageUsersAndRoles: false,
    mayResetPasswords: false,
    mayConfigureTwoFactor: false,
    adminCardGrantMode: "none",
    notes: [
      "No /admin card access.",
      "May use normal matter/lawsuit/document/payment workflows outside Admin.",
    ],
  },
  {
    key: "basic_user",
    label: "Basic User",
    description: "Full non-admin app access except payment/billing/payment-status functions. No Admin screen.",
    adminAccessMode: "no_admin_screen",
    nonAdminAccessMode: "all_non_admin_except_payment_functions",
    paymentAccessMode: "no_payment_functions",
    mutationMode: "non_payment_non_admin_mutations",
    protectedFromLockout: false,
    mayManageUsersAndRoles: false,
    mayResetPasswords: false,
    mayConfigureTwoFactor: false,
    adminCardGrantMode: "none",
    notes: [
      "No /admin card access.",
      "Payment, billing, invoice, and settlement-payment management functions are excluded.",
    ],
  },
  {
    key: "view_only",
    label: "View Only",
    description: "Can view all non-admin screens, including non-admin payment screens where applicable, but cannot mutate anything. No Admin screen.",
    adminAccessMode: "no_admin_screen",
    nonAdminAccessMode: "non_admin_view_only",
    paymentAccessMode: "payment_view_only",
    mutationMode: "view_only_no_mutations",
    protectedFromLockout: false,
    mayManageUsersAndRoles: false,
    mayResetPasswords: false,
    mayConfigureTwoFactor: false,
    adminCardGrantMode: "none",
    notes: [
      "No create, edit, finalize, delete, upload, queue, print-status-update, close, void, import, generate, run, or payment mutation actions.",
      "No /admin card access.",
    ],
  },
] as const;

export function adminUsersPhaseV1RoleKeys(): AdminUsersPhaseV1RoleKey[] {
  return ADMIN_USERS_PHASE_V1_FINAL_ROLE_DEFINITIONS.map((role) => role.key);
}

export function adminUsersPhaseV1AdminCardGrantKeys(): string[] {
  return ADMIN_USERS_PHASE_V1_ADMIN_CARDS.map((card) => card.grantPermissionKey);
}

export function adminUsersPhaseV1RoleByKey(roleKey: string): AdminUsersPhaseV1RoleDefinition | null {
  return ADMIN_USERS_PHASE_V1_FINAL_ROLE_DEFINITIONS.find((role) => role.key === roleKey) || null;
}
