import { legacyClioOperationalRouteBlocked } from "@/lib/legacyClioOperationalRouteBlocked";

export async function GET() {
  return legacyClioOperationalRouteBlocked("app/api/claim-index/rebuild");
}

export async function POST() {
  return legacyClioOperationalRouteBlocked("app/api/claim-index/rebuild");
}
