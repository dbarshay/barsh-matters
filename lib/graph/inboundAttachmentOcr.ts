// Phase D — inbound email attachment OCR ingestion.
//
// For an INBOUND email message, download its file attachments from Microsoft Graph, run the same OCR
// engine + classifier + cross-reference used by the Upload Docs flow, and stage the result on the
// EmailAttachment row as reviewStatus="pending" with an ocrSuggestion. NOTHING files to Clio here —
// filing is a separate, per-document, operator-confirmed step (see the review-queue API). Read-only
// against Clio and the reference registry; best-effort (an OCR failure never blocks the sync).

import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { extractDocument } from "@/lib/ocr";
import { persistExtraction } from "@/lib/ocr/persist";
import { suggestFolderTitle, mapOcrToTitleFields, mapBillToIntakeFields } from "@/lib/ocr/mapping";
import { getFolder } from "@/lib/documents/folderTaxonomy";
import { crossReferenceExtraction } from "@/lib/ocr/crossReference";
import {
  isInboundAttachmentOcrEnabled,
  INBOUND_ATTACHMENT_OCR_MAX_BYTES,
  INBOUND_ATTACHMENT_OCR_CONTENT_TYPES,
} from "@/lib/graph/inboundOcrConfig";

const enc = encodeURIComponent;

export type InboundOcrContext = {
  matterId?: number | null;
  masterLawsuitId?: string | null;
  matterDisplayNumber?: string | null;
};

export type InboundOcrIngestResult = {
  ok: boolean;
  processed: number;
  ocrPending: number;
  skipped: number;
  error?: string;
};

function isOcrableContentType(contentType: string | null | undefined): boolean {
  const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
  return INBOUND_ATTACHMENT_OCR_CONTENT_TYPES.includes(ct);
}

function bmFileNumberFrom(text: string): string | null {
  const brl = text.match(/\bBRL[_\s-]?(\d{9})\b/i);
  if (brl) return `BRL_${brl[1]}`;
  const dotted = text.match(/\b(\d{4}\.\d{2}\.\d{4,6})\b/);
  if (dotted) return dotted[1];
  return null;
}

/** Build the same classifier/identity/cross-reference bundle the Upload Docs OCR-prefill produces. */
async function buildOcrSuggestion(
  prisma: any,
  bytes: { base64: string; contentType?: string; fileName?: string },
  matterId: number | null,
) {
  const result = await extractDocument(bytes, "layout");

  const row = await persistExtraction({
    input: bytes,
    result,
    mode: "layout",
    sourceType: "email_attachment",
    matterId: matterId ?? null,
  });

  const classifierSuggestion = suggestFolderTitle(result);
  const intake = mapBillToIntakeFields(result);

  const folderKey = classifierSuggestion?.folderKey;
  const titleKey =
    classifierSuggestion?.titleKey ?? (folderKey ? getFolder(folderKey)?.titles[0]?.key : undefined);
  const prefill = folderKey && titleKey ? mapOcrToTitleFields(result, folderKey, titleKey) : {};

  const identity = {
    bmFileNumber: bmFileNumberFrom(result.text),
    patientName: intake.patientName.value || null,
    claimNumber: intake.claimNumber.value || null,
    policyNumber: intake.policyNumber.value || null,
    indexNumber: intake.indexNumber.value || null,
    dateFiled: intake.dateFiled.value || null,
    insurerName: intake.insurerName.value || null,
    providerName: intake.providerName.value || null,
    dateOfLoss: intake.dateOfLoss.value || null,
  };

  const crossRef = await crossReferenceExtraction(prisma, {
    patientName: identity.patientName,
    providerName: identity.providerName,
    insurerName: identity.insurerName,
    claimNumber: identity.claimNumber,
    policyNumber: identity.policyNumber,
    indexNumber: identity.indexNumber,
    bmFileNumber: identity.bmFileNumber,
  }).catch(() => null);

  const suggestion = {
    classifierSuggestion,
    suggestion: classifierSuggestion,
    folderKey: folderKey ?? null,
    titleKey: titleKey ?? null,
    prefill,
    identity,
    crossRef,
    meanConfidence: result.meanConfidence,
  };

  return {
    ocrExtractionId: row.id as string,
    predictedMatterId: (crossRef as any)?.predictedMatterId ?? null,
    suggestion,
  };
}

