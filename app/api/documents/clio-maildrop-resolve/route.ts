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

function normalizeBrl(value: unknown): string {
  const raw = clean(value).toUpperCase();
  if (!raw) return "";
  if (/^BRL\d+$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `BRL${raw}`;
  return raw;
}

async function searchMatterByDisplayNumber(displayNumber: string) {
  const normalized = normalizeBrl(displayNumber);
  if (!normalized) return null;

  const params = new URLSearchParams();
  params.set("query", normalized);
  params.set("limit", "10");
  params.set("fields", "id,display_number,description,maildrop_address");

  const res = await clioFetch(`/api/v4/matters.json?${params.toString()}`);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error?.message || json?.message || `Could not search Clio matter ${normalized}.`);
  }

  const matches = Array.isArray(json?.data) ? json.data : [];
  const exact = matches.find((matter: any) => clean(matter?.display_number).toUpperCase() === normalized);
  return exact || matches[0] || null;
}

async function readMatterMaildropById(matterId: number) {
  const fields = "id,display_number,description,maildrop_address";
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

  if (!res.ok) {
    throw new Error(`Could not read Clio matter ${matterId}: status ${res.status}; body ${bodyText || "(empty)"}`);
  }

  return json?.data || null;
}

async function resolveDirectMatter(url: URL) {
  const rawMatterId = clean(url.searchParams.get("matterId"));
  const rawDisplayNumber = clean(url.searchParams.get("displayNumber"));

  const normalizedDisplayNumber = normalizeBrl(rawDisplayNumber || rawMatterId);

  let matter: any = null;

  // Direct UI ids may be BRL30121, 30121, or a real Clio numeric id.  Five-digit BRL-style ids should be searched as display numbers.
  if (normalizedDisplayNumber && /^BRL\d+$/.test(normalizedDisplayNumber)) {
    matter = await searchMatterByDisplayNumber(normalizedDisplayNumber);
  }

  if (!matter) {
    const numericId = numberOrNull(rawMatterId);
    if (numericId) matter = await readMatterMaildropById(numericId);
  }

  if (!matter) {
    throw new Error(`Could not resolve direct matter Maildrop for ${rawDisplayNumber || rawMatterId || "(missing matter id)"}.`);
  }

  return matter;
}

async function resolveMasterMatter(url: URL) {
  const masterLawsuitId = clean(url.searchParams.get("masterLawsuitId")) || "2026.05.00001";

  const lawsuit = await prisma.lawsuit.findUnique({
    where: { masterLawsuitId },
    select: {
      masterLawsuitId: true,
      clioMasterMatterId: true,
      clioMasterDisplayNumber: true,
      clioMasterMatterDescription: true,
    },
  });

  if (!lawsuit?.clioMasterMatterId) {
    throw new Error(`No mapped Clio master matter found for ${masterLawsuitId}.`);
  }

  return await readMatterMaildropById(Number(lawsuit.clioMasterMatterId));
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const source = clean(url.searchParams.get("source")) || "direct_matter";

    const matter = source === "master_lawsuit"
      ? await resolveMasterMatter(url)
      : await resolveDirectMatter(url);

    const displayNumber = clean(matter?.display_number);
    const maildropEmail = clean(matter?.maildrop_address);

    if (!displayNumber) {
      throw new Error("Resolved Clio matter did not include a display number.");
    }

    if (!maildropEmail) {
      throw new Error(`Resolved Clio matter ${displayNumber} did not include maildrop_address.`);
    }

    return NextResponse.json({
      ok: true,
      action: "clio-maildrop-resolve",
      readOnly: true,
      clioRecordsChanged: false,
      databaseRecordsChanged: false,
      source,
      matter: {
        id: matter?.id ?? null,
        displayNumber,
        description: clean(matter?.description),
      },
      maildropField: "maildrop_address",
      maildropEmail,
      maildropLabel: `MailDrop- ${displayNumber}`,
      formattedCc: `MailDrop- ${displayNumber} <${maildropEmail}>`,
      note:
        "Read-only Maildrop resolver.  Direct matter delivery uses that matter's Maildrop.  Master lawsuit delivery uses the mapped Clio master matter's Maildrop.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "clio-maildrop-resolve",
        readOnly: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        error: error?.message || "Clio Maildrop resolve failed.",
      },
      { status: 500 }
    );
  }
}
