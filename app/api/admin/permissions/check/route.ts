import { NextRequest, NextResponse } from "next/server";
import { adminPermissionEnforcementDecision } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePath(value: string | null): string {
  const candidate = String(value || "").trim();
  if (candidate.startsWith("/admin") || candidate.startsWith("/api/admin")) return candidate;
  return "/admin";
}

function safeMethod(value: string | null): string {
  const candidate = String(value || "GET").trim().toUpperCase();
  return ["GET", "POST", "PATCH", "PUT", "DELETE"].includes(candidate) ? candidate : "GET";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const pathname = safePath(url.searchParams.get("path"));
  const method = safeMethod(url.searchParams.get("method"));
  const decision = adminPermissionEnforcementDecision(pathname, method);
  return NextResponse.json({
    ok: true,
    action: "admin-permission-check",
    pathname,
    method,
    decision,
    note: "Read-only permission decision check. This endpoint does not enforce blocking.",
  });
}
