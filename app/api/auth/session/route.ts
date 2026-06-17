import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { allAdminPermissionKeys, configuredAdminPermissionOverridesFromEnv } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authenticated = isAdminRequestAuthorized(req);
  const permissions = authenticated ? allAdminPermissionKeys() : [];
  const permissionOverrideConfig = configuredAdminPermissionOverridesFromEnv();

  return NextResponse.json({
    ok: true,
    action: "auth-session",
    authenticated,
    authorized: authenticated,
    user: authenticated
      ? {
          role: "admin",
          displayName: "Administrator",
        }
      : null,
    permissions,
    permissionsMode: "default-admin-allow-all",
    permissionsEnforced: false,
    permissionOverrideConfig,
    twoFactorRequired: false,
    twoFactorMethod: null,
    twoFactorPlanned: "SMS or phone push 2FA is planned for a later auth phase.",
  });
}
