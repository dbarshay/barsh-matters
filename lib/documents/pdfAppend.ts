// Append attachment documents to the end of a generated PDF.
//
// Used by document generation (individual matters and lawsuits): after the template PDF is produced,
// the user's selected attachments are concatenated AFTER the last page. PDFs are copied page-for-page;
// JPEG/PNG images are placed one-per-page scaled to fit a letter page. Anything else is surfaced as
// unsupported (never silently dropped) so the caller can tell the user which files could not be attached.
import { PDFDocument } from "pdf-lib";

export type PdfAppendAttachmentInput = {
  id?: string;
  name: string;
  contentType?: string | null;
  bytes: Uint8Array;
};

export type PdfAppendAttachmentResult = {
  id?: string;
  name: string;
  attached: boolean;
  pagesAdded: number;
  reason?: string;
};

export type PdfAppendResult = {
  pdfBytes: Uint8Array;
  results: PdfAppendAttachmentResult[];
  attachedCount: number;
  skipped: PdfAppendAttachmentResult[];
};

const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;

type AttachmentKind = "pdf" | "jpg" | "png" | "unsupported";

function detectKind(input: PdfAppendAttachmentInput): AttachmentKind {
  const bytes = input.bytes;
  const contentType = String(input.contentType ?? "").toLowerCase();
  const ext = (input.name.split(".").pop() ?? "").toLowerCase();

  const isPdf =
    bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  const isPng =
    bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47; // \x89PNG
  const isJpg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  if (isPdf || contentType.includes("pdf") || ext === "pdf") return "pdf";
  if (isJpg || contentType.includes("jpeg") || contentType.includes("jpg") || ext === "jpg" || ext === "jpeg") return "jpg";
  if (isPng || contentType.includes("png") || ext === "png") return "png";
  return "unsupported";
}

export async function appendDocumentsToPdf(
  basePdfBytes: Uint8Array,
  attachments: PdfAppendAttachmentInput[],
): Promise<PdfAppendResult> {
  const merged = await PDFDocument.load(basePdfBytes, { ignoreEncryption: true });
  const results: PdfAppendAttachmentResult[] = [];

  for (const attachment of attachments) {
    const kind = detectKind(attachment);
    try {
      if (kind === "pdf") {
        const source = await PDFDocument.load(attachment.bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
        results.push({ id: attachment.id, name: attachment.name, attached: true, pagesAdded: pages.length });
      } else if (kind === "jpg" || kind === "png") {
        const image = kind === "jpg" ? await merged.embedJpg(attachment.bytes) : await merged.embedPng(attachment.bytes);
        const page = merged.addPage([LETTER_WIDTH_PT, LETTER_HEIGHT_PT]);
        const scale = Math.min(LETTER_WIDTH_PT / image.width, LETTER_HEIGHT_PT / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        page.drawImage(image, {
          x: (LETTER_WIDTH_PT - drawWidth) / 2,
          y: (LETTER_HEIGHT_PT - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
        results.push({ id: attachment.id, name: attachment.name, attached: true, pagesAdded: 1 });
      } else {
        results.push({
          id: attachment.id,
          name: attachment.name,
          attached: false,
          pagesAdded: 0,
          reason: "Unsupported file type — only PDF, JPEG, and PNG documents can be appended.",
        });
      }
    } catch (error) {
      results.push({
        id: attachment.id,
        name: attachment.name,
        attached: false,
        pagesAdded: 0,
        reason: error instanceof Error ? error.message : "Could not append this document.",
      });
    }
  }

  const pdfBytes = await merged.save();
  return {
    pdfBytes,
    results,
    attachedCount: results.filter((result) => result.attached).length,
    skipped: results.filter((result) => !result.attached),
  };
}
