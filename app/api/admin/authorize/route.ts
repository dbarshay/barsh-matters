import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_COOKIE_NAME = "barsh_admin_gate";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function configuredAdminPassword() {
  const configured = clean(process.env.BARSH_ADMIN_PASSWORD);
  if (configured) {
    return {
      password: configured,
      configured: true,
      devFallback: false,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    return {
      password: "barsh-admin-dev",
      configured: false,
      devFallback: true,
    };
  }

  return {
    password: "",
    configured: false,
    devFallback: false,
  };
}

function configuredAdminSessionToken() {
  const configured = clean(process.env.BARSH_ADMIN_SESSION_TOKEN);
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") return "barsh-admin-dev-session";

  return "";
}

function safeAction(value: unknown) {
  return clean(value).slice(0, 80) || "Administrator";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = clean(body?.password);
    const action = safeAction(body?.action);

    const adminPassword = configuredAdminPassword();
    const sessionToken = configuredAdminSessionToken();

    if (!adminPassword.password || !sessionToken) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-authorize",
          authorized: false,
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
          action: "admin-authorize",
          authorized: false,
          error: "Invalid administrator password.",
          passwordConfigured: adminPassword.configured,
          devFallback: adminPassword.devFallback,
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      action: "admin-authorize",
      authorized: true,
      adminAction: action,
      passwordConfigured: adminPassword.configured,
      devFallback: adminPassword.devFallback,
      note: adminPassword.devFallback
        ? "Development fallback password accepted.  Configure BARSH_ADMIN_PASSWORD for production."
        : "Administrator password accepted.",
    });

    response.cookies.set(ADMIN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "admin-authorize",
        authorized: false,
        error: error?.message || "Administrator authorization failed.",
      },
      { status: 500 }
    );
  }
}
