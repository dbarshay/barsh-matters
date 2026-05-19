import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clioFetch } from "@/lib/clio";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildClioMatterDescription(masterLawsuitId: string) {
  return `MASTER LAWSUIT - ${masterLawsuitId}`;
}

async function readClioMatterClient(matterId: number | string) {
  const id = Number(matterId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const fields = "id,display_number,client{id,name}";
  const res = await clioFetch(
    `/api/v4/matters/${encodeURIComponent(String(id))}.json?fields=${encodeURIComponent(fields)}`
  );

  const bodyText = await res.text();
  let json: any = {};
  try {
    json = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    json = { raw: bodyText };
  }

  if (!res.ok) {
    return {
      ok: false,
      matterId: id,
      error: `Could not read Clio matter client: status ${res.status}; body ${bodyText || "(empty)"}`,
    };
  }

  const matter = json?.data || {};
  const client = matter?.client || {};
  const clientId = Number(client?.id);

  if (!Number.isFinite(clientId) || clientId <= 0) {
    return {
      ok: false,
      matterId: id,
      displayNumber: clean(matter?.display_number),
      error: "Child Clio matter did not include a valid client id.",
    };
  }

  return {
    ok: true,
    matterId: id,
    displayNumber: clean(matter?.display_number),
    clientId,
    clientName: clean(client?.name),
  };
}

async function findClientFromChildClioMatters(rows: Array<{ matter_id: number | null; display_number?: string | null }>) {
  const candidates = rows
    .map((row) => ({
      matterId: Number(row.matter_id),
      displayNumber: clean(row.display_number),
    }))
    .filter((row) => Number.isFinite(row.matterId) && row.matterId > 0);

  const attempts = [];

  for (const candidate of candidates) {
    const result = await readClioMatterClient(candidate.matterId);
    attempts.push({
      candidate,
      result,
    });

    if (result?.ok && result.clientId) {
      return {
        ok: true,
        clientId: result.clientId,
        clientName: result.clientName,
        sourceMatterId: result.matterId,
        sourceDisplayNumber: result.displayNumber || candidate.displayNumber,
        attempts,
      };
    }
  }

  return {
    ok: false,
    clientId: null,
    clientName: "",
    sourceMatterId: null,
    sourceDisplayNumber: "",
    attempts,
    error: "No child Clio matter with a readable client was found.",
  };
}



function normalizeClioDisplayNumber(value: unknown): string {
  const raw = clean(value).toUpperCase();
  if (!raw) return "";
  if (/^BRL\d+$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `BRL${raw}`;
  return raw;
}

async function loadPreview(req: NextRequest, masterLawsuitId: string) {
  const previewUrl = new URL("/api/documents/clio-master-matter-preview", req.nextUrl.origin);
  previewUrl.searchParams.set("masterLawsuitId", masterLawsuitId);

  const res = await fetch(previewUrl.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Could not load Clio master matter preview.");
  }

  return json;
}

async function createClioMasterMatter(params: {
  masterLawsuitId: string;
  description: string;
  clientId: number;
}) {
  const fields = "id,display_number,description,status";

  const res = await clioFetch(`/api/v4/matters.json?fields=${encodeURIComponent(fields)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        description: params.description,
        client: { id: params.clientId },
        client_id: params.clientId,
      },
    }),
  });

  const bodyText = await res.text();
  let json: any = {};

  try {
    json = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    json = { raw: bodyText };
  }

  if (!res.ok) {
    throw new Error(
      `Failed to create Clio master matter: status ${res.status}; body ${bodyText || "(empty)"}`
    );
  }

  const matter = json?.data || null;
  const matterId = positiveNumber(matter?.id);
  const displayNumber = normalizeClioDisplayNumber(matter?.display_number);
  const description = clean(matter?.description);

  if (!matterId) {
    throw new Error("Clio created matter response did not include a valid matter id.");
  }

  if (!displayNumber) {
    throw new Error("Clio created matter response did not include a display number / BRL number.");
  }

  return {
    matter,
    matterId,
    displayNumber,
    description,
    raw: json,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json().catch(() => ({})));
    const masterLawsuitId = clean(body.masterLawsuitId) || "2026.05.00001";
    const typedConfirmation = clean(body.typedConfirmation);

    const requiredConfirmation = `CREATE CLIO MASTER ${masterLawsuitId}`;

    if (typedConfirmation !== requiredConfirmation) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-master-matter-create-confirm",
          requiresTypedConfirmation: true,
          requiredConfirmation,
          receivedConfirmation: typedConfirmation || null,
          createsClioMatter: false,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          error: `Type exactly: ${requiredConfirmation}`,
        },
        { status: 400 }
      );
    }

    const lawsuit = await prisma.lawsuit.findUnique({
      where: { masterLawsuitId },
    });

    if (!lawsuit) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-master-matter-create-confirm",
          createsClioMatter: false,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          error: `No local Lawsuit row found for ${masterLawsuitId}.`,
        },
        { status: 404 }
      );
    }

    if (lawsuit.clioMasterMatterId || clean(lawsuit.clioMasterDisplayNumber)) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-master-matter-create-confirm",
          createsClioMatter: false,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          existingMapping: {
            clioMasterMatterId: lawsuit.clioMasterMatterId,
            clioMasterDisplayNumber: lawsuit.clioMasterDisplayNumber,
            clioMasterMatterDescription: lawsuit.clioMasterMatterDescription,
            clioMasterMappedAt: lawsuit.clioMasterMappedAt,
          },
          error:
            "This local master lawsuit already has a Clio master matter mapping.  Refusing to create a duplicate Clio master matter.",
        },
        { status: 409 }
      );
    }

    const preview = await loadPreview(req, masterLawsuitId);
    const blockingWarnings = Array.isArray(preview?.blockingWarnings)
      ? preview.blockingWarnings
      : [];

    if (blockingWarnings.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-master-matter-create-confirm",
          createsClioMatter: false,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          blockingWarnings,
          error: "Clio master matter creation is blocked by preview warnings.",
        },
        { status: 409 }
      );
    }

    const claimIndexRows = await prisma.claimIndex.findMany({
      where: { master_lawsuit_id: masterLawsuitId },
      select: {
        matter_id: true,
        display_number: true,
      },
      orderBy: [{ display_number: "asc" }],
      take: 100,
    });

    const childClient = await findClientFromChildClioMatters(claimIndexRows);

    if (!childClient.ok || !childClient.clientId) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-master-matter-create-confirm",
          createsClioMatter: false,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          childClient,
          error: childClient.error || "Could not derive Clio client from child matters.",
        },
        { status: 409 }
      );
    }

    const description = buildClioMatterDescription(masterLawsuitId);
    const created = await createClioMasterMatter({
      masterLawsuitId,
      description,
      clientId: childClient.clientId,
    });

    const updatedLawsuit = await prisma.lawsuit.update({
      where: { masterLawsuitId },
      data: {
        clioMasterMatterId: created.matterId,
        clioMasterDisplayNumber: created.displayNumber,
        clioMasterMatterDescription: created.description || description,
        clioMasterMappedAt: new Date(),
        clioMasterMappingSource: "barsh-matters-clio-master-matter-confirm",
      },
    });

    return NextResponse.json({
      ok: true,
      action: "clio-master-matter-create-confirm",
      createsClioMatter: true,
      clioRecordsChanged: true,
      databaseRecordsChanged: true,
      documentsUploaded: false,
      documentsDownloaded: false,
      masterLawsuitId,
      typedConfirmation,
      childClient,
      createdClioMatter: {
        id: created.matterId,
        displayNumber: created.displayNumber,
        description: created.description || description,
      },
      localMapping: {
        masterLawsuitId: updatedLawsuit.masterLawsuitId,
        clioMasterMatterId: updatedLawsuit.clioMasterMatterId,
        clioMasterDisplayNumber: updatedLawsuit.clioMasterDisplayNumber,
        clioMasterMatterDescription: updatedLawsuit.clioMasterMatterDescription,
        clioMasterMappedAt: updatedLawsuit.clioMasterMappedAt,
        clioMasterMappingSource: updatedLawsuit.clioMasterMappingSource,
      },
      nextSteps: [
        "Read the created Clio matter to identify its Maildrop field/address.",
        "Use the mapped Clio matter for finalized master lawsuit document upload.",
        "Use the mapped Clio matter documents as attachment sources for Microsoft Graph draft creation.",
      ],
      note:
        "Created one Clio master matter and stored the mapping on the local Lawsuit row.  No documents were uploaded, downloaded, emailed, printed, or queued.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "clio-master-matter-create-confirm",
        createsClioMatter: false,
        error: error?.message || "Clio master matter create confirm failed.",
      },
      { status: 500 }
    );
  }
}
