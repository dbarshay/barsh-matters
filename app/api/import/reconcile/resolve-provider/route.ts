import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { normalizeReferenceText } from "@/lib/referenceData";
import { resolveProvider, REFERENCE_TYPE_PROVIDER } from "@/lib/referenceResolution";
import { REVIEW_OPEN, REVIEW_READY, HOLD_PROVIDER_UNMATCHED } from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GOVERNANCE-GATED provider resolution for held rows (Carisk resolves provider from the sheet). Like
// the carrier dialog, this WRITES the reference registry (ReferenceEntity / ReferenceAlias) and so
// requires admin (Owner) authorization plus the import flag. Two modes:
//   - assign alias: { providerRaw, entityId }       -> alias providerRaw -> existing approved provider
//   - add new:      { providerRaw, newDisplayName }  -> create a new provider (+ alias if raw differs)
// Afterward every OPEN provider_unmatched held row whose provider now resolves flips to "ready".
// Because resolution is by alias/canonical name, future imports auto-normalize the raw name — no re-map.

export async function POST(req: NextRequest) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  const body = await req.json().catch(() => ({}));
  const providerRaw = String(body?.providerRaw || "").trim();
  const entityId = String(body?.entityId || "").trim();
  const newDisplayName = String(body?.newDisplayName || "").trim();

  if (!providerRaw) return NextResponse.json({ ok: false, error: "providerRaw is required." }, { status: 400 });
  if (!entityId && !newDisplayName) {
    return NextResponse.json({ ok: false, error: "Provide entityId (assign alias) or newDisplayName (add new)." }, { status: 400 });
  }

  let entity: { id: string; displayName: string } | null = null;
  if (entityId) {
    const found = await prisma.referenceEntity.findUnique({ where: { id: entityId }, select: { id: true, displayName: true, type: true } });
    if (!found || found.type !== REFERENCE_TYPE_PROVIDER) {
      return NextResponse.json({ ok: false, error: "entityId is not a valid provider." }, { status: 400 });
    }
    entity = { id: found.id, displayName: found.displayName };
  } else {
    const normalizedName = normalizeReferenceText(newDisplayName);
    entity = await prisma.referenceEntity.upsert({
      where: { type_normalizedName: { type: REFERENCE_TYPE_PROVIDER, normalizedName } },
      update: { active: true },
      create: { type: REFERENCE_TYPE_PROVIDER, displayName: newDisplayName, normalizedName, active: true, source: "import-reconcile" },
      select: { id: true, displayName: true },
    });
  }

  const normalizedAlias = normalizeReferenceText(providerRaw);
  const entityNormalized = normalizeReferenceText(entity.displayName);
  if (normalizedAlias && normalizedAlias !== entityNormalized) {
    await prisma.referenceAlias
      .create({ data: { entityId: entity.id, alias: providerRaw, normalizedAlias } })
      .catch((e: any) => {
        if (e?.code !== "P2002") throw e;
      });
  }

  const openProviderHolds = await prisma.importRow.findMany({
    where: { outcome: "held", holdReason: HOLD_PROVIDER_UNMATCHED, reviewStatus: REVIEW_OPEN, batch: { is: { status: { not: "undone" } } } },
    select: { id: true, staged: true },
  });
  const nowResolvable: string[] = [];
  const cache = new Map<string, boolean>();
  for (const row of openProviderHolds) {
    const raw = String(((row.staged ?? {}) as Record<string, any>).provider_raw ?? "");
    if (!raw || normalizeReferenceText(raw) !== normalizedAlias) continue;
    let ok = cache.get(raw);
    if (ok === undefined) { ok = (await resolveProvider(raw)).status === "matched"; cache.set(raw, ok); }
    if (ok) nowResolvable.push(row.id);
  }
  if (nowResolvable.length) {
    await prisma.importRow.updateMany({ where: { id: { in: nowResolvable } }, data: { reviewStatus: REVIEW_READY } });
  }

  return NextResponse.json({ ok: true, entity, readied: nowResolvable.length });
}
