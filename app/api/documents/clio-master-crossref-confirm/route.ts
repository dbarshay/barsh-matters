import { legacyClioOperationalRouteBlocked } from "@/lib/legacyClioOperationalRouteBlocked";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return legacyClioOperationalRouteBlocked("legacy Clio master/child cross-reference confirm");
}

export async function GET() {
  return legacyClioOperationalRouteBlocked("legacy Clio master/child cross-reference confirm");
}
