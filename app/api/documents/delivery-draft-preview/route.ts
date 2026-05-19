import { NextRequest, NextResponse } from "next/server";
import {
  buildDocumentEmailBody,
  buildDocumentEmailSubject,
  type DocumentDeliveryContext,
  type DocumentDeliverySource,
} from "@/lib/documents/delivery";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSource(value: unknown): DocumentDeliverySource {
  const source = clean(value);
  if (
    source === "direct_matter" ||
    source === "master_lawsuit" ||
    source === "settlement" ||
    source === "other"
  ) {
    return source;
  }
  return "other";
}

function normalizeEmailList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean);
  }

  const single = clean(value);
  if (!single) return [];

  return single
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeContext(raw: Record<string, unknown>): DocumentDeliveryContext {
  return {
    source: normalizeSource(raw.source),
    documentKey: clean(raw.documentKey) || "document",
    documentLabel: clean(raw.documentLabel) || "Document",
    documentUrl: clean(raw.documentUrl) || undefined,
    pdfUrl: clean(raw.pdfUrl) || undefined,
    docxUrl: clean(raw.docxUrl) || undefined,
    subject: clean(raw.subject) || undefined,
    providerName: clean(raw.providerName) || undefined,
    patientName: clean(raw.patientName) || undefined,
    insurerName: clean(raw.insurerName) || undefined,
    indexNumber: clean(raw.indexNumber) || undefined,
    ourCaseNumber: clean(raw.ourCaseNumber) || undefined,
    suggestedRecipientName: clean(raw.suggestedRecipientName) || undefined,
    suggestedRecipientEmail: clean(raw.suggestedRecipientEmail) || undefined,
    suggestedCcEmail: clean(raw.suggestedCcEmail) || undefined,
    settledWithName: clean(raw.settledWithName) || undefined,
    settledWithEmail: clean(raw.settledWithEmail) || undefined,
    clioMaildropEmail: clean(raw.clioMaildropEmail) || undefined,
    matterId: clean(raw.matterId) || undefined,
    masterLawsuitId: clean(raw.masterLawsuitId) || undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = cleanObject(await req.json().catch(() => ({})));
    const context = normalizeContext(cleanObject(body.context || body));

    const to = normalizeEmailList(body.to || context.settledWithEmail || context.suggestedRecipientEmail);
    const cc = normalizeEmailList(body.cc || context.clioMaildropEmail || context.suggestedCcEmail);
    const bcc = normalizeEmailList(body.bcc);

    const subject = buildDocumentEmailSubject(context);
    const emailBody = buildDocumentEmailBody(context);

    const attachmentCandidates = [
      context.pdfUrl
        ? {
            type: "pdf",
            url: context.pdfUrl,
            requiredForFinalGraphDraft: true,
          }
        : null,
      context.documentUrl
        ? {
            type: "document",
            url: context.documentUrl,
            requiredForFinalGraphDraft: false,
          }
        : null,
      context.docxUrl
        ? {
            type: "docx",
            url: context.docxUrl,
            requiredForFinalGraphDraft: false,
          }
        : null,
    ].filter(Boolean);

    return NextResponse.json({
      ok: true,
      action: "document-delivery-draft-preview",
      previewOnly: true,
      graphReady: true,
      createsOutlookDraft: false,
      sendsEmail: false,
      attachesDocument: false,
      clioRecordsChanged: false,
      databaseRecordsChanged: false,
      printQueueChanged: false,
      draft: {
        to,
        cc,
        bcc,
        subject,
        body: emailBody,
        attachments: attachmentCandidates,
      },
      context,
      requirements: {
        settledWithEmailRequiredForTo: true,
        clioMaildropRequiredForCc: true,
        finalizedPdfRequiredForAttachment: true,
        microsoftGraphDraftBackendRequiredForRealAttachment: true,
      },
      note:
        "Preview only.  This route returns the Outlook/Microsoft Graph draft payload that Barsh Matters should create later.  It does not create a draft, send email, attach files, write to Clio, write to the database, or change the print queue.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-delivery-draft-preview",
        previewOnly: true,
        createsOutlookDraft: false,
        sendsEmail: false,
        attachesDocument: false,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        printQueueChanged: false,
        error: error?.message || "Document delivery draft preview failed.",
      },
      { status: 500 }
    );
  }
}
