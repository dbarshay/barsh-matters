import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { normalizeReferenceText } from "@/lib/referenceData";
import { resolveCarrier, REFERENCE_TYPE_CARRIER } from "@/lib/referenceResolution";
import { REVIEW_OPEN, REVIEW_READY, HOLD_CARRIER_UNMATCHED } from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GOVERNANCE-GATED carrier resolution for held rows. Unlike the patient dialog (which only touches
// the Patient master), this WRITES the reference registry (ReferenceEntity / ReferenceAlias), so it
// requires admin (Owner) authorization in addition to the import flag. Two modes:
//   - map to existing:  { carrierRaw, entityId }      -> adds an ALIAS carrierRaw -> existing carrier
//   - add new carrier:  { carrierRaw, newDisplayName } -> creates a new carrier (+ alias if raw differs)
// After the mapping exists, every OPEN carrier_unmatched held row whose carrier now resolves is
// flipped to "ready" (Ready to Commit). Because resolution is by alias/canonical name, ALL future
// imports of that raw carrier string will auto-normalize to the canonical carrier — no re-mapping.

export async function POST(req: NextRequest) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }
  // Registry writes are Owner-gated. (Attaches to the RBAC Owner role when RBAC activates.)
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  const body = await req.json().catch(() => ({}));
  const carrierRaw = String(body?.carrierRaw || "").trim();
  const entityId = String(body?.entityId || "").trim();
  const newDisplayName = String(body?.newDisplayName || "").trim();

  if (!carrierRaw) return NextResponse.json({ ok: false, error: "carrierRaw is required." }, { status: 400 });
  if (!entityId && !newDisplayName) {
    return NextResponse.json({ ok: false, error: "Provide entityId (map) or newDisplayName (add new)." }, { status: 400 });
  }

  let entity: { id: string; displayName: string } | null = null;

  if (entityId) {
    const found = await prisma.referenceEntity.findUnique({ where: { id: entityId }, select: { id: true, displayName: true, type: true } });
    if (!found || found.type !== REFERENCE_TYPE_CARRIER) {
      return NextResponse.json({ ok: false, error: "entityId is not a valid carrier." }, { status: 400 });
    }
    entity = { id: found.id, displayName: found.displayName };
  } else {
    // Create a new carrier entity (idempotent on type+normalizedName).
    const normalizedName = normalizeReferenceText(newDisplayName);
    entity = await prisma.referenceEntity.upsert({
      where: { type_normalizedName: { type: REFERENCE_TYPE_CARRIER, normalizedName } },
      update: { active: true },
      create: { type: REFERENCE_TYPE_CARRIER, displayName: newDisplayName, normalizedName, active: true, source: "import-reconcile" },
      select: { id: true, displayName: true },
    });
  }

  // Add an alias for the raw string (unless it already normalizes to the entity's own name).
  const normalizedAlias = normalizeReferenceText(carrierRaw);
  const entityNormalized = normalizeReferenceText(entity.displayName);
  if (normalizedAlias && normalizedAlias !== entityNormalized) {
    await prisma.referenceAlias
      .create({ data: { entityId: entity.id, alias: carrierRaw, normalizedAlias } })
      .catch((e: any) => {
        if (e?.code !== "P2002") throw e; // ignore "alias already exists"
      });
  }

  // Flip OPEN carrier holds that now resolve to "ready". Scope to this carrierRaw's normalized form.
  const openCarrierHolds = await prisma.importRow.findMany({
    where: { outcome: "held", holdReason: HOLD_CARRIER_UNMATCHED, reviewStatus: REVIEW_OPEN, batch: { is: { status: { not: "undone" } } } },
    select: { id: true, staged: true },
  });

  const nowResolvable: string[] = [];
  const resolveCache = new Map<string, boolean>();
  for (const row of openCarrierHolds) {
    const raw = String(((row.staged ?? {}) as Record<string, any>).carrier_raw ?? "");
    if (!raw) continue;
    if (normalizeReferenceText(raw) !== normalizedAlias) continue; // only this carrier group
    let ok = resolveCache.get(raw);
    if (ok === undefined) {
      const r = await resolveCarrier(raw);
      ok = r.status === "matched";
      resolveCache.set(raw, ok);
    }
    if (ok) nowResolvable.push(row.id);
  }

  if (nowResolvable.length) {
    await prisma.importRow.updateMany({ where: { id: { in: nowResolvable } }, data: { reviewStatus: REVIEW_READY } });
  }

  return NextResponse.json({ ok: true, entity, readied: nowResolvable.length });
}
