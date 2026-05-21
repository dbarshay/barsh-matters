import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listClioMatterDocuments } from "@/lib/clioDocumentUpload";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function inferDisplayNumber(value: unknown): string {
  const n = numberOrNull(value);
  return n ? `BRL${n}` : "";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawMatterId = url.searchParams.get("matterId");
    const rawMasterLawsuitId = url.searchParams.get("masterLawsuitId");

    const matterId = numberOrNull(rawMatterId);
    const masterLawsuitId = clean(rawMasterLawsuitId);

    if (matterId && masterLawsuitId) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-matter-documents-list",
          readOnly: true,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          documentsUploaded: false,
          documentsDownloaded: false,
          documentsGenerated: false,
          emailSent: false,
          printQueued: false,
          error: "Use either matterId or masterLawsuitId, not both.",
        },
        { status: 400 }
      );
    }

    if (!matterId && !masterLawsuitId) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-matter-documents-list",
          readOnly: true,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          documentsUploaded: false,
          documentsDownloaded: false,
          documentsGenerated: false,
          emailSent: false,
          printQueued: false,
          error: "Missing matterId or masterLawsuitId.",
        },
        { status: 400 }
      );
    }

    let clioMatterId: number | null = null;
    let clioDisplayNumber = "";
    let localSource: any = null;
    let targetType: "direct-matter" | "master-lawsuit" = "direct-matter";

    if (matterId) {
      targetType = "direct-matter";

      const claimIndexRow = await prisma.claimIndex.findUnique({
        where: { matter_id: matterId },
        select: {
          matter_id: true,
          display_number: true,
          master_lawsuit_id: true,
          provider_name: true,
          patient_name: true,
          insurer_name: true,
          claim_number_raw: true,
        },
      });

      clioMatterId = matterId;
      clioDisplayNumber = normalizeBrl(claimIndexRow?.display_number) || inferDisplayNumber(matterId);
      localSource = {
        source: "claim-index",
        mappingRequired: false,
        rowFound: Boolean(claimIndexRow),
        claimIndexRow,
      };
    }

    if (masterLawsuitId) {
      targetType = "master-lawsuit";

      const lawsuit = await prisma.lawsuit.findUnique({
        where: { masterLawsuitId },
        select: {
          id: true,
          masterLawsuitId: true,
          clioMasterMatterId: true,
          clioMasterDisplayNumber: true,
          clioMasterMatterDescription: true,
          clioMasterMappedAt: true,
          clioMasterMappingSource: true,
        },
      });

      clioMatterId = numberOrNull(lawsuit?.clioMasterMatterId);
      clioDisplayNumber = normalizeBrl(lawsuit?.clioMasterDisplayNumber);
      localSource = {
        source: "lawsuit.clio-master-mapping",
        mappingRequired: true,
        rowFound: Boolean(lawsuit),
        lawsuit,
      };

      if (!lawsuit) {
        return NextResponse.json(
          {
            ok: false,
            action: "clio-matter-documents-list",
            readOnly: true,
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
            documentsUploaded: false,
            documentsDownloaded: false,
            documentsGenerated: false,
            emailSent: false,
            printQueued: false,
            targetType,
            masterLawsuitId,
            error: "No local Lawsuit row exists for this masterLawsuitId.",
            localSource,
          },
          { status: 404 }
        );
      }

      if (!clioMatterId) {
        return NextResponse.json(
          {
            ok: false,
            action: "clio-matter-documents-list",
            readOnly: true,
            failClosed: true,
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
            documentsUploaded: false,
            documentsDownloaded: false,
            documentsGenerated: false,
            emailSent: false,
            printQueued: false,
            targetType,
            masterLawsuitId,
            error:
              "No mapped Clio master matter ID exists for this Barsh Matters Lawsuit ID.  Refusing to list Clio documents without an explicit mapping.",
            localSource,
          },
          { status: 409 }
        );
      }
    }

    if (!clioMatterId) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-matter-documents-list",
          readOnly: true,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          documentsUploaded: false,
          documentsDownloaded: false,
          documentsGenerated: false,
          emailSent: false,
          printQueued: false,
          error: "Unable to resolve a Clio matter ID.",
        },
        { status: 400 }
      );
    }

    const documents = await listClioMatterDocuments(clioMatterId);

    const normalizedDocuments = documents.map((doc) => ({
      clioDocumentId: doc.id,
      clioDocumentName: doc.name,
      clioDocumentFilename: doc.filename,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      latestDocumentVersion: doc.latestDocumentVersion
        ? {
            id: doc.latestDocumentVersion.id,
            uuid: doc.latestDocumentVersion.uuid,
            filename: doc.latestDocumentVersion.filename,
            size: doc.latestDocumentVersion.size,
            contentType: doc.latestDocumentVersion.contentType,
            fullyUploaded: doc.latestDocumentVersion.fullyUploaded,
            receivedAt: doc.latestDocumentVersion.receivedAt,
            createdAt: doc.latestDocumentVersion.createdAt,
            updatedAt: doc.latestDocumentVersion.updatedAt,
          }
        : null,
    }));

    return NextResponse.json({
      ok: true,
      action: "clio-matter-documents-list",
      readOnly: true,
      failClosed: false,
      clioRecordsChanged: false,
      databaseRecordsChanged: false,
      documentsUploaded: false,
      documentsDownloaded: false,
      documentsGenerated: false,
      emailSent: false,
      printQueued: false,
      targetType,
      matterId: matterId || null,
      masterLawsuitId: masterLawsuitId || null,
      clioMatterId,
      clioDisplayNumber,
      localSource,
      documents: normalizedDocuments,
      summary: {
        documentCount: normalizedDocuments.length,
        fullyUploadedCount: normalizedDocuments.filter(
          (doc) => doc.latestDocumentVersion?.fullyUploaded
        ).length,
        missingLatestVersionCount: normalizedDocuments.filter(
          (doc) => !doc.latestDocumentVersion
        ).length,
      },
      safety: {
        routeIsReadOnly: true,
        usesExistingListHelper: true,
        noClioWrites: true,
        noDatabaseWrites: true,
        noUploads: true,
        noDownloads: true,
        noDocumentGeneration: true,
        noEmail: true,
        noPrint: true,
        noPrintQueue: true,
        masterMatterRequiresExplicitClioMapping: targetType === "master-lawsuit",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "clio-matter-documents-list",
        readOnly: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        documentsUploaded: false,
        documentsDownloaded: false,
        documentsGenerated: false,
        emailSent: false,
        printQueued: false,
        error: error?.message || "Could not list Clio matter documents.",
      },
      { status: 500 }
    );
  }
}
