import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "barsh_admin_gate";
export const ADMIN_IDENTITY_COOKIE_NAME = "barsh_admin_identity";
export const ADMIN_AUTHORIZE_PATH = "/api/admin/authorize";

export type ConfiguredAdminPassword = { password: string; configured: boolean; devFallback: boolean; };
export type AdminIdentityCookieInput = { id: string; email: string; username: string | null; };
export type BoundAdminIdentityCookie = AdminIdentityCookieInput & { issuedAt: number; source: "owner-username-password"; };
export type AdminSessionIdentityDiagnostics = { authenticated: boolean; identityBound: boolean; id: string | null; email: string | null; username: string | null; source: "none" | "signed-cookie"; legacyGenericAdminSession: boolean; plannedIdentityCookieName: typeof ADMIN_IDENTITY_COOKIE_NAME; note: string; };

export function cleanAdminAuthValue(value: unknown): string { return String(value ?? "").trim(); }

export function configuredAdminPassword(): ConfiguredAdminPassword {
  const configured = cleanAdminAuthValue(process.env.BARSH_ADMIN_PASSWORD);
  if (configured) return { password: configured, configured: true, devFallback: false };
  if (process.env.NODE_ENV !== "production") return { password: "barsh-admin-dev", configured: false, devFallback: true };
  return { password: "", configured: false, devFallback: false };
}

export function configuredAdminSessionToken(): string {
  const configured = cleanAdminAuthValue(process.env.BARSH_ADMIN_SESSION_TOKEN);
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "barsh-admin-dev-session";
  return "";
}

export function safeAdminAction(value: unknown): string { return cleanAdminAuthValue(value).slice(0, 80) || "Administrator"; }
export function cleanAdminEmailValue(value: unknown): string { return cleanAdminAuthValue(value).toLowerCase(); }
export function isLikelyAdminEmail(value: unknown): boolean { const email = cleanAdminEmailValue(value); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function base64UrlEncode(value: string): string { return Buffer.from(value, "utf8").toString("base64url"); }
function base64UrlDecode(value: string): string { return Buffer.from(value, "base64url").toString("utf8"); }
function signAdminIdentityPayload(encodedPayload: string): string { const sessionToken = configuredAdminSessionToken(); if (!sessionToken) return ""; return createHmac("sha256", sessionToken).update(encodedPayload).digest("base64url"); }
function signaturesMatch(actual: string, expected: string): boolean { if (!actual || !expected) return false; const actualBuffer = Buffer.from(actual); const expectedBuffer = Buffer.from(expected); if (actualBuffer.length !== expectedBuffer.length) return false; return timingSafeEqual(actualBuffer, expectedBuffer); }

export function createAdminIdentityCookieValue(identity: AdminIdentityCookieInput): string {
  const payload: BoundAdminIdentityCookie = { id: cleanAdminAuthValue(identity.id), email: cleanAdminEmailValue(identity.email), username: cleanAdminAuthValue(identity.username) || null, issuedAt: Date.now(), source: "owner-username-password" };
  if (!payload.id || !isLikelyAdminEmail(payload.email)) return "";
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signAdminIdentityPayload(encodedPayload);
  if (!signature) return "";
  return `${encodedPayload}.${signature}`;
}

export function readSignedAdminIdentityCookie(value: unknown): BoundAdminIdentityCookie | null {
  const cookieValue = cleanAdminAuthValue(value);
  const [encodedPayload, signature, extra] = cookieValue.split(".");
  if (!encodedPayload || !signature || extra) return null;
  const expectedSignature = signAdminIdentityPayload(encodedPayload);
  if (!signaturesMatch(signature, expectedSignature)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as BoundAdminIdentityCookie;
    if (!parsed || parsed.source !== "owner-username-password") return null;
    if (!cleanAdminAuthValue(parsed.id)) return null;
    if (!isLikelyAdminEmail(parsed.email)) return null;
    return { id: cleanAdminAuthValue(parsed.id), email: cleanAdminEmailValue(parsed.email), username: cleanAdminAuthValue(parsed.username) || null, issuedAt: Number(parsed.issuedAt) || 0, source: "owner-username-password" };
  } catch { return null; }
}

export function adminSessionIdentityDiagnostics(req: NextRequest): AdminSessionIdentityDiagnostics {
  const authenticated = isAdminRequestAuthorized(req);
  const signedIdentity = authenticated ? readSignedAdminIdentityCookie(req.cookies.get(ADMIN_IDENTITY_COOKIE_NAME)?.value) : null;
  return {
    authenticated,
    identityBound: Boolean(signedIdentity),
    id: signedIdentity?.id || null,
    email: signedIdentity?.email || null,
    username: signedIdentity?.username || null,
    source: signedIdentity ? "signed-cookie" : "none",
    legacyGenericAdminSession: Boolean(authenticated && !signedIdentity),
    plannedIdentityCookieName: ADMIN_IDENTITY_COOKIE_NAME,
    note: signedIdentity ? "Session carries a signed AdminUser identity cookie. Phase 12H binds identity diagnostics to AdminUser.id but does not enforce per-user permissions yet." : "Current authenticated admin session remains generic. Per-user permission enforcement is not active yet.",
  };
}

export function isAdminRequestAuthorized(req: NextRequest): boolean { const expectedToken = configuredAdminSessionToken(); const actualToken = cleanAdminAuthValue(req.cookies.get(ADMIN_COOKIE_NAME)?.value); return Boolean(expectedToken && actualToken === expectedToken); }

export function setAdminGateCookie(response: NextResponse): void {
  const sessionToken = configuredAdminSessionToken();
  if (!sessionToken) return;
  response.cookies.set(ADMIN_COOKIE_NAME, sessionToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
}

export function setAdminIdentityCookie(response: NextResponse, identity: AdminIdentityCookieInput): void {
  const cookieValue = createAdminIdentityCookieValue(identity);
  if (!cookieValue) return;
  response.cookies.set(ADMIN_IDENTITY_COOKIE_NAME, cookieValue, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
}

export function clearAdminGateCookie(response: NextResponse): void { response.cookies.set(ADMIN_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 }); }
export function clearAdminIdentityCookie(response: NextResponse): void { response.cookies.set(ADMIN_IDENTITY_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 }); }

export function adminUnauthorizedJson(status = 401) {
  return NextResponse.json({ ok: false, action: "admin-proxy", authorized: false, error: "Administrator authorization required." }, { status });
}
