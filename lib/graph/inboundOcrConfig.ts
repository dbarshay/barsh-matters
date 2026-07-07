// Phase D — inbound email attachment OCR feature flag. Mirrors lib/graph/matterEmailConfig.ts.
// Enable with env BARSH_INBOUND_ATTACHMENT_OCR_ENABLED=1 (or "true"/"yes"/"on").
//
// This gates ingestion of inbound email attachments into the OCR review queue. Off = inbound
// attachments are recorded as metadata only (existing behavior); no bytes are downloaded and no OCR
// runs. Even when ON, nothing files to Clio without explicit per-document operator confirmation.
export function isInboundAttachmentOcrEnabled(): boolean {
  const v = String(process.env.BARSH_INBOUND_ATTACHMENT_OCR_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export const INBOUND_ATTACHMENT_OCR_DISABLED_MESSAGE =
  "Inbound attachment OCR is disabled. Set BARSH_INBOUND_ATTACHMENT_OCR_ENABLED=1 to enable.";

// Cap OCR'd attachments to sane sizes (skip huge files during ingestion; operator can still open them).
export const INBOUND_ATTACHMENT_OCR_MAX_BYTES = 15 * 1024 * 1024;

// Content types we attempt to OCR. Others are recorded but left for manual handling.
export const INBOUND_ATTACHMENT_OCR_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/tiff",
];
