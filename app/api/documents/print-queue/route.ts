import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findExistingClioDocumentsByFilename,
  listClioMatterDocuments,
} from "@/lib/clioDocumentUpload";
import { clioFetch } from "@/lib/clio";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function positiveInt(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toJsonSafe(value: unknown): any {
  if (value == null) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

const PRINT_QUEUE_STATUS_TRANSITIONS: Record<string, {
  status: string;
  printDecision: string | null;
  setPrintedAt: boolean;
}> = {
  queued: {
    status: "queued",
    printDecision: null,
    setPrintedAt: false,
  },
  printed: {
    status: "printed",
    printDecision: "printed",
    setPrintedAt: true,
  },
  hold: {
    status: "hold",
    printDecision: "hold",
    setPrintedAt: false,
  },
  skipped: {
    status: "skipped",
    printDecision: "skipped",
    setPrintedAt: false,
  },
};

function allowedPrintQueueStatus(value: unknown): string {
  const status = clean(value).toLowerCase();

  if (!PRINT_QUEUE_STATUS_TRANSITIONS[status]) {
    return "";
  }

  return status;
}

async function verifyClioDocumentById(documentId: string) {
  const cleanDocumentId = clean(documentId);

  if (!cleanDocumentId) return null;

  const fields = "id,name,latest_document_version{id,uuid,filename,size,content_type,fully_uploaded}";
  const res = await clioFetch(
    `/api/v4/documents/${encodeURIComponent(cleanDocumentId)}.json?fields=${encodeURIComponent(fields)}`
  );

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    return null;
  }

  const data = json?.data || {};
  const version = data?.latest_document_version || {};

  return {
    id: data.id || cleanDocumentId,
    name: data.name || "",
    filename: version.filename || data.name || "",
    createdAt: null,
    updatedAt: null,
    latestDocumentVersion: version,
  };
}

function uniqueQueueKeyFor(candidate: any): string {
  const masterLawsuitId = clean(candidate?.masterLawsuitId);
  const masterMatterId = clean(candidate?.masterMatterId);
  const clioDocumentId = clean(candidate?.clioDocumentId);
  const clioDocumentVersionUuid = clean(candidate?.clioDocumentVersionUuid);
  const filename = clean(candidate?.filename).toLowerCase();
  const documentKey = clean(candidate?.key).toLowerCase();

  return [
    masterLawsuitId,
    masterMatterId,
    clioDocumentId || "no-document-id",
    clioDocumentVersionUuid || "no-version-uuid",
    filename,
    documentKey,
  ].join("|");
}

async function loadVerifiedPrintCandidates(req: NextRequest, masterLawsuitId: string) {
  const previewUrl = new URL("/api/documents/print-queue-preview", req.nextUrl.origin);
  previewUrl.searchParams.set("masterLawsuitId", masterLawsuitId);
  previewUrl.searchParams.set("limit", "100");

  const previewRes = await fetch(previewUrl, {
    method: "GET",
    cache: "no-store",
  });

  const previewJson = await previewRes.json().catch(() => null);

  if (!previewRes.ok || !previewJson?.ok) {
    throw new Error(
      previewJson?.error || "Could not load verified print queue preview."
    );
  }

  const candidates = Array.isArray(previewJson?.candidateDocuments)
    ? previewJson.candidateDocuments
    : [];

  return {
    preview: previewJson,
    candidates: candidates.filter(
      (candidate: any) => candidate?.currentClioExistenceVerified === true
    ),
  };
}

export async function GET(req: NextRequest) {
  try {
    const masterLawsuitId = clean(req.nextUrl.searchParams.get("masterLawsuitId"));
    const status = clean(req.nextUrl.searchParams.get("status"));
    const limit = positiveInt(req.nextUrl.searchParams.get("limit"), 50, 200);
    const finalizedPdfOnly = clean(req.nextUrl.searchParams.get("finalizedPdfOnly")) === "true";
    const dedupeClioDocumentId = clean(req.nextUrl.searchParams.get("dedupeClioDocumentId")) !== "false";

    const whereBase = {
      ...(masterLawsuitId ? { masterLawsuitId } : {}),
    };

    const rows = await prisma.documentPrintQueueItem.findMany({
      where: {
        ...whereBase,
        ...(status ? { status } : {}),
      },
      orderBy: { queuedAt: "desc" },
      take: limit,
    });

    const groupedCounts = await prisma.documentPrintQueueItem.groupBy({
      by: ["status"],
      where: whereBase,
      _count: {
        _all: true,
      },
    });

    const statusCounts = groupedCounts.reduce(
      (acc: Record<string, number>, row: any) => {
        const key = clean(row.status) || "unknown";
        acc[key] = Number(row._count?._all || 0);
        acc.all += Number(row._count?._all || 0);
        return acc;
      },
      {
        all: 0,
        queued: 0,
        printed: 0,
        hold: 0,
        skipped: 0,
      }
    );

    let displayRows = rows;

    if (finalizedPdfOnly) {
      displayRows = displayRows.filter((row: any) =>
        clean(row?.filename).toLowerCase().endsWith(".pdf") && clean(row?.clioDocumentId)
      );
    }

    if (dedupeClioDocumentId) {
      const seen = new Set<string>();
      displayRows = displayRows.filter((row: any) => {
        const clioDocumentId = clean(row?.clioDocumentId);
        const documentKey = clean(row?.documentKey).toLowerCase();
        const dedupeKey = clioDocumentId ? `${clioDocumentId}|${documentKey}` : "";
        if (!dedupeKey) return true;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });
    }

    return NextResponse.json({
      ok: true,
      action: "print-queue-list",
      generatedAt: new Date().toISOString(),
      masterLawsuitId: masterLawsuitId || null,
      status: status || null,
      count: displayRows.length,
      rawCount: rows.length,
      finalizedPdfOnly,
      dedupeClioDocumentId,
      statusCounts,
      rows: displayRows,
      safety: {
        readOnly: true,
        noClioRecordsChanged: true,
        noDatabaseRecordsChanged: true,
        noOneDriveOrSharePointFoldersCreated: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "print-queue-list",
        error: err?.message || "Could not load print queue.",
        safety: {
          readOnly: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noOneDriveOrSharePointFoldersCreated: true,
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const masterLawsuitId = clean(body?.masterLawsuitId);
    const confirmAdd = body?.confirmAdd === true;
    const requestedUniqueQueueKeys = Array.isArray(body?.uniqueQueueKeys)
      ? body.uniqueQueueKeys.map((value: unknown) => clean(value)).filter(Boolean)
      : [];
    const directMatterCandidates = Array.isArray(body?.directMatterCandidates)
      ? body.directMatterCandidates
      : [];

    if (!masterLawsuitId) {
      return NextResponse.json(
        {
          ok: false,
          action: "print-queue-add",
          error: "Missing masterLawsuitId.",
          safety: {
            noPrintQueueRecordsCreated: true,
            noClioRecordsChanged: true,
            noOneDriveOrSharePointFoldersCreated: true,
          },
        },
        { status: 400 }
      );
    }

    if (!confirmAdd) {
      return NextResponse.json(
        {
          ok: false,
          action: "print-queue-add",
          error: "Print queue records were not created.  This endpoint requires confirmAdd: true.",
          safety: {
            explicitActionRequired: true,
            noPrintQueueRecordsCreated: true,
            noClioRecordsChanged: true,
            noOneDriveOrSharePointFoldersCreated: true,
          },
        },
        { status: 400 }
      );
    }

    let preview: any = null;
    let candidates: any[] = [];

    if (directMatterCandidates.length > 0) {
      const verifiedDirectCandidates: any[] = [];
      const verificationErrors: any[] = [];

      for (const rawCandidate of directMatterCandidates) {
        const masterMatterId =
          numberOrNull(rawCandidate?.clioMatterId) ||
          numberOrNull(body?.clioMatterId) ||
          numberOrNull(rawCandidate?.masterMatterId) ||
          numberOrNull(rawCandidate?.directMatterId) ||
          numberOrNull(body?.directMatterId);
        const clioDocumentId = clean(rawCandidate?.clioDocumentId || rawCandidate?.documentId || rawCandidate?.id);
        const filename = clean(rawCandidate?.filename || rawCandidate?.clioDocumentName || rawCandidate?.name);

        if (!masterMatterId || !clioDocumentId) {
          verificationErrors.push({
            filename,
            clioDocumentId,
            masterMatterId,
            error: "Direct matter print candidate requires a direct matter ID and Clio document ID.",
          });
          continue;
        }

        const currentDocuments = await listClioMatterDocuments(masterMatterId);
        const wantedId = Number(clioDocumentId);
        const byId = currentDocuments.find((document: any) => Number(document?.id) === wantedId);
        let byFilename: any | null = byId
          ? byId
          : findExistingClioDocumentsByFilename(currentDocuments, filename)[0] || null;

        if (!byFilename && clioDocumentId) {
          byFilename = await verifyClioDocumentById(clioDocumentId);
        }

        if (!byFilename) {
          verificationErrors.push({
            filename,
            clioDocumentId,
            masterMatterId,
            error: "No current matching document was found in this direct matter's Clio Documents tab or by Clio document ID lookup.",
          });
          continue;
        }

        const version = byFilename.latestDocumentVersion || {};

        verifiedDirectCandidates.push({
          ...rawCandidate,
          key: clean(rawCandidate?.key) || clean(rawCandidate?.documentKey) || filename,
          label: clean(rawCandidate?.label) || clean(rawCandidate?.documentLabel) || filename,
          filename: clean(version.filename) || filename || clean(byFilename.filename) || clean(byFilename.name),
          masterLawsuitId,
          masterMatterId,
          masterDisplayNumber:
            clean(rawCandidate?.masterDisplayNumber) ||
            clean(rawCandidate?.directMatterDisplayNumber) ||
            clean(rawCandidate?.matterDisplayNumber) ||
            null,
          clioDocumentId: clean(byFilename.id || clioDocumentId),
          clioDocumentName: clean(byFilename.name || rawCandidate?.clioDocumentName || filename),
          clioDocumentVersionUuid: clean(version.uuid || rawCandidate?.clioDocumentVersionUuid),
          currentClioExistenceVerified: true,
          currentClioExistenceMatch: {
            id: byFilename.id,
            name: byFilename.name,
            filename: byFilename.filename,
            createdAt: byFilename.createdAt,
            updatedAt: byFilename.updatedAt,
            latestDocumentVersion: byFilename.latestDocumentVersion,
          },
          printCandidateReason:
            "Direct matter finalized PDF candidate supplied by the UI and verified against the current direct matter Clio Documents tab.",
          source: "direct_matter",
        });
      }

      preview = {
        ok: true,
        action: "print-queue-direct-candidates",
        masterLawsuitId,
        candidateDocumentCount: verifiedDirectCandidates.length,
        verificationErrors,
        verification: {
          currentClioExistenceVerified: verifiedDirectCandidates.length > 0,
          directMatterCandidateMode: true,
        },
      };
      candidates = verifiedDirectCandidates;
    } else {
      const loaded = await loadVerifiedPrintCandidates(
        req,
        masterLawsuitId
      );
      preview = loaded.preview;
      candidates = loaded.candidates;
    }

    const selectedCandidates = candidates
      .map((candidate: any) => ({
        ...candidate,
        uniqueQueueKey: uniqueQueueKeyFor(candidate),
      }))
      .filter((candidate: any) => {
        if (!requestedUniqueQueueKeys.length) return true;
        return requestedUniqueQueueKeys.includes(candidate.uniqueQueueKey);
      });

    if (!selectedCandidates.length) {
      return NextResponse.json(
        {
          ok: false,
          action: "print-queue-add",
          masterLawsuitId,
          error: "No currently Clio-verified print candidates were available to add.",
          previewSummary: {
            candidateDocumentCount: preview?.candidateDocumentCount ?? null,
            currentClioExistenceVerified:
              preview?.verification?.currentClioExistenceVerified === true,
            directMatterCandidateMode:
              preview?.verification?.directMatterCandidateMode === true,
            verificationErrors: Array.isArray(preview?.verificationErrors)
              ? preview.verificationErrors
              : [],
          },
          safety: {
            explicitActionRequired: true,
            noPrintQueueRecordsCreated: true,
            noClioRecordsChanged: true,
            noOneDriveOrSharePointFoldersCreated: true,
          },
        },
        { status: 400 }
      );
    }

    const created: any[] = [];
    const existing: any[] = [];

    for (const candidate of selectedCandidates) {
      const uniqueQueueKey = candidate.uniqueQueueKey;
      const prior = await prisma.documentPrintQueueItem.findUnique({
        where: { uniqueQueueKey },
      });

      if (prior) {
        existing.push(prior);
        continue;
      }

      const existingByClioDocument = clean(candidate.clioDocumentId)
        ? await prisma.documentPrintQueueItem.findFirst({
            where: {
              clioDocumentId: clean(candidate.clioDocumentId),
              documentKey: clean(candidate.key) || clean(candidate.filename),
            },
            orderBy: { queuedAt: "desc" },
          })
        : null;

      if (existingByClioDocument) {
        existing.push(existingByClioDocument);
        continue;
      }

      const finalizationId = numberOrNull(candidate.finalizationId);
      const masterMatterId = numberOrNull(candidate.masterMatterId);

      if (!masterMatterId) {
        throw new Error(
          `Cannot add ${candidate.filename || candidate.key || "document"} to print queue because the master matter ID is missing.`
        );
      }

      const record = await prisma.documentPrintQueueItem.create({
        data: {
          uniqueQueueKey,
          masterLawsuitId,
          masterMatterId,
          masterDisplayNumber: clean(candidate.masterDisplayNumber) || null,
          finalizationId,
          documentKey: clean(candidate.key) || clean(candidate.filename),
          documentLabel: clean(candidate.label) || null,
          filename: clean(candidate.filename),
          clioDocumentId: clean(candidate.clioDocumentId) || null,
          clioDocumentName: clean(candidate.clioDocumentName) || null,
          clioDocumentVersionUuid:
            clean(candidate.clioDocumentVersionUuid) || null,
          status: "queued",
          documentSnapshot: toJsonSafe(candidate),
          sourceFinalizationSnapshot: toJsonSafe({
            finalizationId,
            masterLawsuitId,
            masterMatterId,
            masterDisplayNumber: candidate.masterDisplayNumber,
            finalizedAt: candidate.finalizedAt,
          }),
        },
      });

      created.push(record);
    }

    return NextResponse.json({
      ok: true,
      action: "print-queue-add",
      masterLawsuitId,
      createdCount: created.length,
      existingCount: existing.length,
      requestedCandidateCount: selectedCandidates.length,
      created,
      existing,
      safety: {
        explicitActionConfirmed: true,
        printQueueRecordsCreated: created.length,
        duplicateQueueRecordsSkipped: existing.length,
        onlyClioVerifiedCandidatesAccepted: true,
        noClioRecordsChanged: true,
        noDocumentUploadsPerformed: true,
        noOneDriveOrSharePointFoldersCreated: true,
        clioDocumentsTabRemainsSourceOfTruth: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "print-queue-add",
        error: err?.message || "Could not add documents to print queue.",
        safety: {
          noClioRecordsChanged: true,
          noDocumentUploadsPerformed: true,
          noOneDriveOrSharePointFoldersCreated: true,
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = numberOrNull(body?.id);
    const nextStatus = allowedPrintQueueStatus(body?.status);
    const notes = clean(body?.notes);
    const confirmStatusUpdate = body?.confirmStatusUpdate === true;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          action: "print-queue-status-update",
          error: "Missing print queue item id.",
          safety: {
            noPrintQueueRecordsChanged: true,
            noClioRecordsChanged: true,
            noDocumentUploadsPerformed: true,
            noOneDriveOrSharePointFoldersCreated: true,
            noDocumentContentsChanged: true,
          },
        },
        { status: 400 }
      );
    }

    if (!nextStatus) {
      return NextResponse.json(
        {
          ok: false,
          action: "print-queue-status-update",
          error: "Invalid status.  Allowed statuses are queued, printed, hold, and skipped.",
          allowedStatuses: Object.keys(PRINT_QUEUE_STATUS_TRANSITIONS),
          safety: {
            noPrintQueueRecordsChanged: true,
            noClioRecordsChanged: true,
            noDocumentUploadsPerformed: true,
            noOneDriveOrSharePointFoldersCreated: true,
            noDocumentContentsChanged: true,
          },
        },
        { status: 400 }
      );
    }

    if (!confirmStatusUpdate) {
      return NextResponse.json(
        {
          ok: false,
          action: "print-queue-status-update",
          error: "Print queue status was not updated.  This endpoint requires confirmStatusUpdate: true.",
          safety: {
            explicitActionRequired: true,
            noPrintQueueRecordsChanged: true,
            noClioRecordsChanged: true,
            noDocumentUploadsPerformed: true,
            noOneDriveOrSharePointFoldersCreated: true,
            noDocumentContentsChanged: true,
          },
        },
        { status: 400 }
      );
    }

    const existing = await prisma.documentPrintQueueItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          action: "print-queue-status-update",
          error: `No print queue item exists with id ${id}.`,
          safety: {
            noPrintQueueRecordsChanged: true,
            noClioRecordsChanged: true,
            noDocumentUploadsPerformed: true,
            noOneDriveOrSharePointFoldersCreated: true,
            noDocumentContentsChanged: true,
          },
        },
        { status: 404 }
      );
    }

    const transition = PRINT_QUEUE_STATUS_TRANSITIONS[nextStatus];

    const updated = await prisma.documentPrintQueueItem.update({
      where: { id },
      data: {
        status: transition.status,
        printDecision: transition.printDecision,
        printedAt: transition.setPrintedAt
          ? existing.printedAt ?? new Date()
          : nextStatus === "queued"
            ? null
            : existing.printedAt,
        notes: notes || existing.notes,
      },
    });

    return NextResponse.json({
      ok: true,
      action: "print-queue-status-update",
      id,
      previousStatus: existing.status,
      status: updated.status,
      printDecision: updated.printDecision,
      printedAt: updated.printedAt,
      notes: updated.notes,
      row: updated,
      safety: {
        explicitActionConfirmed: true,
        onlyLocalPrintQueueRecordChanged: true,
        noClioRecordsChanged: true,
        noDocumentUploadsPerformed: true,
        noOneDriveOrSharePointFoldersCreated: true,
        noDocumentContentsChanged: true,
        clioDocumentsTabRemainsSourceOfTruth: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "print-queue-status-update",
        error: err?.message || "Could not update print queue status.",
        safety: {
          noClioRecordsChanged: true,
          noDocumentUploadsPerformed: true,
          noOneDriveOrSharePointFoldersCreated: true,
          noDocumentContentsChanged: true,
        },
      },
      { status: 500 }
    );
  }
}

