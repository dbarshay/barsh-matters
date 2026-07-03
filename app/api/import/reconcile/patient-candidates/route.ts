import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { resolvePatient, patientMatchKey } from "@/lib/patientResolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY patient candidate lookup for the patient-ambiguous reconcile dialog. Given a held rowId
// (uses its staged patient name) or a free-text ?q= search, returns matching existing patients so the
// operator can LINK to one or choose CREATE NEW. Each candidate carries its DATE(S) OF LOSS (from that
// patient's matters) so the operator can tell two same-named people apart. Flag-gated.

/** Attach each candidate patient's distinct date(s) of loss (for same-name disambiguation). */
async function withDatesOfLoss<T extends { id: string }>(candidates: T[]): Promise<(T & { dol: string })[]> {
  const ids = candidates.map((c) => c.id);
  if (!ids.length) return candidates.map((c) => ({ ...c, dol: "" }));
  const matters = await prisma.claimIndex.findMany({
    where: { patient_id: { in: ids }, date_of_loss: { not: null } },
    select: { patient_id: true, date_of_loss: true },
  });
  const byPatient = new Map<string, Set<string>>();
  for (const m of matters) {
    if (!m.patient_id || !m.date_of_loss) continue;
    if (!byPatient.has(m.patient_id)) byPatient.set(m.patient_id, new Set());
    byPatient.get(m.patient_id)!.add(m.date_of_loss);
  }
  return candidates.map((c) => ({
    ...c,
    dol: Array.from(byPatient.get(c.id) ?? []).sort().reverse().join(", "),
  }));
}

export async function GET(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const url = new URL(request.url);
  const rowId = url.searchParams.get("rowId") || "";
  const q = (url.searchParams.get("q") || "").trim();

  let stagedName = "";
  if (rowId) {
    const row = await prisma.importRow.findUnique({ where: { id: rowId }, select: { staged: true } });
    stagedName = String(((row?.staged ?? {}) as Record<string, any>).patient_name ?? "");
  }

  // If a free-text query is given, search by it; otherwise use the staged name's suggestions.
  if (q) {
    const key = patientMatchKey(q);
    const matches = await prisma.patient.findMany({
      where: { normalizedName: { contains: key.split(" ").filter(Boolean).slice(-1)[0] || key } },
      select: { id: true, name: true },
      take: 25,
    });
    const candidates = await withDatesOfLoss(matches.map((m) => ({ ...m, kind: "search" })));
    return NextResponse.json({ ok: true, stagedName, candidates });
  }

  if (!stagedName) return NextResponse.json({ ok: true, stagedName: "", candidates: [] });

  const res = await resolvePatient(stagedName);
  const candidates = res.status === "suggest" ? await withDatesOfLoss(res.candidates) : [];
  return NextResponse.json({ ok: true, stagedName, candidates });
}
