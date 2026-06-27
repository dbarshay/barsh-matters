import type {
  AdminUsersPhaseW1AreaKey,
  AdminUsersPhaseW1OperationKey,
} from "./admin-users-final-permission-coverage-phase-w1";

export const ADMIN_USERS_PHASE_W2_ROUTE_ACTION_CLASSIFICATION = true as const;

export type AdminUsersPhaseW2FileKind =
  | "page"
  | "api_route"
  | "layout"
  | "server_action"
  | "component_or_other";

export type AdminUsersPhaseW2Classification = {
  path: string;
  fileKind: AdminUsersPhaseW2FileKind;
  areaKey: AdminUsersPhaseW1AreaKey;
  operationFamilies: AdminUsersPhaseW1OperationKey[];
  paymentSensitive: boolean;
  adminOnly: boolean;
  adminCardGrantKey: string | null;
  enforcementActive: false;
  uiHidingActive: false;
  notes: string[];
};

export const ADMIN_USERS_PHASE_W2_ADMIN_CARD_ROUTE_RULES = [
  { pathIncludes: "/admin/users", grantKey: "admin.card.usersRoles", areaKey: "admin_cards", label: "Users / Roles" },
  { pathIncludes: "/admin/permissions", grantKey: "admin.card.permissionsReview", areaKey: "admin_cards", label: "Permissions Review" },
  { pathIncludes: "/admin/audit", grantKey: "admin.card.auditHistory", areaKey: "admin_cards", label: "Audit History" },
  { pathIncludes: "/admin/document-templates", grantKey: "admin.card.documentTemplates", areaKey: "admin_cards", label: "Document Templates" },
  { pathIncludes: "/admin/templates", grantKey: "admin.card.documentTemplates", areaKey: "admin_cards", label: "Document Templates" },
  { pathIncludes: "/admin/reference", grantKey: "admin.card.referenceData", areaKey: "admin_cards", label: "Reference Data" },
  { pathIncludes: "/admin/claim", grantKey: "admin.card.claimIndex", areaKey: "admin_cards", label: "ClaimIndex" },
  { pathIncludes: "/admin/tickler", grantKey: "admin.card.ticklers", areaKey: "admin_cards", label: "Ticklers" },
  { pathIncludes: "/admin/client", grantKey: "admin.card.clientsBilling", areaKey: "admin_cards", label: "Clients / Billing" },
  { pathIncludes: "/admin/billing", grantKey: "admin.card.clientsBilling", areaKey: "admin_cards", label: "Clients / Billing" },
  { pathIncludes: "/admin/backup", grantKey: "admin.card.backupRestore", areaKey: "admin_cards", label: "Backup / Restore" },
  { pathIncludes: "/admin/readiness", grantKey: "admin.card.readinessDashboard", areaKey: "admin_cards", label: "Readiness Dashboard" },
  { pathIncludes: "/admin/document-readiness", grantKey: "admin.card.documentReadiness", areaKey: "admin_cards", label: "Document Readiness" },
  { pathIncludes: "/admin/lawsuit-cleanup", grantKey: "admin.card.lawsuitCleanup", areaKey: "admin_cards", label: "Lawsuit Cleanup" },
] as const;

export const ADMIN_USERS_PHASE_W2_PAYMENT_PATH_MARKERS = [
  "billing",
  "payment",
  "payments",
  "invoice",
  "invoices",
  "void",
  "remittance",
  "settlement-payment",
  "settlement_status",
  "settlement-status",
] as const;

export const ADMIN_USERS_PHASE_W2_GENERATION_PATH_MARKERS = [
  "generate",
  "generation",
  "document-generation",
  "finalize",
  "finalization",
  "upload",
  "clio",
  "print-queue",
  "maildrop",
] as const;

export const ADMIN_USERS_PHASE_W2_MUTATION_TEXT_MARKERS = [
  "export async function POST",
  "export async function PUT",
  "export async function PATCH",
  "export async function DELETE",
  "prisma.",
  ".create(",
  ".update(",
  ".delete(",
  ".upsert(",
  ".createMany(",
  ".updateMany(",
  ".deleteMany(",
  "formAction",
  "onSubmit",
  "fetch(",
] as const;

export function adminUsersPhaseW2NormalizePath(path: string): string {
  return String(path || "").replaceAll("\\\\", "/");
}

export function adminUsersPhaseW2FileKind(path: string): AdminUsersPhaseW2FileKind {
  const clean = adminUsersPhaseW2NormalizePath(path);
  if (clean.endsWith("/page.tsx") || clean.endsWith("/page.ts")) return "page";
  if (clean.endsWith("/route.ts") || clean.endsWith("/route.tsx")) return "api_route";
  if (clean.endsWith("/layout.tsx") || clean.endsWith("/layout.ts")) return "layout";
  if (clean.includes("/actions/") || clean.endsWith("actions.ts") || clean.endsWith("actions.tsx")) return "server_action";
  return "component_or_other";
}

