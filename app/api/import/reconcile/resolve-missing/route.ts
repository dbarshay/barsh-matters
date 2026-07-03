import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseMoney } from "@/lib/import/parse";
import { missingStagedFields, EDITABLE_FIELDS } from "@/lib/import/validation";
import { REVIEW_READY, REVIEW_OPEN, HOLD_MISSING_FIELD } from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fix a missing_field held row: the operator supplies the missing values, which are PATCHED into the
// staged payload. If all required fields are now present the row becomes Ready to Commit; otherwise it
// stays open with an updated "still missing" reason. Touches only the ImportRow. Flag-gated.
//   { rowId, patch: { claim_number_raw?, patient_name?, carrier_raw?, provider_raw?, cic_number?,
//                     claim_amount?, dos_start?, dos_end? } }

const NUMERIC = new Set(EDITABLE_FIELDS.filter((f) => f.numeric).map((f) => f.key));
const ALLOWED = new Set(EDITABLE_FIELDS.map((f) => f.key));

export async function POST(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const rowId = String(body?.rowId || "").trim();
  const patch = (body?.patch ?? {}) as Record<string, unknown>;
  if (!rowId) return NextResponse.json({ ok: false, error: "rowId is required." }, { status: 400 });

  const row = await prisma.importRow.findUnique({
    where: { id: rowId },
    select: { outcome: true, holdReason: true, staged: true, batch: { select: { source: true } } },
  });
  if (!row || row.outcome !== "held" || row.holdReason !== HOLD_MISSING_FIELD) {
    return NextResponse.json({ ok: false, error: "Row is not a missing-field hold." }, { status: 400 });
  }

  const source = row.batch?.source ?? "dow";
  const staged = { ...((row.staged ?? {}) as Record<string, unknown>) };

  // Apply only allowed field patches; parse numeric fields; ignore blanks so we never wipe a value.
  for (const [key, raw] of Object.entries(patch)) {
    if (!ALLOWED.has(key)) continue;
    const val = String(raw ?? "").trim();
    if (!val) continue;
    staged[key] = NUMERIC.has(key) ? parseMoney(val) : val;
  }
  // Keep dos_end in sync if only a single date was provided.
  if (staged["dos_start"] && !staged["dos_end"]) staged["dos_end"] = staged["dos_start"];

  const stillMissing = missingStagedFields(staged, source);
  const ready = stillMissing.length === 0;

  await prisma.importRow.update({
    where: { id: rowId },
    data: {
      staged: staged as any,
      reviewStatus: ready ? REVIEW_READY : REVIEW_OPEN,
      reason: ready ? null : `Still missing: ${stillMissing.map((m) => m.label).join(", ")}.`,
    },
  });

  return NextResponse.json({ ok: true, rowId, ready, stillMissing });
}
