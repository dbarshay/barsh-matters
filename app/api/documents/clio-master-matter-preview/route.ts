import { legacyClioOperationalRouteBlocked } from "@/lib/legacyClioOperationalRouteBlocked";

export async function GET() {
  return legacyClioOperationalRouteBlocked("app/api/documents/clio-master-matter-preview");
}

export async function POST() {
  return legacyClioOperationalRouteBlocked("app/api/documents/clio-master-matter-preview");
}
