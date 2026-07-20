// Embed a signer's wet-signature image into a generated .docx.
//
// The template fill pipeline (generate-preview) already unzips the docx with JSZip, replaces
// {{tokens}} as text, and re-zips. A signature is an IMAGE, not text: a <w:drawing> is a run-level
// element, so we (1) drop the decoded image bytes into word/media, (2) register a relationship in
// word/_rels/document.xml.rels, (3) ensure [Content_Types].xml declares the image extension, and
// (4) hand back an inline <w:drawing> XML snippet (with all namespaces declared inline so it is valid
// regardless of what the template's root element declares). The caller swaps the token run for it.
import type JSZip from "jszip";

const EMU_PER_INCH = 914400;
const DEFAULT_MAX_WIDTH_INCHES = 1.9;
const DEFAULT_MAX_HEIGHT_INCHES = 1.0;
const RELATIONSHIPS_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const IMAGE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

export type ParsedSignatureImage = { mime: string; ext: "png" | "jpeg"; buffer: Buffer };

const ALLOWED: Record<string, "png" | "jpeg"> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
};

// Max decoded bytes accepted for a signature image (keeps the DB row + docx small).
export const MAX_SIGNATURE_IMAGE_BYTES = 1_500_000;

export function parseSignatureDataUrl(dataUrl: unknown): ParsedSignatureImage | null {
  const value = String(dataUrl ?? "").trim();
  const match = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = ALLOWED[mime];
  if (!ext) return null;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0) return null;
  return { mime: ext === "jpeg" ? "image/jpeg" : "image/png", ext, buffer };
}

// Intrinsic pixel dimensions, so the placed image keeps its aspect ratio. Falls back to a 3:1
// signature-ish ratio if the header can't be parsed.
function readImageDimensions(image: ParsedSignatureImage): { width: number; height: number } {
  const b = image.buffer;
  try {
    if (image.ext === "png" && b.length >= 24 && b[0] === 0x89 && b[1] === 0x50) {
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    }
    if (image.ext === "jpeg") {
      let offset = 2;
      while (offset + 9 < b.length) {
        if (b[offset] !== 0xff) { offset += 1; continue; }
        const marker = b[offset + 1];
        // SOF0..SOF15 carry frame dimensions; skip DHT/DAC/RST/etc.
        const isSof =
          marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        const segLen = b.readUInt16BE(offset + 2);
        if (isSof) {
          return { height: b.readUInt16BE(offset + 5), width: b.readUInt16BE(offset + 7) };
        }
        offset += 2 + segLen;
      }
    }
  } catch {
    /* fall through to default ratio */
  }
  return { width: 600, height: 200 };
}

function extentEmu(px: { width: number; height: number }): { cx: number; cy: number } {
  const ratio = px.width > 0 ? px.height / px.width : 1 / 3;
  let cx = Math.round(DEFAULT_MAX_WIDTH_INCHES * EMU_PER_INCH);
  let cy = Math.round(cx * ratio);
  const maxCy = Math.round(DEFAULT_MAX_HEIGHT_INCHES * EMU_PER_INCH);
  if (cy > maxCy) {
    const scale = maxCy / cy;
    cy = maxCy;
    cx = Math.round(cx * scale);
  }
  return { cx, cy };
}

function ensureContentTypeDefault(zip: JSZip, xml: string, ext: "png" | "jpeg"): string {
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  if (new RegExp(`<Default[^>]*Extension="${ext}"`, "i").test(xml)) return xml;
  return xml.replace("</Types>", `<Default Extension="${ext}" ContentType="${contentType}"/></Types>`);
}

function addImageRelationship(xml: string, relId: string, target: string): string {
  if (xml.includes(`Id="${relId}"`)) return xml;
  const rel = `<Relationship Id="${relId}" Type="${IMAGE_REL_TYPE}" Target="${target}"/>`;
  if (xml.includes("</Relationships>")) return xml.replace("</Relationships>", `${rel}</Relationships>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${RELATIONSHIPS_NS}">${rel}</Relationships>`;
}

export function buildSignatureDrawingXml(params: {
  relId: string;
  cx: number;
  cy: number;
  docPrId: number;
  name: string;
}): string {
  const { relId, cx, cy, docPrId, name } = params;
  return (
    "<w:drawing>" +
    '<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    `<wp:docPr id="${docPrId}" name="${name}"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/>' +
    `<a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>"
  );
}

// Registers the image in the zip (media + rels + content types) and returns the inline drawing XML.
// Returns null if the data URL is not a usable image. Idempotent for a given relId/media name.
export async function embedSignatureImage(
  zip: JSZip,
  dataUrl: unknown,
): Promise<{ drawingXml: string } | null> {
  const image = parseSignatureDataUrl(dataUrl);
  if (!image) return null;
  if (image.buffer.length > MAX_SIGNATURE_IMAGE_BYTES) return null;

  const relId = "rIdBmSignature";
  const mediaName = `bm-signature.${image.ext}`;
  const mediaPath = `word/media/${mediaName}`;

  zip.file(mediaPath, image.buffer);

  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  const relsXml = relsFile ? await relsFile.async("string") : "";
  zip.file(relsPath, addImageRelationship(relsXml, relId, `media/${mediaName}`));

  const ctPath = "[Content_Types].xml";
  const ctFile = zip.file(ctPath);
  if (ctFile) {
    const ctXml = await ctFile.async("string");
    zip.file(ctPath, ensureContentTypeDefault(zip, ctXml, image.ext));
  }

  const { cx, cy } = extentEmu(readImageDimensions(image));
  const drawingXml = buildSignatureDrawingXml({
    relId,
    cx,
    cy,
    docPrId: 2001,
    name: "Signer Signature",
  });
  return { drawingXml };
}
