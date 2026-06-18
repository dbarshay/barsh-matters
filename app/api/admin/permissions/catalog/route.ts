import { NextResponse } from "next/server";

import { getAdminPermissionCatalog, getAdminPermissionCatalogGroups } from "@/lib/admin-permissions/catalog";

export const runtime = "nodejs";

export async function GET() {
  const catalog = getAdminPermissionCatalog();
  const groups = getAdminPermissionCatalogGroups();

  return NextResponse.json({
    ok: true,
    action: "admin-permissions-catalog",
    phase: "15C",
    enforcementScope: "admin-functions-only",
    runtimeEnforcementChanged: false,
    catalogCount: catalog.length,
    groups,
    catalog,
  });
}
