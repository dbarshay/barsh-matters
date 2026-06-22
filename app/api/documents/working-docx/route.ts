import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { uploadWorkingDocxToGraph } from "@/lib/documents/graphWorkingDocuments";
import { requestMicrosoftGraphAppToken } from "@/lib/graph/token";

export const runtime = "nodejs";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => clean(item)).filter(Boolean);
}

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}


async function loadFinalizePreview(req: NextRequest, params: {
  masterLawsuitId: string;
  uploadTargetMode?: string;
  directMatterId?: string | number | null;
  directMatterDisplayNumber?: string | null;
  documentLaunchMode?: string | null;
  settlementRecordId?: string | null;
  useSingleMasterClioStorage?: boolean;
}) {
  const settlementMode = clean(params.documentLaunchMode) === "settlement";
  const previewUrl = new URL(
    settlementMode ? "/api/settlements/documents-preview" : "/api/documents/finalize-preview",
    req.nextUrl.origin
  );
  previewUrl.searchParams.set("masterLawsuitId", params.masterLawsuitId);

  if (settlementMode && clean(params.settlementRecordId)) {
    previewUrl.searchParams.set("settlementRecordId", clean(params.settlementRecordId));
  }

  if (!settlementMode && clean(params.uploadTargetMode)) {
    previewUrl.searchParams.set("uploadTarget", clean(params.uploadTargetMode));
  }

  if (!settlementMode && clean(params.directMatterId)) {
    previewUrl.searchParams.set("directMatterId", clean(params.directMatterId));
  }

  if (!settlementMode && clean(params.directMatterDisplayNumber)) {
    previewUrl.searchParams.set("directMatterDisplayNumber", clean(params.directMatterDisplayNumber));
  }

  if (!settlementMode && params.useSingleMasterClioStorage) {
    previewUrl.searchParams.set("singleMasterClioStorage", "1");
  }

  const previewRes = await fetch(previewUrl, {
    method: "GET",
    cache: "no-store",
  });

  const previewJson = await previewRes.json().catch(() => null);

  if (!previewRes.ok || !previewJson) {
    throw new Error(previewJson?.error || "Could not load finalization preview before working DOCX creation.");
  }

  return previewJson;
}

