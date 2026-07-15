import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  if (/^BRL_\d{9}$/.test(raw)) return raw;
  if (/^\d{9}$/.test(raw)) return `BRL_${raw}`;
  return raw;
}

function safeFilePart(value: unknown, maxLength = 120): string {
  return clean(value)
    .replace(/[\/\\:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeFilenamePart(value: unknown): string {
  return clean(value).replace(/[\\/:*?"<>|#%{}~&]+/g, "_").slice(0, 120);
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
      category: {
        in: ["direct_matter", "general"],
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

      const metadata =
        template.metadata && typeof template.metadata === "object" && !Array.isArray(template.metadata)
          ? (template.metadata as any)
          : {};

      // Production Ready templates are validated at the template level and
      // should generate regardless of the broader direct-matter validation.
      const productionTemplateReady =
        Boolean(metadata.productionTemplateReady) || currentVersion.status === "production-ready";
      const templateWouldGenerate = canGenerate || productionTemplateReady;

      return {
        key: template.key,
        label: template.label,
        filename: storedTemplateFilename(baseName, template),
        // Production Ready templates render through generate-preview (fills merge
        // fields + repeating-row loops); other stored templates keep raw passthrough.
        sourceEndpoint: productionTemplateReady
          ? `/api/documents/templates/generate-preview?key=${encodeURIComponent(template.key)}&versionId=${encodeURIComponent(currentVersion.id)}`
          : `/api/documents/templates/stored-docx?versionId=${encodeURIComponent(currentVersion.id)}`,
        wouldGenerate: templateWouldGenerate,
        wouldUploadToClio: templateWouldGenerate,
        reason: templateWouldGenerate
          ? ""
          : "Direct matter validation blocks document generation.",
        availableNow: true,
        status: templateWouldGenerate ? "ready-for-finalization" : "blocked",
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
        productionTemplateReady,
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

async function loadMatterPacket(req: NextRequest, matterIdInput: string) {
  const packetUrl = new URL("/api/documents/matter-packet", req.nextUrl.origin);
  packetUrl.searchParams.set("matterId", matterIdInput);

  const packetRes = await fetch(packetUrl, {
    method: "GET",
    cache: "no-store",
  });

  const packetJson = await packetRes.json().catch(() => null);

  if (!packetRes.ok || !packetJson?.packet) {
    throw new Error(packetJson?.error || "Could not load direct matter document packet.");
  }

  return packetJson.packet;
}

function directBaseName(packet: any, displayNumber: string) {
  const documentData = packet?.metadata?.documentData || {};
  const templateFields = documentData?.templateFields || packet?.templateFields || {};
  const provider = safeFilePart(templateFields.providerName || packet?.provider?.displayName || "Provider");
  const patient = safeFilePart(templateFields.patientName || packet?.patient?.displayName || "Patient");
  const insurer = safeFilePart(templateFields.insurerName || packet?.insurer?.displayName || "Insurer");
  const claimNumber = safeFilePart(templateFields.claimNumber || "No Claim");
  const matterDisplay = safeFilePart(templateFields.displayNumber || displayNumber || "Direct Matter");

  return `${matterDisplay} - ${provider} aao ${patient} v ${insurer} - Claim ${claimNumber}`;
}

export async function GET(req: NextRequest) {
  try {
    const directMatterId = numberOrNull(req.nextUrl.searchParams.get("directMatterId") || req.nextUrl.searchParams.get("matterId"));
    const directMatterDisplayNumber = normalizeBrl(
      req.nextUrl.searchParams.get("directMatterDisplayNumber") ||
      req.nextUrl.searchParams.get("displayNumber")
    );

    if (!directMatterId && !directMatterDisplayNumber) {
      return NextResponse.json(
        { ok: false, action: "direct-finalize-preview", error: "Missing directMatterId or directMatterDisplayNumber." },
        { status: 400 }
      );
    }

    const matterIdInput = directMatterId ? String(directMatterId) : directMatterDisplayNumber;
    const packet = await loadMatterPacket(req, matterIdInput);
    const packetDocumentData = packet?.metadata?.documentData || {};
    const templateFields = packetDocumentData?.templateFields || packet?.templateFields || {};
    const singleMasterDirectStorage = req.nextUrl.searchParams.get("singleMasterDirectStorage") === "1";
    const resolvedDisplay = normalizeBrl(
      (singleMasterDirectStorage && directMatterDisplayNumber) ||
        templateFields.displayNumber ||
        directMatterDisplayNumber ||
        (directMatterId ? `BRL${directMatterId}` : "")
    );
    const clioResolution = {
      ok: true,
      displayNumber: resolvedDisplay,
      clioMatterId: null,
      clioDisplayNumber: resolvedDisplay,
      error: "",
    };

    const validation = {
      warnings: [] as string[],
      blockingErrors: [] as string[],
      canGenerate: true,
    };

    if (!singleMasterDirectStorage) {
      validation.blockingErrors.push("Legacy Clio matter-shell direct finalization preview is disabled. Use single-master repository storage.");
      validation.canGenerate = false;
    }

    const canGenerate = Boolean(validation.canGenerate && singleMasterDirectStorage);

    const baseName = directBaseName(packet, resolvedDisplay);
    const plannedDocuments = await buildStoredDbDocxTemplateDocuments(baseName, canGenerate);

    if (plannedDocuments.length === 0) {
      validation.blockingErrors.push("No enabled direct matter DOCX templates are available.");
      validation.canGenerate = false;
    }

    let existingClioDocuments: any[] = [];
    let existingDocumentLookupError = "";

    if (canGenerate && clioResolution.clioMatterId) {
      existingDocumentLookupError = "Legacy direct Clio matter duplicate lookup is disabled under single-master storage.";
    }

    const existingFilenames = new Set(
      existingClioDocuments.map((doc: any) => clean(doc?.name || doc?.filename).toLowerCase()).filter(Boolean)
    );

    const plannedWithExistingStatus = plannedDocuments.map((doc: any) => {
      const filename = clean(doc.filename);
      const alreadyExists = existingFilenames.has(filename.toLowerCase());
      return {
        ...doc,
        alreadyExistsInRepository: alreadyExists,
        wouldUploadToClio: Boolean(doc.wouldUploadToClio && !alreadyExists),
        duplicateUploadBlocked: alreadyExists,
      };
    });

    return NextResponse.json({
      ok: Boolean(validation.canGenerate),
      action: "direct-finalize-preview",
      directMatterId,
      directMatterDisplayNumber: resolvedDisplay,
      uploadTargetMode: "direct-matter",
      clioUploadTarget: {
        type: "single-master-direct-individual-storage",
        directMatterFileNumber: singleMasterDirectStorage ? resolvedDisplay : null,
        matterDisplayNumber: resolvedDisplay,
        matterId: clioResolution.clioMatterId,
        displayNumber: clioResolution.clioDisplayNumber || resolvedDisplay,
        uploadTargetMode: "direct-matter",
        wouldUploadToClio: Boolean(canGenerate),
      },
      plannedDocuments: plannedWithExistingStatus,
      packetSummary: {
        matter: resolvedDisplay,
        provider: clean(templateFields.providerName),
        patient: clean(templateFields.patientName),
        insurer: clean(templateFields.insurerName),
        claimNumber: clean(templateFields.claimNumber),
        claimAmount: templateFields.claimAmount ?? null,
        balancePresuit: templateFields.balancePresuit ?? null,
      },
      validation: {
        ...validation,
        canGenerate: Boolean(validation.canGenerate),
      },
      existingClioDocuments: {
        count: existingClioDocuments.length,
        lookupError: existingDocumentLookupError,
      },
      packet,
      safety: {
        dryRun: true,
        previewOnly: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        graphFilesCreated: false,
        documentsGenerated: false,
        printQueueChanged: false,
      },
      note: "Direct matter finalization preview mirrors the lawsuit document workflow using Barsh Matters Master Repository storage.",
    });
  } catch (err: any) {

    return NextResponse.json(
      {
        ok: false,
        action: "direct-finalize-preview",
        error: err?.message || "Direct matter finalization preview failed.",
      },
      { status: 500 }
    );
  }
}
