import { ADMIN_PERMISSION_DEFINITIONS, allAdminPermissionKeys, type AdminPermissionKey } from "./adminPermissions";

export type AdminRolePlanningKey = "owner_admin" | "operations_admin" | "billing_admin" | "read_only_admin";

export type AdminRolePlanningDefinition = {
  key: AdminRolePlanningKey;
  label: string;
  description: string;
  permissionKeys: AdminPermissionKey[];
  writeCapable: boolean;
};

export type AdminUserPlanningRow = {
  email: string;
  displayName: string;
  plannedRoles: AdminRolePlanningKey[];
  explicitAllow: AdminPermissionKey[];
  explicitBlock: AdminPermissionKey[];
  source: "planning-only";
};

const invoicePermissions = ADMIN_PERMISSION_DEFINITIONS.filter((permission) => permission.key.startsWith("admin.invoices.")).map((permission) => permission.key);

const readOnlyPermissionKeys = ADMIN_PERMISSION_DEFINITIONS.filter((permission) => permission.key.endsWith(".view") || permission.key.endsWith(".audit") || permission.key === "admin.home.view").map((permission) => permission.key);

export const ADMIN_ROLE_PLANNING_DEFINITIONS: AdminRolePlanningDefinition[] = [
  {
    key: "owner_admin",
    label: "Owner Admin",
    description: "Planning role with every currently registered admin permission. This is intended for the system owner/bootstrap administrator only.",
    permissionKeys: allAdminPermissionKeys(),
    writeCapable: true,
  },
  {
    key: "operations_admin",
    label: "Operations Admin",
    description: "Planning role for day-to-day administrative operations, including client editing, tickler runs, cleanup confirmation, backups, and invoice workflow access.",
    permissionKeys: allAdminPermissionKeys().filter((permission) => permission !== "admin.backups.restorePreview"),
    writeCapable: true,
  },
  {
    key: "billing_admin",
    label: "Billing Admin",
    description: "Planning role focused on provider/client billing, invoice preview, invoice creation, finalization, voiding, and invoice history.",
    permissionKeys: Array.from(new Set<AdminPermissionKey>(["admin.home.view", "admin.clients.view", "admin.clients.edit", ...invoicePermissions])),
    writeCapable: true,
  },
  {
    key: "read_only_admin",
    label: "Read-Only Admin",
    description: "Planning role limited to read-only administrative visibility. It intentionally excludes create/finalize/void/run/confirm/restore/edit permissions.",
    permissionKeys: Array.from(new Set<AdminPermissionKey>(readOnlyPermissionKeys)),
    writeCapable: false,
  },
];

export const ADMIN_USER_PLANNING_ROWS: AdminUserPlanningRow[] = [
  {
    email: "dbarshay15@gmail.com",
    displayName: "Dav Bars",
    plannedRoles: ["owner_admin"],
    explicitAllow: [],
    explicitBlock: [],
    source: "planning-only",
  },
];

export function adminRolePlanningSummary() {
  return ADMIN_ROLE_PLANNING_DEFINITIONS.map((role) => ({
    key: role.key,
    label: role.label,
    description: role.description,
    permissionCount: role.permissionKeys.length,
    writeCapable: role.writeCapable,
    permissions: role.permissionKeys,
  }));
}

export function effectiveAdminUserPlanningRows() {
  const roleMap = new Map(ADMIN_ROLE_PLANNING_DEFINITIONS.map((role) => [role.key, role]));
  return ADMIN_USER_PLANNING_ROWS.map((user) => {
    const rolePermissions = user.plannedRoles.flatMap((roleKey) => roleMap.get(roleKey)?.permissionKeys || []);
    const allowedBeforeBlocks = new Set<AdminPermissionKey>([...rolePermissions, ...user.explicitAllow]);
    for (const blocked of user.explicitBlock) allowedBeforeBlocks.delete(blocked);
    return {
      ...user,
      effectivePermissions: Array.from(allowedBeforeBlocks).sort(),
      effectivePermissionCount: allowedBeforeBlocks.size,
      lockoutSafe: true,
      note: "Planning only. No database writes, no role assignment writes, and no production enforcement default changes.",
    };
  });
}
