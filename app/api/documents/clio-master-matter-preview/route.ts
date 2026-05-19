import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clioFetch } from "@/lib/clio";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function money(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = clean(value).replace(/[$,]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeJson(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
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



function buildPlannedMapping(masterLawsuitId: string) {
  return {
    localMasterLawsuitId: masterLawsuitId,
    clioMatterId: "TO_BE_ASSIGNED_BY_CLIO",
    clioDisplayNumber: "TO_BE_ASSIGNED_BY_CLIO_BRLXXXXX",
    clioMatterDescription: buildClioMatterDescription(masterLawsuitId),
    mappingPurpose: [
      "Clio document vault for finalized master lawsuit documents",
      "Clio Maildrop source for document-delivery Cc",
      "Clio document source for Outlook/Microsoft Graph draft attachments",
      "Clio document source for Barsh Matters UI document access",
    ],
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const masterLawsuitId = clean(url.searchParams.get("masterLawsuitId")) || "2026.05.00001";

    const lawsuit = await prisma.lawsuit.findUnique({
      where: { masterLawsuitId },
    });

    const claimIndexRows = await prisma.claimIndex.findMany({
      where: { master_lawsuit_id: masterLawsuitId },
      select: {
        matter_id: true,
        display_number: true,
        description: true,
        provider_name: true,
        patient_name: true,
        insurer_name: true,
        claim_number_raw: true,
        index_aaa_number: true,
        settled_with: true,
      },
      orderBy: [{ display_number: "asc" }],
      take: 100,
    });

    const lawsuitOptions = asRecord(lawsuit?.lawsuitOptions);
    const selectedCourtDetails = asRecord(lawsuitOptions.selectedCourtDetails);

    const providerNames = Array.from(
      new Set(claimIndexRows.map((row) => clean(row.provider_name)).filter(Boolean))
    );
    const patientNames = Array.from(
      new Set(claimIndexRows.map((row) => clean(row.patient_name)).filter(Boolean))
    );
    const insurerNames = Array.from(
      new Set(claimIndexRows.map((row) => clean(row.insurer_name)).filter(Boolean))
    );
    const claimNumbers = Array.from(
      new Set(claimIndexRows.map((row) => clean(row.claim_number_raw)).filter(Boolean))
    );

    const childClient = await findClientFromChildClioMatters(claimIndexRows);

    const plannedClioMatterPayload = {
      data: {
        description: buildClioMatterDescription(masterLawsuitId),
        // Clio assigns the BRLXXXXX display number.  Barsh Matters must store it after creation.
        status: "Open",
        client: childClient.ok ? { id: childClient.clientId, name: childClient.clientName } : null,
        client_id: childClient.ok ? childClient.clientId : null,
        customMetadataForMappingOnly: {
          localMasterLawsuitId: masterLawsuitId,
          claimNumber: lawsuit?.claimNumber || claimNumbers[0] || null,
          providerNames,
          patientNames,
          insurerNames,
          venue: lawsuit?.venue || lawsuit?.venueSelection || lawsuitOptions.venue || null,
          indexAaaNumber:
            lawsuit?.indexAaaNumber ||
            clean(lawsuitOptions.indexAaaNumber) ||
            claimIndexRows.find((row) => clean(row.index_aaa_number))?.index_aaa_number ||
            null,
        },
      },
    };

    const plannedLocalMapping = buildPlannedMapping(masterLawsuitId);

    return NextResponse.json({
      ok: true,
      action: "clio-master-matter-create-preview",
      previewOnly: true,
      createsClioMatter: false,
      clioRecordsChanged: false,
      databaseRecordsChanged: false,
      documentsUploaded: false,
      documentsDownloaded: false,
      masterLawsuitId,
      local: {
        lawsuit: lawsuit ? safeJson(lawsuit) : null,
        claimIndexRows,
        selectedCourtDetails,
        providerNames,
        patientNames,
        insurerNames,
        claimNumbers,
      },
      childClient,
      plannedClioMatterPayload,
      plannedLocalMapping,
      blockingWarnings: [
        ...(childClient.ok ? [] : [childClient.error || "Could not derive Clio client from child matters."]),
        ...(lawsuit ? [] : [`No local Lawsuit row found for ${masterLawsuitId}.`]),
        ...(claimIndexRows.length ? [] : [`No local ClaimIndex rows found for ${masterLawsuitId}.`]),
      ],
      requirementsForConfirmRoute: {
        typedConfirmationRequired: `CREATE CLIO MASTER ${masterLawsuitId}`,
        clioCreateEndpoint: "POST /api/v4/matters.json",
        mustCaptureClioMatterId: true,
        mustCaptureClioDisplayNumber: true,
        mustUseChildMatterClient: true,
        mustStoreMappingInBarshMatters: true,
        mustNotUseMasterLawsuitIdAsClioDisplayNumber: true,
        clioAssignsBrlDisplayNumber: true,
      },
      note:
        "Preview only.  This route plans the Clio master matter creation and Barsh Matters mapping needed for document storage, Maildrop Cc, document retrieval, and future Outlook/Microsoft Graph attachments.  It does not create a Clio matter and does not write to the database.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "clio-master-matter-create-preview",
        previewOnly: true,
        createsClioMatter: false,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        error: error?.message || "Clio master matter create preview failed.",
      },
      { status: 500 }
    );
  }
}
