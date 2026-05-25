import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clioFetch } from "@/lib/clio";
import {
  findExistingClioDocumentsByFilename,
  listClioMatterDocuments,
} from "@/lib/clioDocumentUpload";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
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

async function readClioJson(res: Response, fallback: string): Promise<any> {
  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(
      `${fallback}: ${res.status} ${res.statusText}${json ? ` ${JSON.stringify(json)}` : text ? ` ${text}` : ""}`
    );
  }

  return json;
}

async function resolveClioMatterByDisplayNumber(displayNumberInput: string) {
  const displayNumber = normalizeBrl(displayNumberInput);

  if (!displayNumber) {
    return {
      ok: false,
      displayNumber: "",
      clioMatterId: null,
      clioDisplayNumber: "",
      error: "Missing Clio display number.",
    };
  }

  const params = new URLSearchParams();
  params.set("query", displayNumber);
  params.set("limit", "20");
  params.set("fields", "id,display_number,description");

  const res = await clioFetch(`/matters.json?${params.toString()}`);
  const json = await readClioJson(res, `Clio matter lookup failed for ${displayNumber}`);
  const rows = Array.isArray(json?.data) ? json.data : [];

  const exact = rows
    .map((row: any) => ({
      id: numberOrNull(row?.id),
      displayNumber: normalizeBrl(row?.display_number),
      description: clean(row?.description),
    }))
    .find((row: any) => row.id && row.displayNumber === displayNumber);

  if (!exact?.id) {
    return {
      ok: false,
      displayNumber,
      clioMatterId: null,
      clioDisplayNumber: "",
      error: `Could not resolve Clio matter id for ${displayNumber}.`,
    };
  }

  return {
    ok: true,
    displayNumber,
    clioMatterId: exact.id,
    clioDisplayNumber: exact.displayNumber,
    error: "",
  };
}

