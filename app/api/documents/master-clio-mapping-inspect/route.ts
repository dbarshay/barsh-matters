import { legacyClioOperationalRouteBlocked } from "@/lib/legacyClioOperationalRouteBlocked";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return legacyClioOperationalRouteBlocked("legacy Clio master mapping inspection");
}

export async function POST() {
  return legacyClioOperationalRouteBlocked("legacy Clio master mapping inspection");
}
