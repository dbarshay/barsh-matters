import { ADMIN_PERMISSION_CATALOG, AdminPermissionTier } from "@/lib/admin-permissions/catalog";

// Reworked role model — see docs/permission-model.md.
//
// Five staff roles as a cumulative ladder, plus a separate Owner-only `security` tier:
//   View Only    = view
//   Partial User = view + edit
//   Full User    = view + edit + process
//   Administrator= view + edit + process + admin (admin = role ceiling; specific admin functions
//                  are granted per-user, narrowing the admin set). Never security.
//   Owner        = view + edit + process + admin (all) + security
//
// (Client Access is a separate, later-phase, per-provider read-only role — not in this matrix.)

export type AdminPermissionRoleKey = "owner" | "administrator" | "full_user" | "partial_user" | "view_only";
export type AdminPermissionRoleDecision = "allow" | "block";

export const ADMIN_PERMISSION_ROLE_KEYS: AdminPermissionRoleKey[] = [
  "owner",
  "administrator",
  "full_user",
  "partial_user",
  "view_only",
];

export const ADMIN_PERMISSION_ROLE_LABELS: Record<AdminPermissionRoleKey, string> = {
  owner: "Owner",
  administrator: "Administrator",
  full_user: "Full User",
  partial_user: "Partial User",
  view_only: "View Only",
};

// Tiers each role may use. `admin` for Administrator is the role ceiling; the specific admin
// functions an individual Administrator may use are granted per-user (which narrows this set).
// `security` (manage users/roles/permissions) is Owner-only.
export const ADMIN_ROLE_ALLOWED_TIERS: Record<AdminPermissionRoleKey, AdminPermissionTier[]> = {
  owner: ["view", "edit", "process", "admin", "security"],
  administrator: ["view", "edit", "process", "admin"],
  full_user: ["view", "edit", "process"],
  partial_user: ["view", "edit"],
  view_only: ["view"],
};

export type AdminPermissionRoleMatrixRow = {
  roleKey: AdminPermissionRoleKey;
  roleLabel: string;
  permissionKey: string;
  tier: AdminPermissionTier;
  decision: AdminPermissionRoleDecision;
  enforcementStatus: "planning-only";
};

export const ADMIN_PERMISSION_ROLE_MATRIX: AdminPermissionRoleMatrixRow[] = ADMIN_PERMISSION_ROLE_KEYS.flatMap((roleKey) => {
  const allowedTiers = new Set(ADMIN_ROLE_ALLOWED_TIERS[roleKey]);
  return ADMIN_PERMISSION_CATALOG.map((permission) => ({
    roleKey,
    roleLabel: ADMIN_PERMISSION_ROLE_LABELS[roleKey],
    permissionKey: permission.key,
    tier: permission.tier,
    decision: (allowedTiers.has(permission.tier) ? "allow" : "block") as AdminPermissionRoleDecision,
    enforcementStatus: "planning-only" as const,
  }));
});

export function isAdminPermissionRoleKey(value: string): value is AdminPermissionRoleKey {
  return (ADMIN_PERMISSION_ROLE_KEYS as string[]).includes(value);
}

export function roleAllowsTier(roleKey: AdminPermissionRoleKey, tier: AdminPermissionTier): boolean {
  return ADMIN_ROLE_ALLOWED_TIERS[roleKey]?.includes(tier) ?? false;
}

export function roleAllowsPermission(roleKey: AdminPermissionRoleKey, permissionKey: string): boolean {
  const item = ADMIN_PERMISSION_CATALOG.find((permission) => permission.key === permissionKey);
  if (!item) return false;
  return roleAllowsTier(roleKey, item.tier);
}

export function getAdminPermissionRoleMatrix() {
  return ADMIN_PERMISSION_ROLE_MATRIX;
}

export function getAdminPermissionRoleMatrixForRole(roleKey: AdminPermissionRoleKey) {
  return ADMIN_PERMISSION_ROLE_MATRIX.filter((row) => row.roleKey === roleKey);
}

export function getAllowedPermissionKeysForRole(roleKey: AdminPermissionRoleKey): string[] {
  return getAdminPermissionRoleMatrixForRole(roleKey)
    .filter((row) => row.decision === "allow")
    .map((row) => row.permissionKey)
    .sort();
}

export function getBlockedPermissionKeysForRole(roleKey: AdminPermissionRoleKey): string[] {
  return getAdminPermissionRoleMatrixForRole(roleKey)
    .filter((row) => row.decision === "block")
    .map((row) => row.permissionKey)
    .sort();
}
