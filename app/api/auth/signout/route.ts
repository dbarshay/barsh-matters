import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_USER_SESSION_COOKIE_CANDIDATES_PHASE20,
  ADMIN_USER_SESSION_RUNTIME_PHASE20,
} from "@/src/lib/auth/admin-user-session-runtime-phase20";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignOutBody = {
  email?: unknown;
  reason?: unknown;
};

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function clearAdminSessionCookies(response: NextResponse) {
  for (const name of ADMIN_USER_SESSION_COOKIE_CANDIDATES_PHASE20) {
    response.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as SignOutBody;
  const email = cleanEmail(body.email);
  const reason = cleanString(body.reason) || "User signed out.";
  const authorized = isAdminRequestAuthorized(req);

  let signedOutUser = null;
  if (email) {
    signedOutUser = await prisma.adminUser.updateMany({
      where: { email },
      data: { lastSignOutAt: new Date(), sessionInvalidatedAt: new Date() },
    });
  }

  if (email && authorized) {
    await createMatterAuditLogEntry({
      action: "admin-user-signout",
      summary: `Admin user signed out: ${email}.`,
      entityType: "admin_user",
      fieldName: "AdminUser.sessionInvalidatedAt",
      priorValue: null,
      newValue: {
        email,
        reason,
        sessionInvalidated: true,
        lastSignOutAtUpdated: true,
        source: ADMIN_USER_SESSION_RUNTIME_PHASE20,
      },
    });
  }

  const response = NextResponse.json({
    ok: true,
    action: "admin-user-signout",
    email: email || null,
    authorized,
    updatedCount: signedOutUser?.count || 0,
    sessionInvalidated: true,
    cookiesCleared: true,
    redirectTo: "/login",
  });
  clearAdminSessionCookies(response);
  return response;
}

export async function GET(req: NextRequest) {
  const email = cleanEmail(req.nextUrl.searchParams.get("email"));
  const response = NextResponse.redirect(new URL("/login", req.url));
  clearAdminSessionCookies(response);
  if (email) {
    await prisma.adminUser.updateMany({
      where: { email },
      data: { lastSignOutAt: new Date(), sessionInvalidatedAt: new Date() },
    });
  }
  return response;
}
