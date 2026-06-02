import { legacyClioOperationalRouteBlocked } from "@/lib/legacyClioOperationalRouteBlocked";

export async function POST() {
  return legacyClioOperationalRouteBlocked("app/api/aggregation/from-search");
}
