import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { resolvePatient, patientMatchKey } from "@/lib/patientResolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY patient candidate lookup for the patient-ambiguous reconcile dialog. Given a held rowId
// (uses its staged patient name) or a free-text ?q= search, returns matching existing patients so the
// operator can LINK to one or choose CREATE NEW. Flag-gated.

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
    return NextResponse.json({ ok: true, stagedName, candidates: matches.map((m) => ({ ...m, kind: "search" })) });
  }

  if (!stagedName) return NextResponse.json({ ok: true, stagedName: "", candidates: [] });

  const res = await resolvePatient(stagedName);
  const candidates = res.status === "suggest" ? res.candidates : [];
  return NextResponse.json({ ok: true, stagedName, candidates });
}
