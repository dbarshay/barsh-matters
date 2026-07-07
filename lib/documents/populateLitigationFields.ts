// Populate a litigation matter's Date Filed / Index Number from a scanned document — the ONE write
// the reference-value rule allows on an existing matter, and ONLY when the field is currently blank.
//
// Rules (from the operator):
//   - Scans never OVERRIDE existing reference values. This helper writes a lawsuit's Index Number
//     (indexAaaNumber) or Date Filed (lawsuitOptions.dateFiled) ONLY when that value is empty today.
//   - Applies at the LAWSUIT level (litigation lives on the lawsuit). A matter with no lawsuit is skipped.
//   - Best-effort: it must never fail the document filing.

type Db = { [k: string]: any };
function asDb(prisma: unknown): Db {
  return prisma as Db;
}

function blank(v: unknown): boolean {
  return v == null || String(v).trim() === "";
}

export type PopulateLitigationInput = {
  matterId: number;
  indexNumber?: string | null;
  dateFiled?: string | null;
  actorEmail?: string | null;
};

export type PopulateLitigationResult = {
  skipped: boolean;
  reason?: string;
  masterLawsuitId?: string | null;
  populated: { indexNumber?: string; dateFiled?: string };
};

/**
 * If the matter belongs to a lawsuit, fill the lawsuit's Index Number and/or Date Filed from the scan —
 * but only the fields that are blank today. Returns what (if anything) was populated. Never throws.
 */
export async function populateEmptyLawsuitLitigationFields(
  prisma: unknown,
  input: PopulateLitigationInput,
): Promise<PopulateLitigationResult> {
  const db = asDb(prisma);
  const populated: { indexNumber?: string; dateFiled?: string } = {};
  const idx = (input.indexNumber ?? "").trim();
  const filed = (input.dateFiled ?? "").trim();
  if (!idx && !filed) return { skipped: true, reason: "no-values", populated };

  try {
    // Resolve the matter's lawsuit.
    const ci = await db.claimIndex.findUnique({
      where: { matter_id: input.matterId },
      select: { master_lawsuit_id: true },
    });
    const masterLawsuitId: string | null = ci?.master_lawsuit_id ?? null;
    if (!masterLawsuitId) return { skipped: true, reason: "no-lawsuit", populated };

    const lawsuit = await db.lawsuit.findUnique({
      where: { masterLawsuitId },
      select: { indexAaaNumber: true, lawsuitOptions: true },
    });
    if (!lawsuit) return { skipped: true, reason: "lawsuit-not-found", masterLawsuitId, populated };

    const options =
      lawsuit.lawsuitOptions && typeof lawsuit.lawsuitOptions === "object"
        ? (lawsuit.lawsuitOptions as Record<string, any>)
        : {};

    const data: Record<string, any> = {};
    let nextOptions = options;

    // Index Number — only when the lawsuit has none.
    if (idx && blank(lawsuit.indexAaaNumber)) {
      data.indexAaaNumber = idx;
      nextOptions = { ...nextOptions, indexAaaNumber: idx };
      populated.indexNumber = idx;
    }
    // Date Filed — only when the lawsuit options have none.
    if (filed && blank(options.dateFiled)) {
      nextOptions = { ...nextOptions, dateFiled: filed };
      populated.dateFiled = filed;
    }

    if (!populated.indexNumber && !populated.dateFiled) {
      return { skipped: true, reason: "already-populated", masterLawsuitId, populated };
    }

    if (nextOptions !== options) {
      nextOptions = { ...nextOptions, source: "ocr-scan-populate-empty" };
      data.lawsuitOptions = nextOptions;
    }

    await db.lawsuit.update({ where: { masterLawsuitId }, data });

    // Audit (best-effort).
    try {
      const parts = [
        populated.indexNumber ? `Index Number = ${populated.indexNumber}` : "",
        populated.dateFiled ? `Date Filed = ${populated.dateFiled}` : "",
      ].filter(Boolean);
      await db.auditLog?.create?.({
        data: {
          action: "lawsuit.litigation-fields.populate-from-scan",
          summary: `Populated ${parts.join(" and ")} on lawsuit ${masterLawsuitId} from a scanned document (was blank).`,
          entityType: "lawsuit",
          masterLawsuitId,
          details: { matterId: input.matterId, populated },
          actorEmail: input.actorEmail ?? null,
        },
      });
    } catch {
      /* audit is best-effort */
    }

    return { skipped: false, masterLawsuitId, populated };
  } catch {
    return { skipped: true, reason: "error", populated };
  }
}