async function generateDocumentBuffer(req: NextRequest, document: any) {
  const sourceUrl = new URL(document.sourceEndpoint, req.nextUrl.origin);

  const docRes = await fetch(sourceUrl, {
    method: "GET",
    cache: "no-store",
  });

  const contentType = docRes.headers.get("Content-Type") || "";

  if (!docRes.ok) {
    const text = await docRes.text().catch(() => "");
    throw new Error(
      `Document generation failed for ${document.label}: ${docRes.status} ${docRes.statusText}${text ? ` ${text}` : ""}`
    );
  }

  if (!contentType.includes(DOCX_CONTENT_TYPE)) {
    const text = await docRes.text().catch(() => "");
    throw new Error(
      `Document generation for ${document.label} did not return a DOCX response. Content-Type was ${contentType || "missing"}.${text ? ` Body: ${text}` : ""}`
    );
  }

  const buffer = Buffer.from(await docRes.arrayBuffer());

  if (!buffer.byteLength) {
    throw new Error(`Document generation returned an empty buffer for ${document.label}.`);
  }

  return buffer;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const masterLawsuitId = clean(body?.masterLawsuitId);
    const uploadTargetMode = clean(body?.uploadTargetMode || body?.uploadTarget || "master-lawsuit");
    const directMatterId = clean(body?.directMatterId);
    const directMatterDisplayNumber = clean(body?.directMatterDisplayNumber);
    const documentLaunchMode = clean(body?.documentLaunchMode);
    const settlementRecordId = clean(body?.settlementRecordId);
    const singleMasterDirectStorage = body?.singleMasterDirectStorage === true || body?.useSingleMasterClioStorage === true;
    const requestedKeys = asStringArray(body?.documentKeys);
    const confirmCreate = body?.confirmCreate === true;

    if (!masterLawsuitId && uploadTargetMode !== "direct-matter") {
      return NextResponse.json(
        { ok: false, action: "working-docx-create", error: "Missing masterLawsuitId." },
        { status: 400 }
      );
    }

    if (uploadTargetMode === "direct-matter" && !masterLawsuitId && !directMatterId && !directMatterDisplayNumber) {
      return NextResponse.json(
        { ok: false, action: "working-docx-create", error: "Missing directMatterId or directMatterDisplayNumber." },
        { status: 400 }
      );
    }

    if (!confirmCreate) {
      return NextResponse.json(
        {
          ok: false,
          action: "working-docx-create",
          error: "Working DOCX creation requires confirmCreate: true.",
          safety: {
            graphFileCreated: false,
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
          },
        },
        { status: 400 }
      );
    }

    const preview =
      uploadTargetMode === "direct-matter" && !masterLawsuitId
        ? await (async () => {
            const previewUrl = new URL("/api/documents/direct-finalize-preview", req.nextUrl.origin);
            if (directMatterId) previewUrl.searchParams.set("directMatterId", directMatterId);
            if (directMatterDisplayNumber) previewUrl.searchParams.set("directMatterDisplayNumber", directMatterDisplayNumber);
            if (singleMasterDirectStorage) previewUrl.searchParams.set("singleMasterDirectStorage", "1");
            const previewRes = await fetch(previewUrl, { method: "GET", cache: "no-store" });
            const previewJson = await previewRes.json().catch(() => null);
            if (!previewRes.ok || !previewJson) {
              throw new Error(previewJson?.error || "Could not load direct matter finalization preview before working DOCX creation.");
            }
            return previewJson;
          })()
        : await loadFinalizePreview(req, {
            masterLawsuitId,
            uploadTargetMode,
            directMatterId,
            directMatterDisplayNumber,
            documentLaunchMode,
            settlementRecordId,
            useSingleMasterClioStorage: singleMasterDirectStorage,
          });

    const plannedDocuments = Array.isArray(preview?.plannedDocuments) ? preview.plannedDocuments : [];
    const requestedDocument =
      plannedDocuments.find((document: any) => requestedKeys.includes(clean(document?.key))) || null;

    if (requestedKeys.length > 0 && !requestedDocument) {
      return NextResponse.json(
        {
          ok: false,
          action: "working-docx-create",
          error: "Requested document key is not available for this matter/template context.",
          requestedKeys,
          availableDocumentKeys: plannedDocuments.map((document: any) => clean(document?.key)).filter(Boolean),
          plannedDocumentCount: plannedDocuments.length,
          selectionPolicy: {
            allowsFallbackWhenRequestedKeyMissing: false,
            fallbackOnlyWhenNoRequestedKeys: true,
          },
          validation: preview?.validation || null,
        },
        { status: 422 }
      );
    }

    const selectedDocument =
      requestedDocument ||
      plannedDocuments.find((document: any) => document?.wouldGenerate && document?.availableNow);

    if (!selectedDocument?.sourceEndpoint) {
      return NextResponse.json(
        {
          ok: false,
          action: "working-docx-create",
          error: "No generated DOCX source endpoint is available for the selected document.",
          requestedKeys,
          plannedDocumentCount: plannedDocuments.length,
        },
        { status: 422 }
      );
    }

    if (!selectedDocument?.wouldGenerate || !selectedDocument?.availableNow) {
      return NextResponse.json(
        {
          ok: false,
          action: "working-docx-create",
          error: "Selected document is not generation-ready.",
          selectedDocument,
          validation: preview?.validation || null,
        },
        { status: 422 }
      );
    }

    const buffer = await generateDocumentBuffer(req, selectedDocument);
    const sourceDocxSha256 = sha256Hex(buffer);
    const graphTokenResult = await requestMicrosoftGraphAppToken();

    if (!graphTokenResult.ok || !graphTokenResult.token?.accessToken) {
      return NextResponse.json(
        {
          ok: false,
          action: "working-docx-create",
          error: graphTokenResult.error || "Could not acquire Microsoft Graph token for working DOCX upload.",
          graphTokenPreflight: {
            ok: graphTokenResult.ok,
            status: graphTokenResult.status,
            statusText: graphTokenResult.statusText,
            tokenReceived: false,
          },
          selectedDocument: {
            key: clean(selectedDocument.key),
            label: clean(selectedDocument.label),
            filename: clean(selectedDocument.filename),
            sourceEndpoint: clean(selectedDocument.sourceEndpoint),
            repositorySource: clean(selectedDocument.repositorySource),
            repositoryStatus: clean(selectedDocument.repositoryStatus),
            storageKind: clean(selectedDocument.storageKind),
            storedTemplateVersionId: clean(selectedDocument.storedTemplateVersionId),
            storedTemplateVersionNumber: selectedDocument.storedTemplateVersionNumber || null,
            hasStoredDocx: Boolean(selectedDocument.hasStoredDocx),
            generatedFromStoredDbDocx: clean(selectedDocument.repositorySource) === "barsh-matters-db" && clean(selectedDocument.storageKind) === "db-docx-base64",
          },
          sourceDocxByteLength: buffer.byteLength,
          safety: {
            graphFileCreated: false,
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
            finalPdfCreated: false,
            deliveryArtifactCreated: false,
          },
        },
        { status: 500 }
      );
    }

    const working = await uploadWorkingDocxToGraph({
      docxBuffer: buffer,
      filename: clean(selectedDocument.filename).toLowerCase().endsWith(".pdf")
        ? `${clean(selectedDocument.filename).slice(0, -4)}.docx`
        : clean(selectedDocument.filename),
      folder: "BarshMattersWorkingDocs",
      accessToken: graphTokenResult.token.accessToken,
    });

    return NextResponse.json({
      ok: true,
      action: "working-docx-create",
      masterLawsuitId,
      uploadTargetMode,
      singleMasterDirectStorage,
      directMatterId,
      directMatterDisplayNumber,
      selectedDocument: {
        key: clean(selectedDocument.key),
        label: clean(selectedDocument.label),
        filename: clean(selectedDocument.filename),
        sourceEndpoint: clean(selectedDocument.sourceEndpoint),
        repositorySource: clean(selectedDocument.repositorySource),
        repositoryStatus: clean(selectedDocument.repositoryStatus),
        storageKind: clean(selectedDocument.storageKind),
        storedTemplateVersionId: clean(selectedDocument.storedTemplateVersionId),
        storedTemplateVersionNumber: selectedDocument.storedTemplateVersionNumber || null,
        hasStoredDocx: Boolean(selectedDocument.hasStoredDocx),
        generatedFromStoredDbDocx: clean(selectedDocument.repositorySource) === "barsh-matters-db" && clean(selectedDocument.storageKind) === "db-docx-base64",
      },
      workingDocument: {
        ...working,
        sourceDocxByteLength: buffer.byteLength,
        sourceDocxSha256,
      },
      sourceDocxByteLength: buffer.byteLength,
      sourceDocxSha256,
      graphTokenPreflight: {
        ok: graphTokenResult.ok,
        status: graphTokenResult.status,
        statusText: graphTokenResult.statusText,
        tokenReceived: true,
      },
      sourceTemplateContract: {
        usesStoredDbDocx:
          clean(selectedDocument.repositorySource) === "barsh-matters-db" &&
          clean(selectedDocument.storageKind) === "db-docx-base64" &&
          Boolean(selectedDocument.hasStoredDocx),
        repositorySource: clean(selectedDocument.repositorySource),
        repositoryStatus: clean(selectedDocument.repositoryStatus),
        storageKind: clean(selectedDocument.storageKind),
        storedTemplateVersionId: clean(selectedDocument.storedTemplateVersionId),
        storedTemplateVersionNumber: selectedDocument.storedTemplateVersionNumber || null,
        sourceEndpoint: clean(selectedDocument.sourceEndpoint),
      },
      safety: {
        graphFileCreated: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        finalPdfCreated: false,
        deliveryArtifactCreated: false,
        storedDbDocxSourcePreserved:
          clean(selectedDocument.repositorySource) === "barsh-matters-db" &&
          clean(selectedDocument.storageKind) === "db-docx-base64",
      },
      note:
        "Working DOCX was created in Microsoft Graph/OneDrive for editing. Final delivery must still convert the latest edited DOCX to PDF before delivery.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "working-docx-create",
        error: err?.message || "Working DOCX creation failed.",
        safety: {
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
        },
      },
      { status: 500 }
    );
  }
}
