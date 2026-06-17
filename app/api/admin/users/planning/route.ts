import { NextResponse } from "next/server";
import { configuredAdminPermissionsEnforcementEnabled } from "@/lib/adminPermissions";
import { ADMIN_ROLE_PLANNING_DEFINITIONS, ADMIN_USER_PLANNING_ROWS, adminRolePlanningSummary, effectiveAdminUserPlanningRows } from "@/lib/adminUsersPlanning";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    action: "admin-users-roles-planning-read-only",
    mode: "planning-only",
    enforcementEnabled: configuredAdminPermissionsEnforcementEnabled(),
    note: "Read-only Phase 2 planning surface. This endpoint does not create users, edit roles, assign permissions, write database records, write Clio, or enable enforcement.",
    roleCount: ADMIN_ROLE_PLANNING_DEFINITIONS.length,
    userCount: ADMIN_USER_PLANNING_ROWS.length,
    roles: adminRolePlanningSummary(),
    users: effectiveAdminUserPlanningRows(),
  });
}
