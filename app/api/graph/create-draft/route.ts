import { NextRequest, NextResponse } from "next/server";
import { assertGraphDraftEnvironmentReady, graphFetchJson, graphMailboxMessagesUrl } from "@/lib/graph/client";
import { buildGraphDraftPayloadPreview, normalizeGraphRecipients } from "@/lib/graph/draft";

export const dynamic = "force-dynamic";

const REQUIRED_CONFIRMATION = "create-graph-draft";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

export async function POST(req: NextRequest) {
  const confirm = req.nextUrl.searchParams.get("confirm") || "";

  let body: Record<string, any> = {};
  try {
    body = objectValue(await req.json().catch(() => ({})));
  } catch {
    body = {};
  }

  const context = objectValue(body.context);
  const draft = objectValue(body.draft);

  const preview =
    body.graphDraftPayloadPreview && typeof body.graphDraftPayloadPreview === "object"
      ? body.graphDraftPayloadPreview
      : buildGraphDraftPayloadPreview({
          subject: clean(body.subject || draft.subject || context.subject) || "Document",
          bodyText: clean(body.bodyText || body.body || draft.body || context.body) || "Please see the attached document.",
          to: normalizeGraphRecipients(body.to || draft.to || context.to || context.suggestedToEmail),
          cc: normalizeGraphRecipients(
            body.cc ||
              draft.cc ||
              (context.clioMaildropEmail
                ? [{ name: context.clioMaildropLabel || "MailDrop", email: context.clioMaildropEmail }]
                : context.suggestedCcEmail)
          ),
          bcc: normalizeGraphRecipients(body.bcc || draft.bcc),
          attachments: Array.isArray(body.attachments)
            ? body.attachments
            : Array.isArray(draft.attachments)
              ? draft.attachments
              : [],
          matterContext: {
            source: clean(context.source),
            matterId: context.matterId,
            matterDisplayNumber: clean(context.matterDisplayNumber || context.clioDisplayNumber),
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

  if (!preview?.validation?.readyForGraphDraftCreate) {
    return NextResponse.json(
      {
        ...responseBase,
        previewOnly: false,
        blocked: true,
        payload: preview,
        error:
          "Graph draft payload is not ready.  The draft must have a To recipient, Clio MailDrop in Cc, and no MailDrop in Bcc.",
      },
      { status: 400 }
    );
  }

  const attachmentPlan = Array.isArray(preview.attachmentPlan) ? preview.attachmentPlan : [];
  const requiresAttachmentUpload = attachmentPlan.some((attachment: any) => Boolean(attachment?.graphUploadRequired));

  if (requiresAttachmentUpload && clean(body.allowMetadataOnlyDraft) !== "true") {
    return NextResponse.json(
      {
        ...responseBase,
        previewOnly: false,
        blocked: true,
        payload: preview,
        error:
          "Attachment upload is not wired yet.  Pass allowMetadataOnlyDraft=true only for an explicit metadata-only draft test, or wire Clio/finalized-document attachment upload first.",
      },
      { status: 400 }
    );
  }

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

  return NextResponse.json({
    ...responseBase,
    previewOnly: false,
    graphCallsMade: true,
    createsOutlookDraft: true,
    payload: preview,
    draft: {
      graphMessageId: clean(graphResult.json?.id),
      internetMessageId: clean(graphResult.json?.internetMessageId),
      conversationId: clean(graphResult.json?.conversationId),
      subject: clean(graphResult.json?.subject),
      webLink: clean(graphResult.json?.webLink),
      createdDateTime: clean(graphResult.json?.createdDateTime),
      lastModifiedDateTime: clean(graphResult.json?.lastModifiedDateTime),
    },
    note:
      "Outlook draft created through Microsoft Graph.  Attachments remain deferred until finalized-document upload support is wired.",
  });
}
