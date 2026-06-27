export const ADMIN_USERS_PHASE_W1_FINAL_PERMISSION_COVERAGE = true as const;

export type AdminUsersPhaseW1RoleKey =
  | "owner_admin"
  | "administrator"
  | "full_user"
  | "basic_user"
  | "view_only";

export type AdminUsersPhaseW1AccessLevel =
  | "all"
  | "selected_admin_cards"
  | "non_admin_all"
  | "non_admin_no_payment"
  | "non_admin_view_only"
  | "none";

export type AdminUsersPhaseW1AreaKey =
  | "home_dashboard"
  | "individual_matters"
  | "lawsuits"
  | "documents"
  | "document_generation"
  | "print_queue"
  | "maildrop_email"
  | "clio_storage_finalize"
  | "ticklers_non_admin"
  | "client_billing_payments"
  | "settlement_payment_status"
  | "reports_exports"
  | "admin_screen"
  | "admin_cards";

export type AdminUsersPhaseW1OperationKey =
  | "view"
  | "search"
  | "create"
  | "edit"
  | "delete"
  | "archive"
  | "generate"
  | "finalize"
  | "upload"
  | "download"
  | "print"
  | "email"
  | "run"
  | "void"
  | "payment_manage"
  | "admin_manage";

export type AdminUsersPhaseW1AreaCoverage = {
  areaKey: AdminUsersPhaseW1AreaKey;
  label: string;
  description: string;
  paymentSensitive: boolean;
  adminOnly: boolean;
  operations: AdminUsersPhaseW1OperationKey[];
};

export type AdminUsersPhaseW1RoleCoverage = {
  roleKey: AdminUsersPhaseW1RoleKey;
  label: string;
  summary: string;
  accessLevel: AdminUsersPhaseW1AccessLevel;
  adminScreenAllowed: boolean;
  adminCardMode: "all" | "selected" | "none";
  nonAdminViewAllowed: boolean;
  nonAdminMutationAllowed: boolean;
  paymentViewAllowed: boolean;
  paymentMutationAllowed: boolean;
  routeEnforcementActive: false;
  uiHidingActive: false;
  allowedAreas: AdminUsersPhaseW1AreaKey[];
  blockedAreas: AdminUsersPhaseW1AreaKey[];
  blockedOperationFamilies: AdminUsersPhaseW1OperationKey[];
  notes: string[];
};

