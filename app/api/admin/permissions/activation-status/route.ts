import { NextResponse } from "next/server";
import { phase20ActivationStatus } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    action: "admin-permissions-phase20-activation-status",
    ...phase20ActivationStatus(),
    note: "Read-only Phase 20 activation status. This endpoint does not enable enforcement, write configuration, edit users, expose passwords, impersonate users, call Clio, send email, generate documents, or change the print queue.",
  });
}
