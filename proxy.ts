import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "barsh_admin_gate";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function configuredAdminSessionToken() {
  const configured = clean(process.env.BARSH_ADMIN_SESSION_TOKEN);
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") return "barsh-admin-dev-session";

  return "";
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const expectedToken = configuredAdminSessionToken();
  const actualToken = clean(req.cookies.get(ADMIN_COOKIE_NAME)?.value);

  if (expectedToken && actualToken === expectedToken) {
    return NextResponse.next();
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = "/";
  redirectUrl.searchParams.set("adminRequired", "1");
  redirectUrl.searchParams.set("from", pathname);

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
