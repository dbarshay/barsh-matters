/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/prefer-as-const -- Pre-existing loosely-typed Clio route; this change only extracts shared folder-resolution helpers to a lib. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clioFetch } from "@/lib/clio";
import { listClioFolderDocuments, listClioMatterDocuments } from "@/lib/clioDocumentUpload";
import { type ClioStorageTargetInput } from "@/lib/clioStoragePlan";
import { normalizeClioDocumentRows, resolveExistingSingleMasterFolderForDocuments, sourceLabel } from "@/lib/documents/clioMatterFolderDocuments";

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

function normalizeDirectMatterDisplayNumberForDocuments(value: unknown): string {
  const raw = clean(value).toUpperCase();
  if (!raw) return "";

  const brlMatch = raw.match(/^BRL[_-]?(\d{4})(\d{5})$/);
  if (brlMatch) return `BRL_${brlMatch[1]}${brlMatch[2]}`;

  const numericMatch = raw.match(/^(\d{4})(\d{5})$/);
  if (numericMatch) return `BRL_${numericMatch[1]}${numericMatch[2]}`;

  return raw;
}

function inferDisplayNumber(value: unknown): string {
  const n = numberOrNull(value);
  return n ? `BRL${n}` : "";
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
      candidates: [],
      error: "Missing Clio display number for direct matter document lookup.",
    };
  }

  const fields = "id,display_number,description";
  const params = new URLSearchParams();
  params.set("query", displayNumber);
  params.set("limit", "20");
  params.set("fields", fields);

  const res = await clioFetch(`/matters.json?${params.toString()}`);
  const json = await readClioJson(res, `Clio matter lookup failed for ${displayNumber}`);
  const rows = Array.isArray(json?.data) ? json.data : [];

  const candidates = rows.map((row: any) => ({
    id: numberOrNull(row?.id),
    displayNumber: normalizeBrl(row?.display_number),
    description: clean(row?.description),
  }));

  const exact = candidates.find((row: any) => row.displayNumber === displayNumber && row.id);

  if (!exact?.id) {
    return {
      ok: false,
      displayNumber,
      clioMatterId: null,
      clioDisplayNumber: "",
      candidates,
      error: `Could not resolve Clio matter id for ${displayNumber}.`,
    };
  }

  return {
    ok: true,
    displayNumber,
    clioMatterId: exact.id,
    clioDisplayNumber: exact.displayNumber,
    candidates,
    error: "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawMatterId = url.searchParams.get("matterId");
    const rawMasterLawsuitId = url.searchParams.get("masterLawsuitId");
    const uploadTargetMode = clean(url.searchParams.get("uploadTargetMode") || url.searchParams.get("uploadTarget"));
    const singleMasterDirectStorage =
      url.searchParams.get("singleMasterDirectStorage") === "1" ||
      url.searchParams.get("useSingleMasterClioStorage") === "1";
    const directMatterDisplayNumber = normalizeDirectMatterDisplayNumberForDocuments(
      url.searchParams.get("directMatterDisplayNumber")
    );

    const matterId = numberOrNull(rawMatterId);
    const masterLawsuitId = clean(rawMasterLawsuitId);

    if (uploadTargetMode === "direct-matter" && singleMasterDirectStorage) {
      const targetType: "direct-matter" = "direct-matter";

      if (!/^BRL_\d{9}$/.test(directMatterDisplayNumber)) {
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
            matterId: null,
            localMatterId: null,
            directMatterDisplayNumber,
            error: "Missing or invalid directMatterDisplayNumber for single-master direct matter document lookup.",
          },
          { status: 400 }
        );
      }

      const targetInput: ClioStorageTargetInput = {
        storageTargetKind: "individual_matter",
        bmMatterId: directMatterDisplayNumber,
        displayNumber: directMatterDisplayNumber,
        directMatterFileNumber: directMatterDisplayNumber,
      };

      const folderResolution = await resolveExistingSingleMasterFolderForDocuments(targetInput);
      const folderId = Number(folderResolution?.folderId);

      if (!folderResolution.ok || !Number.isFinite(folderId) || folderId <= 0) {
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
            matterId: null,
            localMatterId: null,
            clioMatterId: null,
            clioFolderId: null,
            directMatterDisplayNumber,
            error:
              folderResolution?.missingFolderName
                ? `Could not resolve existing Barsh Matters Master Repository direct folder for ${directMatterDisplayNumber}; missing folder segment "${folderResolution.missingFolderName}".`
                : `Could not resolve existing Barsh Matters Master Repository direct folder for ${directMatterDisplayNumber}.`,
            localSource: {
              source: "single-master-direct-folder-read-only-exact-lookup",
              mappingRequired: false,
              directMatterDisplayNumber,
              folderResolution,
            },
          },
          { status: 404 }
        );
      }

      const folderDocuments = await listClioFolderDocuments(folderId);
      const normalizedDocuments = normalizeClioDocumentRows(folderDocuments, {
        clioMatterId: null,
        clioDisplayNumber: directMatterDisplayNumber,
        sourceRole: "bill",
        sourceLabel: sourceLabel(directMatterDisplayNumber, "bill"),
      }).map((doc: any) => ({
        ...doc,
        sourceClioFolderId: folderId,
        sourceStorageMode: "single-master-direct-folder",
      }));

      const sourceSummaries = [
        {
          clioMatterId: null,
          clioFolderId: folderId,
          clioDisplayNumber: directMatterDisplayNumber,
          sourceRole: "bill" as const,
          sourceLabel: sourceLabel(directMatterDisplayNumber, "bill"),
          sourceStorageMode: "single-master-direct-folder",
          documentCount: folderDocuments.length,
        },
      ];

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
        uploadTargetMode,
        singleMasterDirectStorage: true,
        useSingleMasterClioStorage: true,
        matterId: null,
        localMatterId: null,
        masterLawsuitId: null,
        clioMatterId: null,
        clioFolderId: folderId,
        directMatterDisplayNumber,
        clioDisplayNumber: directMatterDisplayNumber,
        localSource: {
          source: "single-master-direct-folder-read-only-exact-lookup",
          mappingRequired: false,
          directMatterDisplayNumber,
          folderResolution,
        },
        documents: normalizedDocuments,
        sourceSummaries,
        summary: {
          documentCount: normalizedDocuments.length,
          sourceCount: sourceSummaries.length,
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
          usesReadOnlyExactFolderLookup: true,
          usesFolderDocumentListing: true,
          noFolderCreation: true,
          noClioWrites: true,
          noDatabaseWrites: true,
          noUploads: true,
          noDownloads: true,
          noDocumentGeneration: true,
          noEmail: true,
          noPrint: true,
        },
      });
    }

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

      const localDisplayNumber = normalizeBrl(claimIndexRow?.display_number) || inferDisplayNumber(matterId);
      const clioResolution = await resolveClioMatterByDisplayNumber(localDisplayNumber);

      if (!clioResolution.ok || !clioResolution.clioMatterId) {
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
            matterId,
            localMatterId: matterId,
            clioDisplayNumber: localDisplayNumber,
            error:
              clioResolution.error ||
              `Could not resolve real Clio matter id for ${localDisplayNumber}.`,
            localSource: {
              source: "claim-index + clio-display-number-resolution",
              mappingRequired: true,
              rowFound: Boolean(claimIndexRow),
              claimIndexRow,
              clioResolution,
            },
          },
          { status: 409 }
        );
      }

      clioMatterId = clioResolution.clioMatterId;
      clioDisplayNumber = clioResolution.clioDisplayNumber || localDisplayNumber;
      localSource = {
        source: "claim-index + clio-display-number-resolution",
        mappingRequired: true,
        rowFound: Boolean(claimIndexRow),
        claimIndexRow,
        clioResolution,
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

      const childClaimIndexRows = await prisma.claimIndex.findMany({
        where: { master_lawsuit_id: masterLawsuitId },
        select: {
          matter_id: true,
          display_number: true,
          description: true,
          provider_name: true,
          patient_name: true,
          insurer_name: true,
          claim_number_raw: true,
        },
        orderBy: [{ display_number: "asc" }, { matter_id: "asc" }],
        take: 200,
      });

      clioMatterId = numberOrNull(lawsuit?.clioMasterMatterId);
      clioDisplayNumber = normalizeBrl(lawsuit?.clioMasterDisplayNumber);
      localSource = {
        source: "lawsuit.clio-master-mapping",
        mappingRequired: true,
        rowFound: Boolean(lawsuit),
        lawsuit,
        childClaimIndexRows,
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
              "No Barsh Matters repository storage target exists for this Lawsuit ID. Refusing to list documents without an explicit repository context.",
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

    let normalizedDocuments: any[] = [];
    const sourceSummaries: any[] = [];

    if (targetType === "master-lawsuit") {
      const masterDisplay = clioDisplayNumber || normalizeBrl(localSource?.lawsuit?.clioMasterDisplayNumber);
      const masterDocuments = await listClioMatterDocuments(clioMatterId);
      const masterSource = {
        clioMatterId,
        clioDisplayNumber: masterDisplay,
        sourceRole: "lawsuit" as const,
        sourceLabel: sourceLabel(masterDisplay, "lawsuit"),
      };

      normalizedDocuments.push(...normalizeClioDocumentRows(masterDocuments, masterSource));
      sourceSummaries.push({
        ...masterSource,
        documentCount: masterDocuments.length,
      });

      const childRows = Array.isArray(localSource?.childClaimIndexRows)
        ? localSource.childClaimIndexRows
        : [];

      for (const child of childRows) {
        const childDisplay = normalizeBrl(child?.display_number) || inferDisplayNumber(child?.matter_id);
        if (!childDisplay) continue;
        if (childDisplay === masterDisplay) continue;

        const childResolution = await resolveClioMatterByDisplayNumber(childDisplay);
        if (!childResolution.ok || !childResolution.clioMatterId) {
          sourceSummaries.push({
            clioMatterId: null,
            clioDisplayNumber: childDisplay,
            sourceRole: "bill",
            sourceLabel: sourceLabel(childDisplay, "bill"),
            documentCount: 0,
            error: childResolution.error || `Could not resolve ${childDisplay}.`,
          });
          continue;
        }

        const childDocuments = await listClioMatterDocuments(childResolution.clioMatterId);
        const childSource = {
          clioMatterId: childResolution.clioMatterId,
          clioDisplayNumber: childResolution.clioDisplayNumber || childDisplay,
          sourceRole: "bill" as const,
          sourceLabel: sourceLabel(childResolution.clioDisplayNumber || childDisplay, "bill"),
        };

        normalizedDocuments.push(...normalizeClioDocumentRows(childDocuments, childSource));
        sourceSummaries.push({
          ...childSource,
          documentCount: childDocuments.length,
        });
      }
    } else {
      const directDocuments = await listClioMatterDocuments(clioMatterId);
      const directSource = {
        clioMatterId,
        clioDisplayNumber,
        sourceRole: "bill" as const,
        sourceLabel: sourceLabel(clioDisplayNumber, "bill"),
      };

      normalizedDocuments = normalizeClioDocumentRows(directDocuments, directSource);
      sourceSummaries.push({
        ...directSource,
        documentCount: directDocuments.length,
      });
    }

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
      localMatterId: matterId || null,
      masterLawsuitId: masterLawsuitId || null,
      clioMatterId,
      clioDisplayNumber,
      localSource,
      documents: normalizedDocuments,
      sourceSummaries,
      summary: {
        documentCount: normalizedDocuments.length,
        sourceCount: sourceSummaries.length,
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
          usesReadOnlyExactFolderLookup: true,
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
