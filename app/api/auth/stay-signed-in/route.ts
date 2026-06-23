import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { ADMIN_USER_SESSION_RUNTIME_PHASE20 } from "@/src/lib/auth/admin-user-session-runtime-phase20";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StaySignedInBody = {
  email?: unknown;
};

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    return NextResponse.json({ ok: false, action: "admin-user-stay-signed-in", error: "Unauthorized." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as StaySignedInBody;
  const email = cleanEmail(body.email);
  if (!email) {
    return NextResponse.json({ ok: false, action: "admin-user-stay-signed-in", error: "Email is required." }, { status: 400 });
  }

  await prisma.adminUser.updateMany({
    where: { email, status: "active", locked: false, inactive: false },
    data: { lastLoginAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    action: "admin-user-stay-signed-in",
    email,
    sessionExtended: true,
    passwordRequired: false,
    twoFactorRequired: false,
    source: ADMIN_USER_SESSION_RUNTIME_PHASE20,
  });
}
