import { NextRequest, NextResponse } from "next/server";
import { assertGraphDraftEnvironmentReady, graphApiBase, graphFetchJson, graphMailboxMessagesUrl } from "@/lib/graph/client";
import { clioFetch } from "@/lib/clio";
import { listClioMatterDocuments } from "@/lib/clioDocumentUpload";
import { requestMicrosoftGraphAppToken } from "@/lib/graph/token";
import { buildGraphDraftPayloadPreview, normalizeGraphRecipients } from "@/lib/graph/draft";
import { persistGraphDraftMetadata } from "@/lib/graph/emailPersistence";
import { resolveMaildropForGraphDraftMatterId } from "@/lib/graph/maildropForDraft";

export const dynamic = "force-dynamic";

const REQUIRED_CONFIRMATION = "create-graph-draft";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function safeAttachmentName(value: unknown): string {
  const raw = clean(value) || "document.pdf";
  return raw.replace(/[\\/:*?"<>|#%{}~&]+/g, "_").slice(0, 180) || "document.pdf";
}


async function resolveClioMatterIdForAttachment(attachment: any): Promise<number | null> {
  const directMatterId = Number(
    clean(attachment?.clioMatterId || attachment?.clioUploadTargetMatterId || attachment?.matterId)
  );
  if (Number.isFinite(directMatterId) && directMatterId > 0) return directMatterId;

  const displayNumber = clean(
    attachment?.clioDisplayNumber ||
    attachment?.masterDisplayNumber ||
    attachment?.matterDisplayNumber ||
    attachment?.clioUploadTargetDisplayNumber
  );

  if (!displayNumber) return null;

  const params = new URLSearchParams();
  params.set("query", displayNumber);
  params.set("fields", "id,display_number");

  const paths = [
    `/api/v4/matters.json?${params.toString()}`,
    `/api/v4/matters?${params.toString()}`,
    `/matters.json?${params.toString()}`,
  ];

  for (const path of paths) {
    const res = await clioFetch(path);
    if (!res.ok) continue;

    const json = await res.json().catch(() => null);
    const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    const exact =
      rows.find((row: any) => clean(row?.display_number).toLowerCase() === displayNumber.toLowerCase()) ||
      rows[0] ||
      null;

    const resolved = Number(exact?.id);
    if (Number.isFinite(resolved) && resolved > 0) return resolved;
  }

  return null;
}

async function resolveClioDocumentIdForAttachment(attachment: any, filename: string): Promise<string> {
  const existing =
    clean(attachment?.clioDocumentId) ||
    clean(attachment?.existingClioDocumentId) ||
    clean(attachment?.documentId) ||
    clean(attachment?.id);

  if (existing) return existing;

  const matterId = await resolveClioMatterIdForAttachment(attachment);
  if (!matterId) return "";

  const targetName = clean(
    filename ||
    attachment?.name ||
    attachment?.filename ||
    attachment?.clioDocumentName ||
    attachment?.existingClioDocumentName ||
    attachment?.pdfFilename ||
    attachment?.documentLabel
  ).toLowerCase();

  if (!targetName) return "";

  const documents = await listClioMatterDocuments(matterId);
  const exact =
    documents.find((doc: any) =>
      clean(doc?.name || doc?.filename || doc?.clioDocumentName).toLowerCase() === targetName
    ) ||
    documents.find((doc: any) => {
      const candidate = clean(doc?.name || doc?.filename || doc?.clioDocumentName).toLowerCase();
      return Boolean(candidate && (candidate.includes(targetName) || targetName.includes(candidate)));
    }) ||
    null;

  return clean(exact?.id);
}

async function downloadAttachmentBytesFromPlan(attachment: any): Promise<{
  name: string;
  contentType: string;
  contentBytes: string;
  byteLength: number;
  source: string;
}> {
  const name = safeAttachmentName(attachment?.name || attachment?.filename || "document.pdf");
  const contentType = clean(attachment?.contentType) || "application/pdf";
  let clioDocumentId =
    clean(attachment?.clioDocumentId) ||
    clean(attachment?.existingClioDocumentId) ||
    clean(attachment?.documentId) ||
    clean(attachment?.id);

  clioDocumentId = clioDocumentId || await resolveClioDocumentIdForAttachment(attachment, name);

  const clioDocumentVersionUuid =
    clean(attachment?.clioDocumentVersionUuid) ||
    clean(attachment?.existingClioDocumentVersionUuid) ||
    clean(attachment?.documentVersionUuid);

  if (clioDocumentId || clioDocumentVersionUuid) {
    const downloadPath = clioDocumentId
      ? `/api/v4/documents/${encodeURIComponent(clioDocumentId)}/download`
      : `/api/v4/document_versions/${encodeURIComponent(clioDocumentVersionUuid)}/download`;

    const downloadLabel = clioDocumentId || clioDocumentVersionUuid;
    const downloadSource = clioDocumentId ? "clio-document-download" : "clio-document-version-download";

    const downloadRes = await clioFetch(downloadPath);

    if (!downloadRes.ok) {
      const text = await downloadRes.text().catch(() => "");
      throw new Error(
        `Could not download finalized Clio document ${downloadLabel} for attachment: ${downloadRes.status} ${downloadRes.statusText}${text ? ` ${text.slice(0, 500)}` : ""}`
      );
    }

    const buffer = Buffer.from(await downloadRes.arrayBuffer());

    if (!buffer.byteLength) {
      throw new Error(`Finalized Clio document ${downloadLabel} downloaded as an empty file.`);
    }

    return {
      name,
      contentType: downloadRes.headers.get("content-type") || contentType,
      contentBytes: buffer.toString("base64"),
      byteLength: buffer.byteLength,
      source: downloadSource,
    };
  }

  throw new Error(`Attachment ${name} does not include a supported finalized-document source.`);
}

async function addFileAttachmentToGraphDraft(params: {
  mailboxUserId: string;
  messageId: string;
  attachment: {
    name: string;
    contentType: string;
    contentBytes: string;
  };
}) {
  const tokenResult = await requestMicrosoftGraphAppToken();

  if (!tokenResult.ok || !tokenResult.token?.accessToken) {
    throw new Error(tokenResult.error || "Microsoft Graph token request failed before attachment upload.");
  }

  const url =
    `${graphApiBase()}/users/${encodeURIComponent(params.mailboxUserId)}` +
    `/messages/${encodeURIComponent(params.messageId)}/attachments`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.token.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: params.attachment.name,
      contentType: params.attachment.contentType,
      contentBytes: params.attachment.contentBytes,
    }),
    cache: "no-store",
  });

  const text = await response.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(
      json?.error?.message ||
        text ||
        `Microsoft Graph attachment upload failed: ${response.status} ${response.statusText}`
    );
  }

  return {
    ok: true,
    status: response.status,
    statusText: response.statusText,
    json,
  };
}

