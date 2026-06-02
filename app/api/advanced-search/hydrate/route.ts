import { legacyClioOperationalRouteBlocked } from "@/lib/legacyClioOperationalRouteBlocked";

export async function POST() {
  return legacyClioOperationalRouteBlocked("app/api/advanced-search/hydrate");
}
