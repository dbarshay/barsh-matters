import { NextRequest, NextResponse } from "next/server";
import { resolveAccess, roleEnforcementEnabled } from "@/lib/admin-permissions/resolveAccess";
import { adminPermissionKeysForTier } from "@/lib/admin-permissions/catalog";

const ADMIN_COOKIE_NAME = "barsh_admin_gate";
const OWNER_ADMIN_EMAIL = "dbarshay15@gmail.com";

type SignedGatePayload = {
  token?: string;
  lastActivityAt?: number;
  source?: string;
  identity?: {
    id?: string;
    email?: string;
    username?: string | null;
    roleKeys?: string[];
    grantedAdminPermissionKeys?: string[];
  } | null;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function base64UrlDecodeText(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function configuredSessionToken(): string {
  const configured = clean(process.env.BARSH_ADMIN_SESSION_TOKEN);
  if (configured) return configured;
  // Dev fallback mirrors lib/adminAuth.ts so the middleware validates the same cookies the
  // app issues in development. In production an unset token yields "" → every cookie fails
  // (fail-closed), never a predictable token.
  if (process.env.NODE_ENV !== "production") return "barsh-admin-dev-session";
  return "";
}

async function signPayload(encodedPayload: string): Promise<string> {
  const token = configuredSessionToken();
  if (!token) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function readSignedGatePayload(value: string | undefined): Promise<SignedGatePayload | null> {
  const cookieValue = clean(value);
  if (!cookieValue || !cookieValue.includes(".")) return null;

  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await signPayload(encodedPayload);
  if (!expectedSignature || signature !== expectedSignature) return null;

  try {
    const parsed = JSON.parse(base64UrlDecodeText(encodedPayload)) as SignedGatePayload;
    if (!parsed || parsed.source !== "signed-gate") return null;
    if (parsed.token !== configuredSessionToken()) return null;
    if (!Number.isFinite(Number(parsed.lastActivityAt))) return null;

    const inactiveForMs = Date.now() - Number(parsed.lastActivityAt);
    if (inactiveForMs < 0) return null;
    if (inactiveForMs > 60 * 60 * 1000) return null;

    return parsed;
  } catch {
    return null;
  }
}

function isAdminSurface(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

function blockedResponse(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        ok: false,
        action: "role-access-enforcement",
        blocked: true,
        error: "You do not have permission to perform this action.",
      },
      { status: 403 }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("adminBlocked", "1");
  url.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function gateRoleKeys(gate: SignedGatePayload | null): string[] {
  return Array.isArray(gate?.identity?.roleKeys) ? gate.identity.roleKeys.map(clean) : [];
}

function gateIsOwner(gate: SignedGatePayload | null): boolean {
  const email = clean(gate?.identity?.email).toLowerCase();
  const roleKeys = gateRoleKeys(gate);
  return email === OWNER_ADMIN_EMAIL || roleKeys.includes("owner_admin") || roleKeys.includes("owner");
}

function decideByRole(gate: SignedGatePayload | null, req: NextRequest) {
  const roleKeys = gateRoleKeys(gate);

  // Per-card admin grants now ride in the signed identity. When present (any new cookie, even an
  // empty list), use them verbatim for true per-card enforcement. When ABSENT (a pre-deploy cookie
  // that predates this field), fall back to the previous all-or-nothing rule so an existing
  // Administrator session is not abruptly locked out — they regain per-card precision on next login.
  const cookieGrants = Array.isArray(gate?.identity?.grantedAdminPermissionKeys)
    ? gate.identity.grantedAdminPermissionKeys.map(clean)
    : null;
  const grantedAdminPermissionKeys =
    cookieGrants !== null
      ? cookieGrants
      : roleKeys.includes("administrator")
        ? adminPermissionKeysForTier("admin")
        : [];

  return resolveAccess({
    isOwner: false,
    roleKeys,
    grantedAdminPermissionKeys,
    pathname: req.nextUrl.pathname,
    method: req.method,
  });
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const adminSurface = isAdminSurface(pathname);
  const enforcement = roleEnforcementEnabled();

  // Operational (non-admin) surfaces are completely untouched unless enforcement is ON. With the
  // flag off (default), this proxy is a pure pass-through for everything except admin surfaces —
  // exactly as before.
  if (!adminSurface && !enforcement) return NextResponse.next();

  const gate = await readSignedGatePayload(req.cookies.get(ADMIN_COOKIE_NAME)?.value);

  if (adminSurface) {
    // No valid signed gate: fail CLOSED on admin surfaces (unchanged behavior).
    if (!gate) return blockedResponse(req);

    // Legacy/generic owner recovery sessions have no identity in the signed gate and remain allowed.
    const identityEmail = clean(gate.identity?.email).toLowerCase();
    if (!identityEmail) return NextResponse.next();

    const identityRoleKeys = Array.isArray(gate.identity?.roleKeys) ? gate.identity.roleKeys.map(clean) : [];
    if (
      identityEmail === OWNER_ADMIN_EMAIL ||
      identityRoleKeys.includes("owner_admin") ||
      identityRoleKeys.includes("owner")
    ) {
      return NextResponse.next();
    }

    // Role-based access is consulted only when enforcement is enabled. Flag off => non-owner blocked
    // on admin surfaces, exactly as before.
    if (enforcement && decideByRole(gate, req).allowed) return NextResponse.next();

    return blockedResponse(req);
  }

  // Operational surface with enforcement ON (we already returned for the flag-off case).
  if (gateIsOwner(gate)) return NextResponse.next();
  if (decideByRole(gate, req).allowed) return NextResponse.next();
  return blockedResponse(req);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    // Operational surfaces governed by the permission catalog. The proxy only ACTS on these when
    // BARSH_ROLE_ENFORCEMENT_ENABLED is on; otherwise it returns immediately (see proxy() above).
    "/matter/:path*",
    "/matters/:path*",
    "/lawsuits/:path*",
    "/court-calendar/:path*",
    "/print-queue/:path*",
    "/api/matters/:path*",
    "/api/lawsuits/:path*",
    "/api/documents/:path*",
    "/api/settlements/:path*",
    "/api/court-calendar/:path*",
    "/api/claim-index/:path*",
    "/api/aggregation/:path*",
    "/api/advanced-search/:path*",
  ],
};
