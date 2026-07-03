import { prisma } from "@/lib/prisma";
import { normalizeReferenceText, type ReferenceEntityType } from "@/lib/referenceData";

// Resolve an incoming carrier / provider / other reference string to a canonical ReferenceEntity,
// using EXACT normalized name or an EXACT ReferenceAlias — NEVER fuzzy matching.
//
// Why no fuzzy: canonical carrier names are dangerously similar (e.g., "... c/o Mitchell" variants),
// so a fuzzy match would silently mis-link. Instead: strip import noise, normalize (same function
// that produced the stored normalizedName/normalizedAlias), and match exactly. Anything unmatched is
// returned as "unmatched" for the OWNER to map (add an alias) or add a new entity — operators/imports
// never create registry entities. Mapping a variant adds an alias, so future imports auto-resolve.

export const REFERENCE_TYPE_CARRIER: ReferenceEntityType = "insurer_company";
export const REFERENCE_TYPE_PROVIDER: ReferenceEntityType = "provider_client";
export const REFERENCE_TYPE_SERVICE: ReferenceEntityType = "service_type";
export const REFERENCE_TYPE_DENIAL: ReferenceEntityType = "denial_reason";

/** Remove clearinghouse / routing noise before normalizing (e.g. "[Electronic]", "c/o Mitchell"). */
export function stripReferenceNoise(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\[[^\]]*\]/g, " ") // bracketed tags: [Electronic]
    .replace(/\bc\/o\b[^,;]*/gi, " ") // "c/o <clearinghouse>" routing
    .replace(/\bsingle payer id\b/gi, " ")
    .replace(/\bpayer id\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ReferenceResolution =
  | { status: "matched"; entityId: string; displayName: string; via: "name" | "alias" }
  | { status: "unmatched"; normalizedTried: string[] };

/**
 * Resolve `rawName` to a canonical ReferenceEntity of the given `type`. Exact match only.
 * Tries the noise-stripped form and the raw form; matches on canonical normalizedName, then alias.
 */
export async function resolveReferenceEntity(
  rawName: unknown,
  type: ReferenceEntityType
): Promise<ReferenceResolution> {
  const normalized = Array.from(
    new Set(
      [stripReferenceNoise(rawName), String(rawName ?? "")]
        .map((c) => normalizeReferenceText(c))
        .filter((c) => c.length > 0)
    )
  );
  if (normalized.length === 0) return { status: "unmatched", normalizedTried: [] };

  // 1) exact canonical name
  const byName = await prisma.referenceEntity.findFirst({
    where: { type, active: true, normalizedName: { in: normalized } },
    select: { id: true, displayName: true },
  });
  if (byName) {
    return { status: "matched", entityId: byName.id, displayName: byName.displayName, via: "name" };
  }

  // 2) exact alias
  const byAlias = await prisma.referenceAlias.findFirst({
    where: { normalizedAlias: { in: normalized }, entity: { is: { type, active: true } } },
    select: { entity: { select: { id: true, displayName: true } } },
  });
  if (byAlias?.entity) {
    return {
      status: "matched",
      entityId: byAlias.entity.id,
      displayName: byAlias.entity.displayName,
      via: "alias",
    };
  }

  return { status: "unmatched", normalizedTried: normalized };
}

export const resolveCarrier = (raw: unknown) => resolveReferenceEntity(raw, REFERENCE_TYPE_CARRIER);
export const resolveProvider = (raw: unknown) => resolveReferenceEntity(raw, REFERENCE_TYPE_PROVIDER);
