import { NextRequest, NextResponse } from "next/server";
import {
  cleanAdminAuthValue,
  configuredAdminPassword,
  configuredAdminSessionToken,
  safeAdminAction,
  setAdminGateCookie,
} from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeReturnTo(value: unknown): string {
  const candidate = cleanAdminAuthValue(value) || "/admin";
  if (candidate.startsWith("/admin")) return candidate;
  return "/admin";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = cleanAdminAuthValue(body?.password);
    const action = safeAdminAction(body?.action || "Login");
    const returnTo = safeReturnTo(body?.returnTo);

    const adminPassword = configuredAdminPassword();
    const sessionToken = configuredAdminSessionToken();

    if (!adminPassword.password || !sessionToken) {
      return NextResponse.json(
        {
          ok: false,
          action: "auth-login",
          authenticated: false,
          error: "Administrator password is not configured.  Set BARSH_ADMIN_PASSWORD and BARSH_ADMIN_SESSION_TOKEN.",
          passwordConfigured: adminPassword.configured,
          devFallback: false,
        },
        { status: 503 }
      );
    }

    if (!password || password !== adminPassword.password) {
      return NextResponse.json(
        {
          ok: false,
          action: "auth-login",
          authenticated: false,
          error: "Invalid administrator password.",
          passwordConfigured: adminPassword.configured,
          devFallback: adminPassword.devFallback,
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      action: "auth-login",
      authenticated: true,
      authorized: true,
      adminAction: action,
      returnTo,
      user: {
        role: "admin",
        displayName: "Administrator",
      },
      passwordConfigured: adminPassword.configured,
      devFallback: adminPassword.devFallback,
      twoFactorRequired: false,
      twoFactorMethod: null,
      twoFactorPlanned: "SMS or phone push 2FA is planned for a later auth phase.",
      note: adminPassword.devFallback
        ? "Development fallback password accepted.  Configure BARSH_ADMIN_PASSWORD for production."
        : "Administrator login accepted.",
    });

    setAdminGateCookie(response);

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "auth-login",
        authenticated: false,
        error: error?.message || "Administrator login failed.",
      },
      { status: 500 }
    );
  }
}