export function adminUsersPhaseW2InferArea(path: string): AdminUsersPhaseW1AreaKey {
  const clean = adminUsersPhaseW2NormalizePath(path).toLowerCase();

  if (clean.includes("/admin/")) return "admin_screen";
  if (clean.includes("billing") || clean.includes("invoice") || clean.includes("payment")) return "client_billing_payments";
  if (clean.includes("settlement") && clean.includes("payment")) return "settlement_payment_status";
  if (clean.includes("lawsuit")) return "lawsuits";
  if (clean.includes("matter") || clean.includes("claim")) return "individual_matters";
  if (clean.includes("document") || clean.includes("template")) return "documents";
  if (clean.includes("generate")) return "document_generation";
  if (clean.includes("print-queue") || clean.includes("print_queue")) return "print_queue";
  if (clean.includes("maildrop") || clean.includes("email")) return "maildrop_email";
  if (clean.includes("clio") || clean.includes("finalize") || clean.includes("finalization") || clean.includes("upload")) return "clio_storage_finalize";
  if (clean.includes("tickler")) return "ticklers_non_admin";
  if (clean.includes("report") || clean.includes("export")) return "reports_exports";

  return "home_dashboard";
}

export function adminUsersPhaseW2InferAdminCardGrantKey(path: string): string | null {
  const clean = adminUsersPhaseW2NormalizePath(path).toLowerCase();
  const matched = ADMIN_USERS_PHASE_W2_ADMIN_CARD_ROUTE_RULES.find((rule) => clean.includes(rule.pathIncludes));
  return matched?.grantKey || null;
}

export function adminUsersPhaseW2IsPaymentSensitive(path: string): boolean {
  const clean = adminUsersPhaseW2NormalizePath(path).toLowerCase();
  return ADMIN_USERS_PHASE_W2_PAYMENT_PATH_MARKERS.some((marker) => clean.includes(marker));
}

export function adminUsersPhaseW2InferOperationFamilies(path: string, sourceText = ""): AdminUsersPhaseW1OperationKey[] {
  const clean = adminUsersPhaseW2NormalizePath(path).toLowerCase();
  const text = sourceText || "";
  const operations = new Set<AdminUsersPhaseW1OperationKey>();

  operations.add("view");

  if (clean.includes("search") || text.includes("searchParams")) operations.add("search");
  if (clean.includes("generate") || text.includes("generate")) operations.add("generate");
  if (clean.includes("finalize") || clean.includes("finalization") || text.includes("finalize")) operations.add("finalize");
  if (clean.includes("upload") || text.includes("upload")) operations.add("upload");
  if (clean.includes("download") || text.includes("download")) operations.add("download");
  if (clean.includes("print") || text.includes("print")) operations.add("print");
  if (clean.includes("email") || clean.includes("maildrop") || text.includes("sendEmail")) operations.add("email");
  if (adminUsersPhaseW2IsPaymentSensitive(path)) operations.add("payment_manage");
  if (clean.includes("/admin/")) operations.add("admin_manage");

  if (
    text.includes("export async function POST") ||
    text.includes(".create(") ||
    text.includes(".createMany(")
  ) {
    operations.add("create");
  }

  if (
    text.includes("export async function POST") ||
    text.includes("export async function PUT") ||
    text.includes("export async function PATCH") ||
    text.includes(".create(") ||
    text.includes(".update(") ||
    text.includes(".upsert(") ||
    text.includes(".createMany(") ||
    text.includes(".updateMany(") ||
    text.includes("formAction") ||
    text.includes("onSubmit")
  ) {
    operations.add("edit");
  }

  if (text.includes("export async function DELETE") || text.includes(".delete(") || text.includes(".deleteMany(")) {
    operations.add("delete");
  }

  if (clean.includes("archive") || text.includes("archive")) operations.add("archive");
  if (clean.includes("void") || text.includes("void")) operations.add("void");
  if (clean.includes("run") || text.includes("run")) operations.add("run");

  return Array.from(operations);
}

export function adminUsersPhaseW2ClassifyPath(path: string, sourceText = ""): AdminUsersPhaseW2Classification {
  const clean = adminUsersPhaseW2NormalizePath(path);
  const fileKind = adminUsersPhaseW2FileKind(clean);
  const adminCardGrantKey = adminUsersPhaseW2InferAdminCardGrantKey(clean);
  const adminOnly = clean.toLowerCase().includes("/admin/");
  const paymentSensitive = adminUsersPhaseW2IsPaymentSensitive(clean);
  const areaKey = adminOnly && adminCardGrantKey ? "admin_cards" : adminUsersPhaseW2InferArea(clean);

  return {
    path: clean,
    fileKind,
    areaKey,
    operationFamilies: adminUsersPhaseW2InferOperationFamilies(clean, sourceText),
    paymentSensitive,
    adminOnly,
    adminCardGrantKey,
    enforcementActive: false,
    uiHidingActive: false,
    notes: [
      "Phase W2 is classification only.",
      "No route guard, UI hiding, or permission enforcement is activated by this classifier.",
    ],
  };
}
