import { legacyClioOperationalRouteBlocked } from "@/lib/legacyClioOperationalRouteBlocked";

export async function GET() {
  return legacyClioOperationalRouteBlocked("app/api/aggregation/find-siblings");
}
