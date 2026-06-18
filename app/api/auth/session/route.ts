import { NextRequest, NextResponse } from "next/server";
import { adminSessionIdentityDiagnostics, isAdminRequestAuthorized, setAdminGateCookie, setAdminIdentityCookie } from "@/lib/adminAuth";
import { allAdminPermissionKeys, configuredAdminPermissionOverridesFromEnv, adminPermissionDryRunDecisions, configuredAdminPermissionsEnforcementEnabled } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authenticated = isAdminRequestAuthorized(req);
  const identityDiagnostics = adminSessionIdentityDiagnostics(req);
  const permissions = authenticated ? allAdminPermissionKeys() : [];
  const permissionOverrideConfig = configuredAdminPermissionOverridesFromEnv();
  const permissionDryRun = authenticated ? adminPermissionDryRunDecisions(permissionOverrideConfig) : [];

  const response = NextResponse.json({
    ok: true,
    action: "auth-session",
    authenticated,
    authorized: authenticated,
    identityDiagnostics,
    user: authenticated
      ? {
          role: "admin",
          displayName: identityDiagnostics.username || "Administrator",
          id: identityDiagnostics.id,
          email: identityDiagnostics.email,
          username: identityDiagnostics.username,
          identityBound: identityDiagnostics.identityBound,
        }
      : null,
    permissions,
    permissionsMode: "default-admin-allow-all",
    permissionsEnforced: configuredAdminPermissionsEnforcementEnabled(),
    permissionOverrideConfig,
    permissionDryRun,
    twoFactorRequired: false,
    twoFactorMethod: null,
    twoFactorPlanned: "SMS/text push to the user’s cell phone is planned for a later auth phase.",
  });

  if (authenticated) {
    const identityCookieInput = identityDiagnostics.identityBound && identityDiagnostics.id && identityDiagnostics.email
      ? {
          id: identityDiagnostics.id,
          email: identityDiagnostics.email,
          username: identityDiagnostics.username,
        }
      : null;
    setAdminGateCookie(response, identityCookieInput);
    if (identityCookieInput) {
      setAdminIdentityCookie(response, identityCookieInput);
    }
  }

  return response;
}
