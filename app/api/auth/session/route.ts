import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authenticated = isAdminRequestAuthorized(req);

  return NextResponse.json({
    ok: true,
    action: "auth-session",
    authenticated,
    authorized: authenticated,
    user: authenticated
      ? {
          role: "admin",
          displayName: "Administrator",
        }
      : null,
    twoFactorRequired: false,
    twoFactorMethod: null,
    twoFactorPlanned: "SMS or phone push 2FA is planned for a later auth phase.",
  });
}
