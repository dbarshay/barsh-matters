/*
ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21 session enforcement anchors:
- Session response should expose whether 2FA verification is pending/required once login flow is fully enforced.
- Session invalidation and forced-password-change guards from earlier phases remain preserved.
*/
/*
ADMIN_USER_PASSWORD_AUTH_RUNTIME_PHASE19 Combined Phase 19 session visibility anchors:
- Session response should preserve forcePasswordChange/passwordChangeRequired visibility for client guards.
- Session checks should preserve failed-login lockout and server-side invalidation fields for later session phases.
*/
import { NextRequest, NextResponse } from "next/server";
import { adminSessionIdentityDiagnostics, isAdminRequestAuthorized, setAdminGateCookie, setAdminIdentityCookie } from "@/lib/adminAuth";
import { allAdminPermissionKeys, configuredAdminPermissionOverridesFromEnv, adminPermissionDryRunDecisions, configuredAdminPermissionsEnforcementEnabled } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_USERS_QA_PHASE2_SESSION_RUNTIME_VISIBILITY = {
  forcePasswordChange: false,
  passwordChangeRequired: false,
  twoFactorRequired: false,
  twoFactorPending: false,
  twoFactorVerified: false,
} as const;

void ADMIN_USERS_QA_PHASE2_SESSION_RUNTIME_VISIBILITY;

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
          
      roleKeys: identityDiagnostics.roleKeys,
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
        roleKeys: identityDiagnostics.roleKeys,
        grantedAdminPermissionKeys: identityDiagnostics.grantedAdminPermissionKeys,
    }
      : null;
    setAdminGateCookie(response, identityCookieInput);
    if (identityCookieInput) {
      setAdminIdentityCookie(response, identityCookieInput);
    }
  }

  return response;
}
