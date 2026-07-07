// Phase C — attach already-FILED documents to a native matter/lawsuit email.
//
// Security model: the caller sends filedDocumentId references, NOT raw Clio ids. We resolve those
// ids against FiledDocument rows that are scoped to THIS matter/lawsuit, so an operator can only ever
// attach documents that are actually filed to the file they're emailing from. The bytes live in the
// Clio vault (BM never duplicates them); we stream them out only to hand them to Microsoft Graph.

import { clioFetch } from "@/lib/clio";

// Microsoft Graph's SIMPLE fileAttachment (POST /messages/{id}/attachments) only accepts up to ~3 MB;
// files between the simple limit and the per-file cap are streamed via a Graph upload session instead
// (see matterEmail.ts) — no compression, no quality loss.
export const MATTER_EMAIL_SIMPLE_ATTACHMENT_BYTES = 3 * 1024 * 1024;

// Per-file cap (raw bytes). 20 MB comfortably covers scanned legal PDFs and multi-page records.
export const MATTER_EMAIL_MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

// The widely accepted email message-size standard is 25 MB (Gmail / Outlook.com / Yahoo all accept up
// to this). Attachments are base64-encoded on the wire (~33% larger than the raw file), so we budget
// the ENCODED total — not the raw total — to keep the delivered message safely under the 25 MB
// standard (leaving headroom for the body + headers). This is what actually protects deliverability.
export const MATTER_EMAIL_STANDARD_MESSAGE_BYTES = 25 * 1024 * 1024;
export const MATTER_EMAIL_MAX_TOTAL_ENCODED_BYTES = 24 * 1024 * 1024;

/** Base64-encoded size of a raw byte length (4 chars per 3 bytes, rounded up). */
function base64EncodedBytes(rawBytes: number): number {
  return Math.ceil(rawBytes / 3) * 4;
}

export type ResolvedFiledAttachment = {
  filedDocumentId: string;
  clioDocumentId: string;
  name: string;
  contentType: string;
  contentBytes: string; // base64
  byteLength: number;
};

export type ResolveFiledAttachmentsResult =
  | { ok: true; attachments: ResolvedFiledAttachment[] }
  | { ok: false; error: string };

function mib(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

function safeAttachmentName(name: string | null | undefined, fallback: string): string {
  const n = String(name || "").trim();
  return (n || fallback).replace(/[\\/:*?"<>|\r\n]/g, "_").slice(0, 200);
}

/**
 * Resolve + authorize requested filed-document ids for a matter/lawsuit and download their bytes from
 * Clio, ready to hand to Graph. Read-only against Clio; returns a clear error rather than throwing so
 * the send route can surface it to the operator without sending a half-formed email.
 */
export async function resolveFiledDocumentAttachments(
  prisma: any,
  opts: {
    matterId?: number | null;
    masterLawsuitId?: string | null;
    matterDisplayNumber?: string | null;
    filedDocumentIds: string[];
  },
): Promise<ResolveFiledAttachmentsResult> {
  const ids = Array.from(
    new Set((opts.filedDocumentIds || []).map((x) => String(x || "").trim()).filter(Boolean)),
  );
  if (ids.length === 0) return { ok: true, attachments: [] };

  // Authorization scope — an attachment must belong to the matter/lawsuit this email is filed to.
  const scope: any[] = [];
  if (Number.isFinite(opts.matterId as number) && (opts.matterId as number) > 0) scope.push({ matterId: opts.matterId });
  if (opts.masterLawsuitId) scope.push({ masterLawsuitId: opts.masterLawsuitId });
  if (opts.matterDisplayNumber) scope.push({ matterDisplayNumber: opts.matterDisplayNumber });
  if (scope.length === 0) {
    return { ok: false, error: "A matter or lawsuit is required before documents can be attached." };
  }

  const rows = await prisma.filedDocument.findMany({
    where: { id: { in: ids }, status: "active", OR: scope },
    select: { id: true, clioDocumentId: true, fileName: true, contentType: true },
  });

  const found = new Set(rows.map((r: any) => String(r.id)));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    return {
      ok: false,
      error: "One or more selected documents are not filed to this matter/lawsuit and cannot be attached.",
    };
  }

  const attachments: ResolvedFiledAttachment[] = [];
  let totalEncoded = 0;
  for (const row of rows as any[]) {
    const clioDocumentId = String(row.clioDocumentId || "").trim();
    const displayName = safeAttachmentName(row.fileName, "document.pdf");
    if (!clioDocumentId) {
      return { ok: false, error: `"${displayName}" has no stored file in the vault and cannot be attached.` };
    }

    const dl = await clioFetch(`/api/v4/documents/${encodeURIComponent(clioDocumentId)}/download`);
    if (!dl.ok) {
      const t = await dl.text().catch(() => "");
      return {
        ok: false,
        error: `Could not download "${displayName}" for attachment (${dl.status} ${dl.statusText}).${t ? ` ${t.slice(0, 200)}` : ""}`,
      };
    }

    const buf = Buffer.from(await dl.arrayBuffer());
    if (!buf.byteLength) {
      return { ok: false, error: `"${displayName}" downloaded as an empty file and cannot be attached.` };
    }
    if (buf.byteLength > MATTER_EMAIL_MAX_ATTACHMENT_BYTES) {
      return {
        ok: false,
        error: `"${displayName}" is ${mib(buf.byteLength)} MB — over the ${mib(MATTER_EMAIL_MAX_ATTACHMENT_BYTES)} MB per-file email attachment limit.`,
      };
    }
    totalEncoded += base64EncodedBytes(buf.byteLength);
    if (totalEncoded > MATTER_EMAIL_MAX_TOTAL_ENCODED_BYTES) {
      return {
        ok: false,
        error: `The selected attachments would push this email past the ${mib(MATTER_EMAIL_STANDARD_MESSAGE_BYTES)} MB size limit that most mail servers accept (files are ~33% larger once attached). Send fewer at a time.`,
      };
    }

    attachments.push({
      filedDocumentId: String(row.id),
      clioDocumentId,
      name: displayName,
      contentType: dl.headers.get("content-type") || String(row.contentType || "application/pdf"),
      contentBytes: buf.toString("base64"),
      byteLength: buf.byteLength,
    });
  }

  return { ok: true, attachments };
}