/**
 * Fetch the file attachments of an inbound Graph message and stage them for OCR review. Upserts one
 * EmailAttachment per file attachment (keyed by graphAttachmentId) and, when the type/size are
 * OCR-able, attaches an ocrSuggestion with reviewStatus="pending". Non-OCR-able files are still
 * queued (reviewStatus="pending", no suggestion) so the operator can file them manually.
 */
export async function ingestInboundMessageAttachments(
  prisma: any,
  params: {
    mailboxUserId: string;
    graphMessageId: string;
    localMessageId: string;
    context?: InboundOcrContext;
  },
): Promise<InboundOcrIngestResult> {
  if (!isInboundAttachmentOcrEnabled()) {
    return { ok: false, processed: 0, ocrPending: 0, skipped: 0, error: "inbound-attachment-ocr-disabled" };
  }

  const base = graphApiBase();
  const list = await graphFetchJson({
    url: `${base}/users/${enc(params.mailboxUserId)}/messages/${enc(params.graphMessageId)}/attachments`,
    method: "GET",
  });
  if (!list.ok) {
    return { ok: false, processed: 0, ocrPending: 0, skipped: 0, error: list.error || "attachment-list-failed" };
  }

  const attachments: any[] = Array.isArray(list.json?.value) ? list.json.value : [];
  const ctx = params.context || {};
  const matterId = Number.isFinite(ctx.matterId as number) && (ctx.matterId as number) > 0 ? (ctx.matterId as number) : null;

  let processed = 0;
  let ocrPending = 0;
  let skipped = 0;

  for (const att of attachments) {
    const isFile = String(att?.["@odata.type"] || "").toLowerCase().includes("fileattachment");
    if (!isFile || att?.isInline) {
      skipped++;
      continue;
    }

    const graphAttachmentId = String(att?.id || "");
    const name = String(att?.name || "attachment");
    const contentType = String(att?.contentType || "application/octet-stream");
    const sizeBytes = Number(att?.size) || null;

    // Idempotent on re-sync: if we've already recorded this attachment (queued, filed, or dismissed),
    // leave it alone — don't re-fetch bytes or re-OCR.
    const existing = graphAttachmentId
      ? await prisma.emailAttachment.findFirst({
          where: { messageId: params.localMessageId, graphAttachmentId },
          select: { id: true },
        })
      : null;
    if (existing) {
      skipped++;
      continue;
    }

    const created = await prisma.emailAttachment.create({
      data: {
        messageId: params.localMessageId,
        provider: "microsoft_graph",
        graphAttachmentId: graphAttachmentId || null,
        name,
        contentType,
        sizeBytes,
        isInline: false,
        storageStatus: "graph_only",
        reviewStatus: "pending",
      },
      select: { id: true },
    });
    const recordId = created.id;

    processed++;

    // OCR only sensible types within the size cap; everything else stays pending for manual filing.
    const contentBytes = typeof att?.contentBytes === "string" ? att.contentBytes : "";
    const withinSize = !sizeBytes || sizeBytes <= INBOUND_ATTACHMENT_OCR_MAX_BYTES;
    if (!contentBytes || !isOcrableContentType(contentType) || !withinSize) {
      await prisma.emailAttachment.update({
        where: { id: recordId },
        data: { reviewStatus: "pending" },
      });
      continue;
    }

    try {
      const built = await buildOcrSuggestion(prisma, { base64: contentBytes, contentType, fileName: name }, matterId);
      await prisma.emailAttachment.update({
        where: { id: recordId },
        data: {
          reviewStatus: "pending",
          ocrSuggestion: built.suggestion as any,
          ocrExtractionId: built.ocrExtractionId,
          ocrPredictedMatterId: built.predictedMatterId,
        },
      });
      ocrPending++;
    } catch {
      // OCR failure is non-fatal — leave it pending without a suggestion.
      await prisma.emailAttachment.update({ where: { id: recordId }, data: { reviewStatus: "pending" } });
    }
  }

  return { ok: true, processed, ocrPending, skipped };
}
