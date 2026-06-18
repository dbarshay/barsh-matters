import { NextResponse } from "next/server";

import {
  getAdminPermissionRoleMatrix,
  getReadOnlyAdminAllowedPermissionKeys,
  getReadOnlyAdminBlockedPermissionKeys,
} from "@/lib/admin-permissions/roleMatrix";

export const runtime = "nodejs";

export async function GET() {
  const matrix = getAdminPermissionRoleMatrix();

  return NextResponse.json({
    ok: true,
    action: "admin-permissions-role-matrix",
    phase: "15E",
    enforcementScope: "admin-functions-only",
    runtimeEnforcementChanged: false,
    matrixMode: "planning-only",
    roles: ["owner_admin", "read_only_admin"],
    rowCount: matrix.length,
    readOnlyAdminAllowedPermissionKeys: getReadOnlyAdminAllowedPermissionKeys(),
    readOnlyAdminBlockedPermissionKeys: getReadOnlyAdminBlockedPermissionKeys(),
    matrix,
  });
}