export async function POST(req: NextRequest) {
  const confirm = req.nextUrl.searchParams.get("confirm") || "";

  let body: Record<string, any> = {};
  try {
    body = objectValue(await req.json().catch(() => ({})));
  } catch {
    body = {};
  }

  let context = objectValue(body.context);
  const draft = objectValue(body.draft);

  const resolvedMaildrop =
    !clean(context.clioMaildropEmail) && body?.matterId
      ? await resolveMaildropForGraphDraftMatterId(body.matterId)
      : null;

  if (resolvedMaildrop?.clioMaildropEmail) {
    context = {
      ...context,
      clioMaildropEmail: resolvedMaildrop.clioMaildropEmail,
      clioMaildropLabel: resolvedMaildrop.clioMaildropLabel,
    };
  }

  let to = normalizeGraphRecipients(body.to || draft.to || context.to || context.suggestedToEmail);
  let cc = normalizeGraphRecipients(
    body.cc ||
      draft.cc ||
      (context.clioMaildropEmail
        ? [{ name: context.clioMaildropLabel || "MailDrop", email: context.clioMaildropEmail }]
        : context.suggestedCcEmail)
  );
  let bcc = normalizeGraphRecipients(body.bcc || draft.bcc);

  if (resolvedMaildrop?.clioMaildropEmail) {
    const resolvedMaildropCc = normalizeGraphRecipients([
      {
        name: resolvedMaildrop.clioMaildropLabel,
        email: resolvedMaildrop.clioMaildropEmail,
      },
    ]);

    const existingCcEmails = new Set(
      cc
        .map((recipient) => clean(recipient.email).toLowerCase())
        .filter(Boolean)
    );
    const missingMaildropCc = resolvedMaildropCc.filter((recipient) => {
      const email = clean(recipient.email).toLowerCase();
      return email && !existingCcEmails.has(email);
    });

    if (missingMaildropCc.length > 0) {
      cc = [...cc, ...missingMaildropCc];
    }
  }

  const resolvedMatterId = context.matterId || body.matterId || null;
  const resolvedMatterDisplayNumber =
    clean(context.matterDisplayNumber || context.clioDisplayNumber) ||
    (resolvedMatterId && /^\d+$/.test(String(resolvedMatterId)) ? `BRL${String(resolvedMatterId)}` : "");

  const preview =
    body.graphDraftPayloadPreview && typeof body.graphDraftPayloadPreview === "object"
      ? body.graphDraftPayloadPreview
      : buildGraphDraftPayloadPreview({
          subject: clean(body.subject || draft.subject || context.subject) || "Document",
          bodyText: clean(body.bodyText || body.body || draft.body || context.body) || "Please see the attached document.",
          to,
          cc,
          bcc,
          attachments: Array.isArray(body.attachments)
            ? body.attachments
            : Array.isArray(draft.attachments)
              ? draft.attachments
              : [],
          matterContext: {
            source: clean(context.source),
            matterId: resolvedMatterId,
            matterDisplayNumber: resolvedMatterDisplayNumber,
            masterLawsuitId: clean(context.masterLawsuitId),
            clioMatterId: context.clioMatterId,
            clioDisplayNumber: clean(context.clioDisplayNumber),
            clioMaildropEmail: clean(context.clioMaildropEmail),
            clioMaildropLabel: clean(context.clioMaildropLabel),
          },
        });

  const responseBase = {
    action: "graph-create-draft",
    readOnly: false,
    failClosed: true,
    graphCallsMade: false,
    createsOutlookDraft: false,
    sendsEmail: false,
    readsMailbox: false,
    syncsMailbox: false,
    attachesDocument: false,
    attachmentUploadDeferred: true,
    clioRecordsChanged: false,
    databaseRecordsChanged: false,
    crossPlatformRuntime: true,
    localOutlookAutomationRequired: false,
  };

  if (confirm !== REQUIRED_CONFIRMATION) {
    return NextResponse.json(
      {
        ...responseBase,
        previewOnly: true,
        blocked: true,
        requiredConfirmation: REQUIRED_CONFIRMATION,
        payload: preview,
        note:
          "Fail-closed Graph draft creation route.  Add ?confirm=create-graph-draft to explicitly create an Outlook draft after Graph environment configuration and payload validation.",
      },
      { status: 400 }
    );
  }

  const env = assertGraphDraftEnvironmentReady();
  if (!env.ok) {
    return NextResponse.json(
      {
        ...responseBase,
        previewOnly: false,
        blocked: true,
        payload: preview,
        readiness: env.readiness,
        error: env.error,
      },
      { status: 400 }
    );
  }

  const attachmentPlanForReadiness = Array.isArray(preview?.attachmentPlan) ? preview.attachmentPlan : [];
  const sourceForReadiness = clean(
    preview?.matterContext?.source ||
    preview?.context?.source ||
    body?.source ||
    body?.context?.source ||
    body?.graphDraftPayloadPreview?.matterContext?.source ||
    body?.graphDraftPayloadPreview?.context?.source
  );
  const settlementFinalizedPdfDelivery = sourceForReadiness === "settlement_finalized_pdf_delivery";

  const normalizeSettlementAttachment = (attachment: any) => {
    const clioDocumentId =
      clean(attachment?.clioDocumentId) ||
      clean(attachment?.existingClioDocumentId) ||
      clean(attachment?.documentId) ||
      clean(attachment?.id);

    const clioDocumentVersionUuid =
      clean(attachment?.clioDocumentVersionUuid) ||
      clean(attachment?.documentVersionUuid) ||
      clean(attachment?.existingClioDocumentVersionUuid);

    const downloadUrl =
      clean(attachment?.downloadUrl) ||
      clean(attachment?.pdfUrl) ||
      clean(attachment?.url);

    const name =
      clean(attachment?.name) ||
      clean(attachment?.filename) ||
      clean(attachment?.clioDocumentName) ||
      clean(attachment?.existingClioDocumentName) ||
      "Finalized Settlement Document.pdf";

    return {
      ...attachment,
      name,
      filename: clean(attachment?.filename) || name,
      contentType: clean(attachment?.contentType) || "application/pdf",
      clioDocumentId,
      existingClioDocumentId: clean(attachment?.existingClioDocumentId) || clioDocumentId,
      documentId: clean(attachment?.documentId) || clioDocumentId,
      id: clean(attachment?.id) || clioDocumentId,
      clioMatterId: clean(attachment?.clioMatterId) || clean(attachment?.clioUploadTargetMatterId) || "",
      clioUploadTargetMatterId: clean(attachment?.clioUploadTargetMatterId) || clean(attachment?.clioMatterId) || "",
      clioDisplayNumber: clean(attachment?.clioDisplayNumber) || clean(attachment?.masterDisplayNumber) || "",
      masterDisplayNumber: clean(attachment?.masterDisplayNumber) || clean(attachment?.clioDisplayNumber) || "",
      clioDocumentVersionUuid,
      existingClioDocumentVersionUuid: clean(attachment?.existingClioDocumentVersionUuid) || clioDocumentVersionUuid,
      downloadUrl,
      graphUploadRequired: Boolean(clioDocumentId || clioDocumentVersionUuid || downloadUrl || attachment?.graphUploadRequired),
      requiredForFinalGraphDraft: true,
      source: clean(attachment?.source) || "settlement_finalized_pdf_delivery",
    };
  };

  if (settlementFinalizedPdfDelivery) {
    const contextAttachment = {
      ...(body?.context || {}),
      ...(body?.selectedFinalizedDocument || {}),
      ...(preview?.context || {}),
      ...(preview?.matterContext || {}),
      source: "settlement_finalized_pdf_delivery",
    };

    const normalizedSettlementAttachments = attachmentPlanForReadiness.map(normalizeSettlementAttachment);
    const contextFallbackAttachment = normalizeSettlementAttachment(contextAttachment);
    const hasNormalizedAttachment = normalizedSettlementAttachments.some((attachment: any) =>
      Boolean(clean(attachment?.clioDocumentId) || clean(attachment?.clioDocumentVersionUuid) || clean(attachment?.downloadUrl) || clean(attachment?.pdfUrl))
    );

    preview.attachmentPlan = hasNormalizedAttachment
      ? normalizedSettlementAttachments
      : [contextFallbackAttachment];
  }

  const normalizedAttachmentPlanForReadiness = Array.isArray(preview?.attachmentPlan) ? preview.attachmentPlan : [];
  const hasFinalizedSettlementPdfAttachment = normalizedAttachmentPlanForReadiness.some((attachment: any) =>
    Boolean(
      attachment?.graphUploadRequired &&
      (
        clean(attachment?.clioDocumentId) ||
        clean(attachment?.clioDocumentVersionUuid) ||
        clean(attachment?.downloadUrl) ||
        clean(attachment?.pdfUrl)
      )
    )
  );

  if (
    !preview?.validation?.readyForGraphDraftCreate &&
    !(settlementFinalizedPdfDelivery && hasFinalizedSettlementPdfAttachment)
  ) {
    return NextResponse.json(
      {
        ok: false,
        action: "graph-create-draft",
        graphCallsMade: false,
        createsOutlookDraft: false,
        error: "Graph draft payload is not ready for draft creation.",
        validation: preview?.validation || null,
        settlementFinalizedPdfDelivery,
        hasFinalizedSettlementPdfAttachment,
        settlementAttachmentDebug: settlementFinalizedPdfDelivery
          ? {
              sourceForReadiness,
              bodyContextKeys: Object.keys(body?.context || {}),
              selectedFinalizedDocumentKeys: Object.keys(body?.selectedFinalizedDocument || {}),
              previewContextKeys: Object.keys(preview?.context || {}),
              previewMatterContextKeys: Object.keys(preview?.matterContext || {}),
              rawAttachmentPlanCount: attachmentPlanForReadiness.length,
              rawAttachmentPlan: attachmentPlanForReadiness.map((attachment: any) => ({
                name: clean(attachment?.name),
                filename: clean(attachment?.filename),
                source: clean(attachment?.source),
                graphUploadRequired: Boolean(attachment?.graphUploadRequired),
                clioDocumentId: clean(attachment?.clioDocumentId),
                documentId: clean(attachment?.documentId),
                existingClioDocumentId: clean(attachment?.existingClioDocumentId),
                id: clean(attachment?.id),
                downloadUrl: clean(attachment?.downloadUrl),
                pdfUrl: clean(attachment?.pdfUrl),
                url: clean(attachment?.url),
              })),
              normalizedAttachmentPlanCount: normalizedAttachmentPlanForReadiness.length,
              normalizedAttachmentPlan: normalizedAttachmentPlanForReadiness.map((attachment: any) => ({
                name: clean(attachment?.name),
                filename: clean(attachment?.filename),
                source: clean(attachment?.source),
                graphUploadRequired: Boolean(attachment?.graphUploadRequired),
                clioDocumentId: clean(attachment?.clioDocumentId),
                clioDocumentVersionUuid: clean(attachment?.clioDocumentVersionUuid),
                downloadUrl: clean(attachment?.downloadUrl),
                pdfUrl: clean(attachment?.pdfUrl),
                url: clean(attachment?.url),
              })),
            }
          : null,
      },
      { status: 400 }
    );
  }

  const attachmentPlan = Array.isArray(preview.attachmentPlan) ? preview.attachmentPlan : [];
  const requiresAttachmentUpload = attachmentPlan.some((attachment: any) => Boolean(attachment?.graphUploadRequired));
  const allowMetadataOnlyDraft = clean(body.allowMetadataOnlyDraft) === "true";

  const graphPayload = preview.graphMessagePayload;
  const graphResult = await graphFetchJson({
    url: graphMailboxMessagesUrl(env.mailboxUserId),
    method: "POST",
    body: graphPayload,
  });

  if (!graphResult.ok) {
    return NextResponse.json(
      {
        ...responseBase,
        previewOnly: false,
        graphCallsMade: true,
        createsOutlookDraft: false,
        payload: preview,
        result: {
          ok: graphResult.ok,
          status: graphResult.status,
          statusText: graphResult.statusText,
          error: graphResult.error,
        },
      },
      { status: 502 }
    );
  }

  const draftMetadata = {
    graphMessageId: clean(graphResult.json?.id),
    internetMessageId: clean(graphResult.json?.internetMessageId),
    conversationId: clean(graphResult.json?.conversationId),
    subject: clean(graphResult.json?.subject),
    webLink: clean(graphResult.json?.webLink),
    createdDateTime: clean(graphResult.json?.createdDateTime),
    lastModifiedDateTime: clean(graphResult.json?.lastModifiedDateTime),
  };

  const attachmentUploads: any[] = [];
  const attachmentErrors: any[] = [];

  if (requiresAttachmentUpload && !allowMetadataOnlyDraft && draftMetadata.graphMessageId) {
    for (const attachment of attachmentPlan.filter((item: any) => Boolean(item?.graphUploadRequired))) {
      try {
        const file = await downloadAttachmentBytesFromPlan(attachment);
        const upload = await addFileAttachmentToGraphDraft({
          mailboxUserId: env.mailboxUserId,
          messageId: draftMetadata.graphMessageId,
          attachment: {
            name: file.name,
            contentType: file.contentType,
            contentBytes: file.contentBytes,
          },
        });

        attachmentUploads.push({
          ok: true,
          name: file.name,
          contentType: file.contentType,
          byteLength: file.byteLength,
          source: file.source,
          graphAttachmentId: clean(upload?.json?.id),
        });
      } catch (error: any) {
        attachmentErrors.push({
          ok: false,
          name: clean(attachment?.name),
          clioDocumentId: clean(attachment?.clioDocumentId),
          error: error?.message || "Attachment upload failed.",
        });
      }
    }
  }

  if (attachmentErrors.length > 0) {
    return NextResponse.json(
      {
        ...responseBase,
        previewOnly: false,
        graphCallsMade: true,
        createsOutlookDraft: true,
        attachesDocument: attachmentUploads.length > 0,
        attachmentUploadDeferred: false,
        attachmentUploads,
        attachmentErrors,
        payload: preview,
        draft: draftMetadata,
        error: "Outlook draft was created, but one or more finalized PDF attachments could not be uploaded.",
      },
      { status: 502 }
    );
  }

  const persisted = await persistGraphDraftMetadata({
    mailboxUserId: env.mailboxUserId,
    graphDraft: draftMetadata,
    payload: preview,
    context: {
      source: clean(context.source),
      matterId: resolvedMatterId,
      matterDisplayNumber: resolvedMatterDisplayNumber,
      masterLawsuitId: clean(context.masterLawsuitId),
      clioMatterId: context.clioMatterId,
      clioDisplayNumber: clean(context.clioDisplayNumber),
      clioMaildropEmail: clean(context.clioMaildropEmail),
      clioMaildropLabel: clean(context.clioMaildropLabel),
    },
  });

  return NextResponse.json({
    ...responseBase,
    previewOnly: false,
    graphCallsMade: true,
    createsOutlookDraft: true,
    databaseRecordsChanged: true,
    maildropResolutionAttempted: Boolean(body?.matterId),
    maildropResolvedForPayload: Boolean(resolvedMaildrop?.clioMaildropEmail),
    maildropResolutionSource: resolvedMaildrop?.source || null,
    payload: preview,
    draft: draftMetadata,
    persisted,
    note: attachmentUploads.length > 0
      ? "Outlook draft created through Microsoft Graph, finalized PDF attachment uploaded, and draft metadata persisted locally."
      : "Outlook draft created through Microsoft Graph and draft metadata persisted locally.  No finalized PDF attachment was uploaded.",
  });
}
