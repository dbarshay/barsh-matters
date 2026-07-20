import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_IDENTITY_COOKIE_NAME,
  isAdminRequestAuthorized,
  readSignedAdminIdentityCookie,
  type BoundAdminIdentityCookie,
} from "@/lib/adminAuth";
import { resolveAccess } from "@/lib/admin-permissions/resolveAccess";

const OWNER_ADMIN_EMAIL = (process.env.BARSH_OWNER_ADMIN_EMAIL || "dbarshay@brlfirm.com").trim().toLowerCase();

export type ReportsGate =
  | { ok: true; identity: BoundAdminIdentityCookie | null; isOwner: boolean }
  | { ok: false; response: NextResponse };

export function computeIsOwner(identity: BoundAdminIdentityCookie | null): boolean {
  if (!identity) return false;
  const roleKeys = Array.isArray(identity.roleKeys) ? identity.roleKeys : [];
  return identity.email === OWNER_ADMIN_EMAIL || roleKeys.includes("owner_admin") || roleKeys.includes("owner");
}

export function reportOwnerId(identity: BoundAdminIdentityCookie | null): string {
  return (identity?.id || identity?.email || "").trim();
}

export function gateReports(req: NextRequest, method = "GET"): ReportsGate {
  if (!isAdminRequestAuthorized(req)) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 }) };
  }
  const identity = readSignedAdminIdentityCookie(req.cookies.get(ADMIN_IDENTITY_COOKIE_NAME)?.value);
  const roleKeys = Array.isArray(identity?.roleKeys) ? identity!.roleKeys : [];
  const isOwner = computeIsOwner(identity);
  const decision = resolveAccess({
    isOwner,
    roleKeys,
    grantedAdminPermissionKeys: identity?.grantedAdminPermissionKeys,
    pathname: "/admin/reports",
    method,
  });
  if (!decision.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "You do not have the Reports permission.", reason: decision.reason },
        { status: 403 },
      ),
    };
  }
  return { ok: true, identity: identity || null, isOwner };
}
