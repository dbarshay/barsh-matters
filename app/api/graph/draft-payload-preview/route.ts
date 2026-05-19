import { NextRequest, NextResponse } from "next/server";
import { buildGraphDraftPayloadPreview, normalizeGraphRecipients } from "@/lib/graph/draft";

export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

export async function POST(req: NextRequest) {
  try {
    const body = objectValue(await req.json().catch(() => ({})));
    const context = objectValue(body.context);
    const draft = objectValue(body.draft);

    const to = normalizeGraphRecipients(body.to || draft.to || context.suggestedToEmail || context.to);
    const cc = normalizeGraphRecipients(
      body.cc ||
        draft.cc ||
        (context.clioMaildropEmail
          ? [{ name: context.clioMaildropLabel || "MailDrop", email: context.clioMaildropEmail }]
          : context.suggestedCcEmail)
    );
    const bcc = normalizeGraphRecipients(body.bcc || draft.bcc);

    const attachments = Array.isArray(body.attachments)
      ? body.attachments
      : Array.isArray(draft.attachments)
        ? draft.attachments
        : [];

    const preview = buildGraphDraftPayloadPreview({
      subject: clean(body.subject || draft.subject || context.subject) || "Document",
      bodyText: clean(body.bodyText || body.body || draft.body || context.body) || "Please see the attached document.",
      to,
      cc,
      bcc,
      attachments,
      matterContext: {
        source: clean(context.source),
        matterId: context.matterId,
        matterDisplayNumber: clean(context.matterDisplayNumber),
        masterLawsuitId: clean(context.masterLawsuitId),
        clioMatterId: context.clioMatterId,
        clioDisplayNumber: clean(context.clioDisplayNumber),
        clioMaildropEmail: clean(context.clioMaildropEmail),
        clioMaildropLabel: clean(context.clioMaildropLabel),
      },
    });

    return NextResponse.json({
      action: "graph-draft-payload-preview",
      readOnly: true,
      previewOnly: true,
      graphCallsMade: false,
      createsOutlookDraft: false,
      sendsEmail: false,
      readsMailbox: false,
      syncsMailbox: false,
      clioRecordsChanged: false,
      databaseRecordsChanged: false,
      crossPlatformRuntime: true,
      localOutlookAutomationRequired: false,
      payload: preview,
      note:
        "Preview only.  This route converts Barsh Matters document delivery data into a Microsoft Graph draft-message payload shape.  It does not create a draft, send email, read a mailbox, write to Clio, or write to the database.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        action: "graph-draft-payload-preview",
        readOnly: true,
        previewOnly: true,
        graphCallsMade: false,
        createsOutlookDraft: false,
        sendsEmail: false,
        readsMailbox: false,
        syncsMailbox: false,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        error: error?.message || "Graph draft payload preview failed.",
      },
      { status: 500 }
    );
  }
}
