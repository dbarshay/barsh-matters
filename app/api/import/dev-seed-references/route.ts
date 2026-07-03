import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { normalizeReferenceText } from "@/lib/referenceData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DEV/TEST helper (flag-gated): seed the Dow sample's carriers + the Suffolk provider so a Dow import
// produces "ready" rows. Everything is tagged source="dow-test-seed" for easy removal. POST to seed,
// DELETE to remove. Runs inside the app so it uses the configured Prisma client (Prisma 7 needs it).

const SOURCE = "dow-test-seed";
const CARRIERS = [
  "American Family Mutual Ins Co Auto",
  "Amica",
  "Erie Insurance",
  "Esurance Property and Casualty Ins Co",
  "Farmers Insurance (AUTO only)",
  "Geico NY",
  "Hartford Accident and Indemnity Company",
  "Intact Insurance - Auto (Fka One Beacon)",
  "Integon National Ins Co",
  "Liberty Mutual Auto",
  "National General Insurance Company",
  "Nationwide Auto DOI after 4/1/24",
  "Plymouth Rock",
  "Safeco auto only",
  "State Farm Auto",
  "Travelers Auto",
  "USAA",
  "Utica",
];
const PROVIDER = "Suffolk Physical Therapy & Chiropractic, PLLC";

async function upsertEntity(type: string, displayName: string) {
  const normalizedName = normalizeReferenceText(displayName);
  await prisma.referenceEntity.upsert({
    where: { type_normalizedName: { type, normalizedName } },
    update: { displayName, active: true, source: SOURCE },
    create: { type, displayName, normalizedName, active: true, source: SOURCE },
  });
}

export async function POST() {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  for (const c of CARRIERS) await upsertEntity("insurer_company", c);
  await upsertEntity("provider_client", PROVIDER);
  return NextResponse.json({ ok: true, seededCarriers: CARRIERS.length, provider: PROVIDER });
}

export async function DELETE() {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  const del = await prisma.referenceEntity.deleteMany({ where: { source: SOURCE } });
  return NextResponse.json({ ok: true, removed: del.count });
}
