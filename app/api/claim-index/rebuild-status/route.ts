import { NextRequest } from "next/server";
import { GET as getLocalIndexStatus } from "../local-index-status/route";

// Deprecated compatibility shim.
// Keep this route read-only while any old caller may still request it.
// New code must use /api/claim-index/local-index-status.
// This shim delegates to local database status inspection only and performs no writes.
export async function GET(req: NextRequest) {
  return getLocalIndexStatus(req);
}
