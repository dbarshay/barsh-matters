import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { configuredAdminPermissionsEnforcementEnabled } from "@/lib/adminPermissions";
import { ADMIN_ROLE_PLANNING_DEFINITIONS, ADMIN_USER_PLANNING_ROWS, adminRolePlanningSummary, effectiveAdminUserPlanningRows } from "@/lib/adminUsersPlanning";

export const dynamic = "force-dynamic";

export async function GET() {
  const [dbUsers, dbRoles, dbRolePermissions, dbUserRoles, dbUserPermissionOverrides] = await Promise.all([
    prisma.adminUser.findMany({ orderBy: [{ email: "asc" }], take: 200, include: { roles: { include: { role: true } }, permissionOverrides: true } }),
    prisma.adminRole.findMany({ orderBy: [{ key: "asc" }], take: 200, include: { permissions: true } }),
    prisma.adminRolePermission.count(),
    prisma.adminUserRole.count(),
    prisma.adminUserPermissionOverride.count(),
  ]);

  return NextResponse.json({
    action: "admin-users-roles-planning-read-only",
    mode: "db-preview-plus-planning",
    enforcementEnabled: configuredAdminPermissionsEnforcementEnabled(),
    note: "Read-only Phase 2 planning surface. This endpoint reads DB-backed admin user/role tables for preview only. It does not create users, edit roles, assign permissions, write database records, write Clio, or enable enforcement.",
    databasePreview: {
      readOnly: true,
      userCount: dbUsers.length,
      roleCount: dbRoles.length,
      rolePermissionCount: dbRolePermissions,
      userRoleCount: dbUserRoles,
      userPermissionOverrideCount: dbUserPermissionOverrides,
      users: dbUsers.map((user: any) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        bootstrapSafe: user.bootstrapSafe,
        roleKeys: user.roles.map((entry: any) => entry.role.key).sort(),
        explicitOverrides: user.permissionOverrides.map((entry: any) => ({ permissionKey: entry.permissionKey, action: entry.action, reason: entry.reason })).sort((a: any, b: any) => a.permissionKey.localeCompare(b.permissionKey)),
      })),
      roles: dbRoles.map((role: any) => ({
        id: role.id,
        key: role.key,
        label: role.label,
        description: role.description,
        status: role.status,
        systemRole: role.systemRole,
        permissionKeys: role.permissions.map((entry: any) => entry.permissionKey).sort(),
      })),
    },
    planningRoleCount: ADMIN_ROLE_PLANNING_DEFINITIONS.length,
    planningUserCount: ADMIN_USER_PLANNING_ROWS.length,
    roles: adminRolePlanningSummary(),
    users: effectiveAdminUserPlanningRows(),
  });
}
