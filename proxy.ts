import { NextRequest, NextResponse } from "next/server";
import { ADMIN_AUTHORIZE_PATH, adminUnauthorizedJson, isAdminRequestAuthorized } from "@/lib/adminAuth";

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isAdminPageRequest = pathname.startsWith("/admin");
  const isAdminApiRequest = pathname.startsWith("/api/admin");

  if (!isAdminPageRequest && !isAdminApiRequest) {
    return NextResponse.next();
  }

  if (pathname === ADMIN_AUTHORIZE_PATH) {
    return NextResponse.next();
  }

  if (isAdminRequestAuthorized(req)) {
    return NextResponse.next();
  }

  if (isAdminApiRequest) {
    return adminUnauthorizedJson(401);
  }

  const redirectUrl = req.nextUrl.clone();
  const requestedPath = `${pathname}${req.nextUrl.search}`;
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("from", requestedPath);

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