function safeFilePart(value: unknown, maxLength = 120): string {
  return clean(value)
    .replace(/[\/\\:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildBaseName(packet: any, masterLawsuitId: string) {
  const metadata = packet.metadata || {};
  const masterMatter = packet.masterMatter || {};

  const provider = safeFilePart(metadata.provider?.value || "Provider");
  const patient = safeFilePart(metadata.patient?.value || "Patient");
  const insurer = safeFilePart(metadata.insurer?.value || "Insurer");
  const claimNumber = safeFilePart(metadata.claimNumber?.value || "No Claim");
  const masterDisplay = safeFilePart(masterMatter.displayNumber || masterLawsuitId);

  return `${masterDisplay} - ${provider} aao ${patient} v ${insurer} - Claim ${claimNumber}`;
}

function safeFilenamePart(value: unknown): string {
  const raw = String(value ?? "").trim();
  return raw.replace(/[\\/:*?"<>|#%{}~&]+/g, "_").slice(0, 120);
}

function storedTemplateFilename(baseName: string, template: any): string {
  const suffix =
    safeFilenamePart(template?.defaultFilenameSuffix) ||
    safeFilenamePart(template?.label) ||
    safeFilenamePart(template?.key) ||
    "Stored Template";
  return `${baseName} - ${suffix}.docx`;
}

async function buildStoredDbDocxTemplateDocuments(baseName: string, canGenerate: boolean) {
  const templates = await prisma.documentTemplate.findMany({
    where: {
      enabled: true,
      outputFormat: {
        in: ["docx", "both"],
      },
    },
    orderBy: [
      { category: "asc" },
      { label: "asc" },
      { key: "asc" },
    ],
    include: {
      versions: {
        orderBy: {
          versionNumber: "desc",
        },
        take: 1,
      },
      mergeFields: {
        orderBy: {
          key: "asc",
        },
      },
    },
  });

  return templates
    .map((template) => {
      const currentVersion = Array.isArray(template.versions) ? template.versions[0] : null;
      const hasStoredDocx =
        currentVersion?.storageKind === "db-docx-base64" && Boolean(currentVersion?.contentText);

      if (!currentVersion || !hasStoredDocx) return null;

      const metadata = template.metadata && typeof template.metadata === "object" && !Array.isArray(template.metadata)
        ? (template.metadata as any)
        : {};

      return {
        key: template.key,
        label: template.label,
        filename: storedTemplateFilename(baseName, template),
        sourceEndpoint: `/api/documents/templates/stored-docx?versionId=${encodeURIComponent(currentVersion.id)}`,
        wouldGenerate: canGenerate,
        wouldUploadToClio: canGenerate,
        reason: canGenerate ? "" : "Packet validation blocks document generation.",
        availableNow: true,
        status: canGenerate ? "ready-for-finalization" : "blocked",
        templateSource: "barsh-matters-db-template-repository",
        repositorySource: "barsh-matters-db",
        repositoryStatus: "stored-db-docx-template",
        storedTemplateVersionId: currentVersion.id,
        storedTemplateVersionNumber: currentVersion.versionNumber,
        storageKind: currentVersion.storageKind,
        hasStoredDocx: true,
        storedDocxBytes: currentVersion.contentText
          ? Buffer.from(String(currentVersion.contentText), "base64").length
          : 0,
        productionTemplateReady:
          Boolean(metadata.productionTemplateReady) || currentVersion.status === "production-ready",
        finalProductionDocument: Boolean(metadata.finalProductionDocument),
        mergeFieldSet: currentVersion.mergeFieldSet || metadata.mergeFieldSet || "",
        mergeFields: template.mergeFields.map((field) => ({
          key: field.key,
          label: field.label,
          source: field.source,
          required: Boolean(field.required),
          metadata: field.metadata || null,
        })),
      };
    })
    .filter((document): document is NonNullable<typeof document> => Boolean(document));
}

async function buildDocumentPlan(masterLawsuitId: string, baseName: string, canGenerate: boolean) {
  const placeholderDocuments = [
    {
      key: "bill-schedule",
      label: "Bill Schedule",
      filename: `${baseName} - Bill Schedule.docx`,
      sourceEndpoint: `/api/documents/bill-schedule?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`,
      wouldGenerate: canGenerate,
      wouldUploadToClio: canGenerate,
      availableNow: true,
      status: canGenerate ? "ready-for-finalization" : "blocked",
    },
    {
      key: "packet-summary",
      label: "Packet Summary",
      filename: `${baseName} - Packet Summary.docx`,
      sourceEndpoint: `/api/documents/packet-summary?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`,
      wouldGenerate: canGenerate,
      wouldUploadToClio: canGenerate,
      availableNow: true,
      status: canGenerate ? "ready-for-finalization" : "blocked",
    },
    {
      key: "summons-complaint",
      label: "Summons and Complaint",
      filename: `${baseName} - Summons and Complaint.docx`,
      sourceEndpoint: `/api/documents/summons-complaint?masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`,
      wouldGenerate: canGenerate,
      wouldUploadToClio: canGenerate,
      availableNow: true,
      status: canGenerate ? "ready-for-finalization" : "blocked",
      note: "Current Summons and Complaint output is a scaffold/draft until final pleading content is approved.",
    },
  ];

  const storedDbTemplateDocuments = await buildStoredDbDocxTemplateDocuments(baseName, canGenerate);

  return [
    ...storedDbTemplateDocuments,
    ...placeholderDocuments,
  ];
}

async function loadPacket(req: NextRequest, masterLawsuitId: string) {
  const packetUrl = new URL("/api/documents/packet", req.nextUrl.origin);
  packetUrl.searchParams.set("masterLawsuitId", masterLawsuitId);

  const packetRes = await fetch(packetUrl, {
    method: "GET",
    cache: "no-store",
  });

  const packetJson = await packetRes.json();

  if (!packetRes.ok || !packetJson?.packet) {
    throw new Error(packetJson?.error || "Could not load document packet.");
  }

  return packetJson.packet;
}

export async function GET(req: NextRequest) {
  try {
    const masterLawsuitId = clean(req.nextUrl.searchParams.get("masterLawsuitId"));

    if (!masterLawsuitId) {
      return NextResponse.json(
        { ok: false, error: "Missing masterLawsuitId" },
        { status: 400 }
      );
    }

    const uploadTargetMode = clean(req.nextUrl.searchParams.get("uploadTarget")) || "master-lawsuit";
    const directMatterDisplayNumber = normalizeBrl(req.nextUrl.searchParams.get("directMatterDisplayNumber"));
    const directMatterId = numberOrNull(req.nextUrl.searchParams.get("directMatterId"));

    const packet = await loadPacket(req, masterLawsuitId);
    const metadata = packet.metadata || {};
    const validation = packet.validation || {};
    const masterMatter = packet.masterMatter || {};
    const totals = packet.totals || {};

    const masterMatterId =
      masterMatter.matterId ??
      masterMatter.id ??
      packet.masterMatterId ??
      null;

    const masterDisplayNumber = clean(masterMatter.displayNumber || masterLawsuitId);

    let uploadTarget = {
      type: "master-matter-documents-tab",
      matterId: masterMatterId,
      displayNumber: masterDisplayNumber,
      masterLawsuitId,
      uploadTargetMode: "master-lawsuit",
      wouldUploadToClio: Boolean(validation.canGenerate),
    };

    if (uploadTargetMode === "direct-matter") {
      const directDisplay = directMatterDisplayNumber || (directMatterId ? `BRL${directMatterId}` : "");
      const directResolution = await resolveClioMatterByDisplayNumber(directDisplay);

      uploadTarget = {
        type: "direct-matter-documents-tab",
        matterId: directResolution.clioMatterId,
        displayNumber: directResolution.clioDisplayNumber || directDisplay,
        masterLawsuitId,
        uploadTargetMode: "direct-matter",
        wouldUploadToClio: Boolean(validation.canGenerate && directResolution.ok && directResolution.clioMatterId),
      } as any;

      if (!directResolution.ok || !directResolution.clioMatterId) {
        validation.blockingErrors = Array.isArray(validation.blockingErrors) ? validation.blockingErrors : [];
        validation.blockingErrors.push(directResolution.error || "Could not resolve direct matter Clio upload target.");
        validation.canGenerate = false;
      }
    }

    const canGenerate = Boolean(validation.canGenerate) && Boolean(uploadTarget.matterId);
    const baseName = buildBaseName(
      {
        ...packet,
        masterMatter: {
          ...(masterMatter || {}),
          displayNumber: uploadTarget.displayNumber || masterDisplayNumber,
        },
      },
      masterLawsuitId
    );
    const plannedDocuments = (await buildDocumentPlan(masterLawsuitId, baseName, canGenerate)).filter(
      (document): document is NonNullable<typeof document> => Boolean(document)
    );

    let existingClioDocuments: any[] = [];
    let existingDocumentLookupError = "";

    if (canGenerate && uploadTarget.matterId) {
      try {
        existingClioDocuments = await listClioMatterDocuments(Number(uploadTarget.matterId));
      } catch (err: any) {
        existingDocumentLookupError =
          err?.message || "Could not check existing Clio documents.";
      }
    }

    const plannedDocumentsWithExistingStatus = plannedDocuments.map((document) => {
      const existingMatches = findExistingClioDocumentsByFilename(
        existingClioDocuments,
        document.filename
      );

      return {
        ...document,
        alreadyUploadedToClio: existingMatches.length > 0,
        duplicateRisk: existingMatches.length > 0,
        existingClioDocuments: existingMatches.map((match) => ({
          id: match.id,
          name: match.name,
          filename: match.filename,
          createdAt: match.createdAt,
          updatedAt: match.updatedAt,
          latestDocumentVersion: match.latestDocumentVersion,
        })),
      };
    });

    const existingUploadMatches = plannedDocumentsWithExistingStatus
      .filter((document) => document.alreadyUploadedToClio)
      .map((document) => ({
        key: document.key,
        label: document.label,
        filename: document.filename,
        existingClioDocuments: document.existingClioDocuments,
      }));

    return NextResponse.json({
      ok: canGenerate,
      dryRun: true,
      action: "finalize-preview",
      masterLawsuitId,
      generatedAt: new Date().toISOString(),
      finalizationDate: todayIsoDate(),

      clioUploadTarget: {
        ...uploadTarget,
        wouldUploadToClio: canGenerate,
      },

      packetSummary: {
        masterMatter: masterDisplayNumber,
        venue: metadata.venue?.value || "",
        indexAaaNumber: metadata.indexAaaNumber?.value || "",
        amountSought: metadata.amountSought?.amount ?? null,
        amountSoughtMode: metadata.amountSought?.mode || "",
        provider: metadata.provider?.value || "",
        patient: metadata.patient?.value || "",
        insurer: metadata.insurer?.value || "",
        claimNumber: metadata.claimNumber?.value || "",
        billCount: totals.billCount || 0,
      },

      plannedDocuments: plannedDocumentsWithExistingStatus,

      existingDocumentCheck: {
        attempted: Boolean(canGenerate && uploadTarget.matterId),
        error: existingDocumentLookupError,
        matchCount: existingUploadMatches.length,
        matches: existingUploadMatches,
      },

      validation: {
        warnings: validation.warnings || [],
        blockingErrors: validation.blockingErrors || [],
        canGenerate,
      },

      safety: {
        noPersistentFilesCreated: true,
        noClioRecordsChanged: true,
        noDatabaseRecordsChanged: true,
        noOneDriveOrSharePointFoldersCreated: true,
        noUploadPerformed: true,
        duplicateAwarenessOnly: true,
      },

      note:
        "Dry run only. This endpoint previews finalization/upload targets only. No files were persisted, no documents were uploaded to Clio, no Clio records were changed, no folders were created, and no database records were changed.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        dryRun: true,
        action: "finalize-preview",
        error: err?.message || "Finalize preview failed.",
        safety: {
          noPersistentFilesCreated: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noOneDriveOrSharePointFoldersCreated: true,
          noUploadPerformed: true,
        },
      },
      { status: 500 }
    );
  }
}