export const ADMIN_USERS_PHASE_W1_AREA_COVERAGE: AdminUsersPhaseW1AreaCoverage[] = [
  {
    areaKey: "home_dashboard",
    label: "Home / Dashboard",
    description: "Main dashboard, matter lookup, search, and non-admin navigation.",
    paymentSensitive: false,
    adminOnly: false,
    operations: ["view", "search"],
  },
  {
    areaKey: "individual_matters",
    label: "Individual Matters",
    description: "Direct matter screens and normal non-admin matter workflows.",
    paymentSensitive: false,
    adminOnly: false,
    operations: ["view", "search", "create", "edit", "archive"],
  },
  {
    areaKey: "lawsuits",
    label: "Lawsuits",
    description: "Lawsuit/master matter screens and normal non-admin lawsuit workflows.",
    paymentSensitive: false,
    adminOnly: false,
    operations: ["view", "search", "create", "edit", "archive"],
  },
  {
    areaKey: "documents",
    label: "Documents",
    description: "Document viewing, downloads, generated document review, and document delivery context.",
    paymentSensitive: false,
    adminOnly: false,
    operations: ["view", "download", "email", "print"],
  },
  {
    areaKey: "document_generation",
    label: "Generate Documents",
    description: "Non-admin document generation from active templates and matter/lawsuit context.",
    paymentSensitive: false,
    adminOnly: false,
    operations: ["view", "generate", "download"],
  },
  {
    areaKey: "print_queue",
    label: "Print Queue",
    description: "Print queue review, print status updates, and queued document handling.",
    paymentSensitive: false,
    adminOnly: false,
    operations: ["view", "print", "edit"],
  },
  {
    areaKey: "maildrop_email",
    label: "Maildrop / Email",
    description: "Non-admin email drafting, maildrop review, and document delivery email workflows.",
    paymentSensitive: false,
    adminOnly: false,
    operations: ["view", "email", "edit"],
  },
  {
    areaKey: "clio_storage_finalize",
    label: "Clio Storage Finalize",
    description: "Guarded finalization/upload workflows that send finalized files to Clio storage.",
    paymentSensitive: false,
    adminOnly: false,
    operations: ["view", "finalize", "upload"],
  },
  {
    areaKey: "ticklers_non_admin",
    label: "Ticklers",
    description: "Non-admin tickler viewing and task/status handling outside the Admin screen.",
    paymentSensitive: false,
    adminOnly: false,
    operations: ["view", "search", "edit", "run"],
  },
  {
    areaKey: "client_billing_payments",
    label: "Client Billing / Payments",
    description: "Client billing, invoices, payment functions, invoice finalization, voids, and billing ledger actions.",
    paymentSensitive: true,
    adminOnly: false,
    operations: ["view", "create", "edit", "finalize", "void", "payment_manage"],
  },
  {
    areaKey: "settlement_payment_status",
    label: "Settlement Payment Status",
    description: "Settlement payment status, payment tracking, and payment-related settlement updates.",
    paymentSensitive: true,
    adminOnly: false,
    operations: ["view", "edit", "payment_manage"],
  },
  {
    areaKey: "reports_exports",
    label: "Reports / Exports",
    description: "Non-admin reports, exports, and operational review data.",
    paymentSensitive: false,
    adminOnly: false,
    operations: ["view", "download"],
  },
  {
    areaKey: "admin_screen",
    label: "Admin Screen",
    description: "Top-level /admin access and Admin landing navigation.",
    paymentSensitive: false,
    adminOnly: true,
    operations: ["view", "admin_manage"],
  },
  {
    areaKey: "admin_cards",
    label: "Admin Cards",
    description: "Individual Admin cards such as Users, Templates, Ticklers, Clients/Billing, and other admin-only cards.",
    paymentSensitive: false,
    adminOnly: true,
    operations: ["view", "admin_manage"],
  },
] as const;

const ALL_NON_ADMIN_AREAS: AdminUsersPhaseW1AreaKey[] = ADMIN_USERS_PHASE_W1_AREA_COVERAGE
  .filter((area) => !area.adminOnly)
  .map((area) => area.areaKey);

const NON_PAYMENT_NON_ADMIN_AREAS: AdminUsersPhaseW1AreaKey[] = ADMIN_USERS_PHASE_W1_AREA_COVERAGE
  .filter((area) => !area.adminOnly && !area.paymentSensitive)
  .map((area) => area.areaKey);

const PAYMENT_AREAS: AdminUsersPhaseW1AreaKey[] = ADMIN_USERS_PHASE_W1_AREA_COVERAGE
  .filter((area) => area.paymentSensitive)
  .map((area) => area.areaKey);

const ADMIN_AREAS: AdminUsersPhaseW1AreaKey[] = ADMIN_USERS_PHASE_W1_AREA_COVERAGE
  .filter((area) => area.adminOnly)
  .map((area) => area.areaKey);

