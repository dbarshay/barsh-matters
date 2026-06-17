import { NextResponse } from "next/server";
import { clearAdminGateCookie } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    ok: true,
    action: "auth-logout",
    authenticated: false,
    note: "Administrator session cleared.",
  });

  clearAdminGateCookie(response);

  return response;
}
