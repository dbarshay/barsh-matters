import { NextRequest, NextResponse } from "next/server";
import { clioFetch } from "@/lib/clio";
import { prisma } from "@/lib/prisma";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findMaildropCandidates(value: unknown, path = ""): Array<{ path: string; value: string }> {
  const results: Array<{ path: string; value: string }> = [];

  if (value == null) return results;

  if (typeof value === "string") {
    const lowerPath = path.toLowerCase();
    const lowerValue = value.toLowerCase();

    if (
      lowerPath.includes("maildrop") ||
      lowerPath.includes("mail_drop") ||
      lowerPath.includes("mail drop") ||
      lowerPath.includes("email") ||
      lowerPath.includes("communication") ||
      lowerValue.includes("maildrop") ||
      lowerValue.includes("@") ||
      lowerValue.includes("clio")
    ) {
      results.push({ path, value });
    }

    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      results.push(...findMaildropCandidates(item, `${path}[${index}]`));
    });
    return results;
  }

  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const nestedPath = path ? `${path}.${key}` : key;
      results.push(...findMaildropCandidates(nested, nestedPath));
    }
  }

  return results;
}

async function readClioMatterWithFields(matterId: number, fields: string) {
  const res = await clioFetch(
    `/api/v4/matters/${encodeURIComponent(String(matterId))}.json?fields=${encodeURIComponent(fields)}`
  );

  const bodyText = await res.text();
  let json: any = {};

  try {
    json = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    json = { raw: bodyText };
  }

  return {
    ok: res.ok,
    status: res.status,
    fields,
    data: json?.data || null,
    raw: json,
    error: res.ok ? "" : bodyText || json?.error || "Clio matter read failed.",
    maildropCandidates: findMaildropCandidates(json?.data || json),
  };
}

async function searchMatterByDisplayNumber(displayNumber: string) {
  const params = new URLSearchParams();
  params.set("query", displayNumber);
  params.set("limit", "5");
  params.set("fields", "id,display_number,description,client{id,name}");

  const res = await clioFetch(`/api/v4/matters.json?${params.toString()}`);
  const json = await res.json().catch(() => ({}));

  return {
    ok: res.ok,
    status: res.status,
    displayNumber,
    matches: Array.isArray(json?.data) ? json.data : [],
    raw: json,
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const masterLawsuitId = clean(url.searchParams.get("masterLawsuitId")) || "2026.05.00001";

    const lawsuit = await prisma.lawsuit.findUnique({
      where: { masterLawsuitId },
    });

    const matterIds = new Set<number>();

    for (const id of url.searchParams.getAll("matterId")) {
      const n = numberOrNull(id);
      if (n) matterIds.add(n);
    }

    for (const displayNumber of url.searchParams.getAll("displayNumber")) {
      const search = await searchMatterByDisplayNumber(displayNumber);
      for (const match of search.matches || []) {
        const id = numberOrNull(match?.id);
        if (id) matterIds.add(id);
      }
    }

    const mappedMasterMatterId = numberOrNull(lawsuit?.clioMasterMatterId);
    if (mappedMasterMatterId) matterIds.add(mappedMasterMatterId);

    const childRows = await prisma.claimIndex.findMany({
      where: { master_lawsuit_id: masterLawsuitId },
      select: {
        matter_id: true,
        display_number: true,
      },
      orderBy: { display_number: "asc" },
      take: 50,
    });

    for (const row of childRows) {
      const id = numberOrNull(row.matter_id);
      if (id) matterIds.add(id);
    }

    const fieldSets = [
      "id,display_number,description,client{id,name}",
      "id,display_number,description,maildrop_address",
      "id,display_number,description,maildrop",
      "id,display_number,description,maildrop_email",
      "id,display_number,description,email",
      "id,display_number,description,communications",
      "id,display_number,description,custom_field_values{id,value,custom_field}",
    ];

    const matterDetails = [];

    for (const matterId of matterIds) {
      const reads = [];
      for (const fields of fieldSets) {
        reads.push(await readClioMatterWithFields(matterId, fields));
      }

      matterDetails.push({
        matterId,
        reads,
        maildropCandidates: reads.flatMap((read) => read.maildropCandidates || []),
      });
    }

    return NextResponse.json({
      ok: true,
      action: "clio-maildrop-inspection",
      readOnly: true,
      clioRecordsChanged: false,
      databaseRecordsChanged: false,
      masterLawsuitId,
      mappedMasterMatter: lawsuit
        ? {
            clioMasterMatterId: lawsuit.clioMasterMatterId,
            clioMasterDisplayNumber: lawsuit.clioMasterDisplayNumber,
            clioMasterMatterDescription: lawsuit.clioMasterMatterDescription,
          }
        : null,
      childRows,
      matterIds: Array.from(matterIds),
      matterDetails,
      note:
        "Read-only Maildrop inspection.  This probes candidate Clio matter fields to determine how Clio exposes the matter Maildrop address for document delivery Cc.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "clio-maildrop-inspection",
        readOnly: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        error: error?.message || "Clio Maildrop inspection failed.",
      },
      { status: 500 }
    );
  }
}
