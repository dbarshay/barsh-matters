import { legacyClioOperationalRouteBlocked } from "@/lib/legacyClioOperationalRouteBlocked";

export async function POST() {
  return legacyClioOperationalRouteBlocked("app/api/documents/clio-master-matter-confirm");
}
