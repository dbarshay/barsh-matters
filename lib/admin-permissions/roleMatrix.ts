import { ADMIN_PERMISSION_CATALOG } from "@/lib/admin-permissions/catalog";

export type AdminPermissionRoleKey = "owner_admin" | "read_only_admin";
export type AdminPermissionRoleDecision = "allow" | "block" | "not-configured";

export type AdminPermissionRoleMatrixRow = {
  roleKey: AdminPermissionRoleKey;
  permissionKey: string;
  decision: AdminPermissionRoleDecision;
  reason: string;
  enforcementStatus: "planning-only";
};

const READ_ONLY_ADMIN_ALLOWED = new Set([
  "matters.view",
  "lawsuits.view",
  "documents.view",
  "settlements.view",
  "courtCalendar.view",
  "printQueue.view",
  "claimIndex.search",
]);

const READ_ONLY_ADMIN_BLOCKED = new Set([
  "admin.access",
  "admin.users.manage",
  "admin.permissions.manage",
  "matters.edit",
  "matters.close",
  "matters.payments.post",
  "matters.payments.void",
  "lawsuits.create",
  "lawsuits.edit",
  "lawsuits.close",
  "lawsuits.payments.post",
  "lawsuits.payments.void",
  "documents.generate",
  "documents.finalize",
  "documents.printQueue.manage",
  "settlements.edit",
  "settlements.close",
  "settlements.void",
  "courtCalendar.edit",
  "printQueue.manage",
  "claimIndex.rebuild",
]);

export const ADMIN_PERMISSION_ROLE_MATRIX: AdminPermissionRoleMatrixRow[] = ADMIN_PERMISSION_CATALOG.flatMap((permission) => {
  const ownerRow: AdminPermissionRoleMatrixRow = {
    roleKey: "owner_admin",
    permissionKey: permission.key,
    decision: "allow",
    reason: "Owner/admin baseline has full administrator authority.",
    enforcementStatus: "planning-only",
  };

  let readOnlyDecision: AdminPermissionRoleDecision = "not-configured";
  let readOnlyReason = "Not yet configured for read_only_admin.";

  if (READ_ONLY_ADMIN_ALLOWED.has(permission.key)) {
    readOnlyDecision = "allow";
    readOnlyReason = "Read-only operational access planned for Jane Doe / read_only_admin.";
  } else if (READ_ONLY_ADMIN_BLOCKED.has(permission.key)) {
    readOnlyDecision = "block";
    readOnlyReason = "Action/admin/financial/destructive access planned to be blocked for Jane Doe / read_only_admin.";
  }

  const readOnlyRow: AdminPermissionRoleMatrixRow = {
    roleKey: "read_only_admin",
    permissionKey: permission.key,
    decision: readOnlyDecision,
    reason: readOnlyReason,
    enforcementStatus: "planning-only",
  };

  return [ownerRow, readOnlyRow];
});

export function getAdminPermissionRoleMatrix() {
  return ADMIN_PERMISSION_ROLE_MATRIX;
}

export function getAdminPermissionRoleMatrixForRole(roleKey: AdminPermissionRoleKey) {
  return ADMIN_PERMISSION_ROLE_MATRIX.filter((row) => row.roleKey === roleKey);
}

export function getReadOnlyAdminAllowedPermissionKeys() {
  return Array.from(READ_ONLY_ADMIN_ALLOWED).sort();
}

export function getReadOnlyAdminBlockedPermissionKeys() {
  return Array.from(READ_ONLY_ADMIN_BLOCKED).sort();
}