export const ADMIN_USERS_PHASE_W1_ROLE_COVERAGE: AdminUsersPhaseW1RoleCoverage[] = [
  {
    roleKey: "owner_admin",
    label: "Owner",
    summary: "Everything. Full non-admin access, all Admin cards, payment functions, user/security controls, and owner no-lockout protection.",
    accessLevel: "all",
    adminScreenAllowed: true,
    adminCardMode: "all",
    nonAdminViewAllowed: true,
    nonAdminMutationAllowed: true,
    paymentViewAllowed: true,
    paymentMutationAllowed: true,
    routeEnforcementActive: false,
    uiHidingActive: false,
    allowedAreas: [...ALL_NON_ADMIN_AREAS, ...ADMIN_AREAS],
    blockedAreas: [],
    blockedOperationFamilies: [],
    notes: [
      "Internal key remains owner_admin for bootstrap/no-lockout compatibility.",
      "Owner is never converted into selected-card mode.",
    ],
  },
  {
    roleKey: "administrator",
    label: "Administrator",
    summary: "Everything outside Admin. Admin access is limited to selected Admin-card grants.",
    accessLevel: "selected_admin_cards",
    adminScreenAllowed: true,
    adminCardMode: "selected",
    nonAdminViewAllowed: true,
    nonAdminMutationAllowed: true,
    paymentViewAllowed: true,
    paymentMutationAllowed: true,
    routeEnforcementActive: false,
    uiHidingActive: false,
    allowedAreas: [...ALL_NON_ADMIN_AREAS, "admin_screen", "admin_cards"],
    blockedAreas: [],
    blockedOperationFamilies: [],
    notes: [
      "Admin-card grants are persisted as admin.card.* allow overrides.",
      "Runtime enforcement is not active in W1.",
    ],
  },
  {
    roleKey: "full_user",
    label: "Full User",
    summary: "Full non-admin app access, including payment functions. No Admin screen.",
    accessLevel: "non_admin_all",
    adminScreenAllowed: false,
    adminCardMode: "none",
    nonAdminViewAllowed: true,
    nonAdminMutationAllowed: true,
    paymentViewAllowed: true,
    paymentMutationAllowed: true,
    routeEnforcementActive: false,
    uiHidingActive: false,
    allowedAreas: ALL_NON_ADMIN_AREAS,
    blockedAreas: ADMIN_AREAS,
    blockedOperationFamilies: ["admin_manage"],
    notes: [
      "Full User should not see /admin or Admin cards.",
      "Full User may use payment/billing functions outside Admin.",
    ],
  },
  {
    roleKey: "basic_user",
    label: "Basic User",
    summary: "Full non-admin app access except payment, billing, invoice, and settlement-payment functions. No Admin screen.",
    accessLevel: "non_admin_no_payment",
    adminScreenAllowed: false,
    adminCardMode: "none",
    nonAdminViewAllowed: true,
    nonAdminMutationAllowed: true,
    paymentViewAllowed: false,
    paymentMutationAllowed: false,
    routeEnforcementActive: false,
    uiHidingActive: false,
    allowedAreas: NON_PAYMENT_NON_ADMIN_AREAS,
    blockedAreas: [...ADMIN_AREAS, ...PAYMENT_AREAS],
    blockedOperationFamilies: ["admin_manage", "payment_manage", "void"],
    notes: [
      "Basic User excludes payment-sensitive areas even when those areas are not under /admin.",
      "Exact payment route/action mapping is deferred to W2.",
    ],
  },
  {
    roleKey: "view_only",
    label: "View Only",
    summary: "Can view non-admin screens only. No create, edit, delete, upload, finalize, payment, or Admin actions.",
    accessLevel: "non_admin_view_only",
    adminScreenAllowed: false,
    adminCardMode: "none",
    nonAdminViewAllowed: true,
    nonAdminMutationAllowed: false,
    paymentViewAllowed: true,
    paymentMutationAllowed: false,
    routeEnforcementActive: false,
    uiHidingActive: false,
    allowedAreas: ALL_NON_ADMIN_AREAS,
    blockedAreas: ADMIN_AREAS,
    blockedOperationFamilies: ["create", "edit", "delete", "archive", "generate", "finalize", "upload", "email", "run", "void", "payment_manage", "admin_manage"],
    notes: [
      "View Only can view non-admin screens but should not mutate records.",
      "Exact read-only route/action mapping is deferred to W2.",
    ],
  },
] as const;

export function adminUsersPhaseW1CoverageByRole(roleKey: string): AdminUsersPhaseW1RoleCoverage | null {
  return ADMIN_USERS_PHASE_W1_ROLE_COVERAGE.find((role) => role.roleKey === roleKey) || null;
}

export function adminUsersPhaseW1AreaByKey(areaKey: string): AdminUsersPhaseW1AreaCoverage | null {
  return ADMIN_USERS_PHASE_W1_AREA_COVERAGE.find((area) => area.areaKey === areaKey) || null;
}
