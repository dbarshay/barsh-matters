import { NextResponse } from "next/server";
import {
  ADMIN_PERMISSION_DEFINITIONS,
  ADMIN_ROUTE_PERMISSIONS,
  allAdminPermissionKeys,
  configuredAdminPermissionOverridesFromEnv,
  adminPermissionDryRunDecisions,
  adminRoutePermissionDryRunDecisions,
  configuredAdminPermissionsEnforcementEnabled,
  phase20ActivationStatus,
} from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    action: "admin-permissions-read-only",
    enforcementEnabled: configuredAdminPermissionsEnforcementEnabled(),
    mode: "default-admin-allow-all",
    note: "Read-only permissions registry. User-configurable allow/block enforcement is planned for a later phase.",
    permissions: ADMIN_PERMISSION_DEFINITIONS,
    permissionKeys: allAdminPermissionKeys(),
    routePermissions: ADMIN_ROUTE_PERMISSIONS,
    overrideConfig: configuredAdminPermissionOverridesFromEnv(),
    permissionDryRun: adminPermissionDryRunDecisions(),
    routeDryRun: adminRoutePermissionDryRunDecisions(),
    phase20Activation: phase20ActivationStatus(),
  });
}
