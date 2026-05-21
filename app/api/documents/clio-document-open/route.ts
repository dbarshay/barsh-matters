import { NextRequest, NextResponse } from "next/server";
import { clioFetch } from "@/lib/clio";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safeFilename(value: unknown): string {
  const raw = clean(value) || "document";
  return raw.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180) || "document";
}

async function getDocumentMetadata(documentId: string) {
  const fields = "id,name,latest_document_version{id,uuid,filename,size,content_type,fully_uploaded}";
  const res = await clioFetch(
    `/api/v4/documents/${encodeURIComponent(documentId)}.json?fields=${encodeURIComponent(fields)}`
  );

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      `Clio document metadata lookup failed: ${res.status} ${res.statusText} ${JSON.stringify(json).slice(0, 700)}`
    );
  }

  const data = json?.data || {};
  const version = data?.latest_document_version || {};

  return {
    documentId: clean(data?.id || documentId),
    documentName: clean(data?.name),
    filename: safeFilename(version?.filename || data?.name),
    contentType: clean(version?.content_type) || "application/octet-stream",
    versionUuid: clean(version?.uuid),
    fullyUploaded: Boolean(version?.fully_uploaded),
  };
}

export async function GET(req: NextRequest) {
  try {
    const documentId = clean(req.nextUrl.searchParams.get("documentId"));
    const mode = clean(req.nextUrl.searchParams.get("mode")) || "download";
    const requestedFilename = safeFilename(req.nextUrl.searchParams.get("filename"));

    if (!documentId) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-document-open",
          error: "Missing documentId.",
          safety: {
            readOnly: true,
            noClioRecordsChanged: true,
            noDatabaseRecordsChanged: true,
            noDocumentUploadsPerformed: true,
          },
        },
        { status: 400 }
      );
    }

    const metadata = await getDocumentMetadata(documentId);

    if (mode === "json") {
      return NextResponse.json({
        ok: true,
        action: "clio-document-open",
        documentId,
        filename: metadata.filename,
        requestedFilename,
        contentType: metadata.contentType,
        versionUuid: metadata.versionUuid,
        fullyUploaded: metadata.fullyUploaded,
        downloadPath: `/api/documents/clio-document-open?documentId=${encodeURIComponent(documentId)}&filename=${encodeURIComponent(metadata.filename)}`,
        inlinePath: `/api/documents/clio-document-open?documentId=${encodeURIComponent(documentId)}&filename=${encodeURIComponent(metadata.filename)}&mode=inline`,
        editPath: `/api/documents/clio-document-open?documentId=${encodeURIComponent(documentId)}&filename=${encodeURIComponent(metadata.filename)}&mode=edit`,
        safety: {
          readOnly: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noDocumentUploadsPerformed: true,
        },
      });
    }

    const downloadRes = await clioFetch(`/api/v4/documents/${encodeURIComponent(documentId)}/download`);

    if (!downloadRes.ok) {
      const text = await downloadRes.text().catch(() => "");
      throw new Error(
        `Clio document download failed: ${downloadRes.status} ${downloadRes.statusText}${text ? ` ${text.slice(0, 700)}` : ""}`
      );
    }

    const contentType = downloadRes.headers.get("content-type") || metadata.contentType || "application/octet-stream";
    const inlineMode = mode === "inline" || mode === "edit";
    const contentDisposition = inlineMode
      ? `inline; filename="${metadata.filename}"`
      : `attachment; filename="${metadata.filename}"`;

    return new NextResponse(downloadRes.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "no-store",
        "X-Barsh-Matters-Source": "clio-document-download",
        "X-Barsh-Matters-Clio-Document-Id": documentId,
        ...(metadata.versionUuid ? { "X-Barsh-Matters-Clio-Version-Uuid": metadata.versionUuid } : {}),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "clio-document-open",
        error: err?.message || "Could not open Clio document.",
        safety: {
          readOnly: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noDocumentUploadsPerformed: true,
        },
      },
      { status: 500 }
    );
  }
}
