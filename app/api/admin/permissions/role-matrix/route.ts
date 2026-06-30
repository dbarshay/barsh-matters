import { NextResponse } from "next/server";

import {
  getAdminPermissionRoleMatrix,
  getAllowedPermissionKeysForRole,
  getBlockedPermissionKeysForRole,
  ADMIN_PERMISSION_ROLE_KEYS,
  ADMIN_PERMISSION_ROLE_LABELS,
  ADMIN_ROLE_ALLOWED_TIERS,
} from "@/lib/admin-permissions/roleMatrix";

export const runtime = "nodejs";

export async function GET() {
  const matrix = getAdminPermissionRoleMatrix();

  const roles = ADMIN_PERMISSION_ROLE_KEYS.map((roleKey) => ({
    roleKey,
    label: ADMIN_PERMISSION_ROLE_LABELS[roleKey],
    allowedTiers: ADMIN_ROLE_ALLOWED_TIERS[roleKey],
    allowedPermissionKeys: getAllowedPermissionKeysForRole(roleKey),
    blockedPermissionKeys: getBlockedPermissionKeysForRole(roleKey),
  }));

  return NextResponse.json({
    ok: true,
    action: "admin-permissions-role-matrix",
    enforcementScope: "admin-functions-only",
    runtimeEnforcementChanged: false,
    matrixMode: "planning-only",
    roleKeys: ADMIN_PERMISSION_ROLE_KEYS,
    rowCount: matrix.length,
    roles,
    matrix,
  });
}
