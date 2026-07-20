/* eslint-disable @typescript-eslint/no-explicit-any -- Pre-existing generation-route handler uses broad any for template metadata/version shapes; the signature-image change preserves those. */
import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { embedSignatureImage } from "@/lib/documents/docxSignatureImage";
import { prisma } from "@/lib/prisma";
import { BARSH_FIRM_CONTACT } from "@/lib/firmContact";
import { resolveTemplateTokenBaseValues } from "@/lib/documents/templateTokenResolver";
import { extractTemplateTokens, parseTemplateToken, formatTokenValue } from "@/lib/documents/templateTokenFormat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function xmlUnescape(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Ensure a <w:t ...> open tag carries xml:space="preserve" whenever its text has a
// leading or trailing space. Word stores a run without preserve when its original text
// had no edge whitespace (e.g. a run beginning with a closing token brace); once the
// following space becomes leading in that run, and without preserve Word strips it,
// producing "Barshaywas" instead of "Barshay was".
function ensurePreserveOpen(open: string, text: string): string {
  if (!/^\s|\s$/.test(text)) return open;
  if (/xml:space\s*=/.test(open)) {
    return open.replace(/xml:space\s*=\s*"[^"]*"/, 'xml:space="preserve"');
  }
  return open.replace(/<w:t\b/, '<w:t xml:space="preserve"');
}

// Render replacement text into a w:t node, converting newlines into Word line breaks
// (so multi-line values like an address block stack onto separate lines).
function renderTokenText(open: string, close: string, text: string) {
  if (!text.includes("\n")) return ensurePreserveOpen(open, text) + xmlEscape(text) + close;
  const segments = text.split("\n");
  let out = "";
  segments.forEach((segment, index) => {
    const openTag = index === 0 ? ensurePreserveOpen(open, segment) : '<w:t xml:space="preserve">';
    out += openTag + xmlEscape(segment) + close;
    if (index < segments.length - 1) out += "<w:br/>";
  });
  return out;
}

function safeFilename(value: string) {
  return clean(value)
    .replace(/\.docx$/i, "")
    .replace(/[\/\\:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "generated-template";
}

type ResolvedSigner = {
  id: string;
  email: string;
  displayName: string | null;
  signatureBlockName: string | null;
  phoneExtension: string | null;
  faxNumber: string | null;
  signatureImageDataUrl: string | null;
  signerEligible: boolean;
  signerProfileStatus: "Complete" | "Missing Fields";
  signerMissingFields: string[];
};

function signerMissingFields(user: {
  displayName: string | null;
  email: string;
  signatureBlockName: string | null;
  phoneExtension: string | null;
  faxNumber: string | null;
}): string[] {
  const fields: Array<[string, string | null | undefined]> = [
    ["displayName", user.displayName],
    ["email", user.email],
    ["signatureBlockName", user.signatureBlockName],
    ["phoneExtension", user.phoneExtension],
    ["faxNumber", user.faxNumber],
  ];

  return fields
    .filter((entry) => clean(entry[1]).length === 0)
    .map((entry) => entry[0]);
}

async function resolveSigner(req: NextRequest): Promise<{ signer: ResolvedSigner | null; error?: string; status?: number }> {
  const query = req.nextUrl.searchParams;
  const signerUserId = clean(query.get("signerUserId") || query.get("signer.id"));
  const signerEmail = clean(query.get("signerEmail") || query.get("signer.email") || query.get("email")).toLowerCase();

  const isFirmSignerContactRequest = ["firm", "firm-contact", "barsh-firm", "brl-firm"].includes(
    clean(signerEmail).toLowerCase()
  );

  if (isFirmSignerContactRequest) {
    // Firm signer/contact is sourced from the single firm-contact constant.
    const signer: ResolvedSigner = {
      ...BARSH_FIRM_CONTACT,
      signerEligible: true,
      signerProfileStatus: "Complete",
      signerMissingFields: [],
      signatureImageUrl: "",
      signatureImageDataUrl: "",
      contactMode: "firm",
    } as ResolvedSigner;

    return { signer, status: 200, error: "" };
  }


  if (!signerUserId && !signerEmail) {
    return {
      signer: null,
      status: 400,
      error: "A signerUserId or signerEmail is required. Generation must resolve signer.* tokens from an eligible Admin User signer profile.",
    };
  }

  const user = await prisma.adminUser.findFirst({
    where: signerUserId ? { id: signerUserId } : { email: signerEmail },
    select: {
      id: true,
      email: true,
      displayName: true,
      signatureBlockName: true,
      phoneExtension: true,
      faxNumber: true,
      signatureImageDataUrl: true,
      signerEligible: true,
      status: true,
      locked: true,
      inactive: true,
    },
  });

  if (!user) {
    return { signer: null, status: 404, error: "Selected signer was not found." };
  }

  if (user.signerEligible === false) {
    return { signer: null, status: 409, error: "Selected Admin User is not signer-eligible." };
  }

  if (user.status !== "active" || user.locked === true || user.inactive === true) {
    return { signer: null, status: 409, error: "Selected signer must be active, unlocked, and not inactive." };
  }

  const missing = signerMissingFields(user);
  const signer: ResolvedSigner = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    signatureBlockName: user.signatureBlockName,
    phoneExtension: user.phoneExtension,
    faxNumber: user.faxNumber,
    signatureImageDataUrl: user.signatureImageDataUrl ?? null,
    signerEligible: Boolean(user.signerEligible),
    signerProfileStatus: missing.length === 0 ? "Complete" : "Missing Fields",
    signerMissingFields: missing,
  };

  if (missing.length > 0) {
    return { signer, status: 409, error: "Selected signer profile is missing required signer fields." };
  }

  return { signer };
}

function docxTextPartName(name: string) {
  return (
    name === "word/document.xml" ||
    /^word\/header\d+\.xml$/.test(name) ||
    /^word\/footer\d+\.xml$/.test(name)
  );
}

function replaceTokenInsideTextScope(xml: string, token: string, value: string) {
  let nextXml = xml;
  let count = 0;

  while (true) {
    const textNodeRegex = new RegExp("(<w:t\\b[^>]*>)([\\s\\S]*?)(</w:t>)", "g");
    const nodes: Array<{ start: number; end: number; open: string; close: string; text: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = textNodeRegex.exec(nextXml)) !== null) {
      nodes.push({
        start: match.index || 0,
        end: (match.index || 0) + match[0].length,
        open: match[1],
        close: match[3],
        text: xmlUnescape(match[2] || ""),
      });
    }

    if (!nodes.length) break;

    const fullText = nodes.map((node) => node.text).join("");
    const tokenStart = fullText.indexOf(token);
    if (tokenStart < 0) break;

    const tokenEnd = tokenStart + token.length;
    let cursor = 0;
    let firstNodeIndex = -1;
    let lastNodeIndex = -1;
    let firstOffset = 0;
    let lastOffset = 0;

    for (let index = 0; index < nodes.length; index += 1) {
      const nodeStart = cursor;
      const nodeEnd = cursor + nodes[index].text.length;

      // Bind the token start to the run that actually holds its first character.
      // Use an exclusive upper bound (< nodeEnd) so a token beginning exactly at a
      // run boundary skips the preceding run (and any zero-length runs, e.g. a run
      // that only carries a <w:tab/>). An inclusive bound absorbed the value into
      // the prior run — inheriting its formatting (bold label) and landing before
      // the tab, which collapsed tabbed label/value alignment.
      if (firstNodeIndex < 0 && tokenStart >= nodeStart && tokenStart < nodeEnd) {
        firstNodeIndex = index;
        firstOffset = tokenStart - nodeStart;
      }

      if (firstNodeIndex >= 0 && tokenEnd >= nodeStart && tokenEnd <= nodeEnd) {
        lastNodeIndex = index;
        lastOffset = tokenEnd - nodeStart;
        break;
      }

      cursor = nodeEnd;
    }

    if (firstNodeIndex < 0 || lastNodeIndex < 0) break;

    const changed = nodes.map((node, index) => {
      if (index < firstNodeIndex || index > lastNodeIndex) return node.text;
      if (firstNodeIndex === lastNodeIndex) {
        return node.text.slice(0, firstOffset) + value + node.text.slice(lastOffset);
      }
      if (index === firstNodeIndex) return node.text.slice(0, firstOffset) + value;
      if (index === lastNodeIndex) return node.text.slice(lastOffset);
      return "";
    });

    let rebuilt = "";
    let priorEnd = 0;

    nodes.forEach((node, index) => {
      rebuilt += nextXml.slice(priorEnd, node.start);
      rebuilt += renderTokenText(node.open, node.close, changed[index]);
      priorEnd = node.end;
    });

    rebuilt += nextXml.slice(priorEnd);
    nextXml = rebuilt;
    count += 1;
  }

  return { xml: nextXml, count };
}

function replaceTokenAcrossTextNodes(xml: string, token: string, value: string) {
  // Critical: operate inside each Word paragraph only. Do not build one full text
  // stream for the whole document part because paragraph boundaries and blank
  // paragraphs have no text nodes and can be collapsed by cross-paragraph replacement.
  const paragraphRegex = new RegExp("<w:p\\b[\\s\\S]*?</w:p>", "g");
  let count = 0;
  let changed = false;

  const xmlWithParagraphReplacements = xml.replace(paragraphRegex, (paragraphXml) => {
    const result = replaceTokenInsideTextScope(paragraphXml, token, value);
    if (result.count > 0) {
      changed = true;
      count += result.count;
      return result.xml;
    }
    return paragraphXml;
  });

  if (changed) return { xml: xmlWithParagraphReplacements, count };

  // Fallback for rare non-paragraph text scopes. This runs only when no paragraph
  // replacement occurred in the part.
  return replaceTokenInsideTextScope(xml, token, value);
}

// Concatenated visible text of a table-row XML block (across split <w:t> runs), for marker detection.
function rowTextContent(rowXml: string): string {
  let text = "";
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowXml)) !== null) text += xmlUnescape(m[1] || "");
  return text;
}

// REPEATING TABLE ROWS. A template table row that contains the loop markers {{#name}} … {{/name}} is the
// "template row" for that named row-set (e.g. `matters`). We clone that <w:tr> once per item, fill its
// {{row.*}} tokens from the item, and strip the markers — so the table auto-expands like the LawSpades stip.
// Convention: put {{#matters}} in the first cell and {{/matters}} in the last cell of the SAME repeating row.
function expandLoopRows(xml: string, loops: Record<string, Array<Record<string, string>>>): string {
  let out = xml;
  for (const [name, items] of Object.entries(loops || {})) {
    const startMarker = `{{#${name}}}`;
    const endMarker = `{{/${name}}}`;
    const trRegex = /<w:tr\b[\s\S]*?<\/w:tr>/g;
    let match: RegExpExecArray | null;
    let templateRow: string | null = null;
    while ((match = trRegex.exec(out)) !== null) {
      if (rowTextContent(match[0]).includes(startMarker)) { templateRow = match[0]; break; }
    }
    if (!templateRow) continue;
    let replacement = "";
    for (const item of items || []) {
      let clone = templateRow;
      for (const [k, v] of Object.entries(item)) {
        clone = replaceTokenAcrossTextNodes(clone, `{{${k}}}`, v).xml;
      }
      clone = replaceTokenAcrossTextNodes(clone, startMarker, "").xml;
      clone = replaceTokenAcrossTextNodes(clone, endMarker, "").xml;
      replacement += clone;
    }
    out = out.replace(templateRow, replacement);
  }
  return out;
}

const SIGNATURE_IMAGE_SENTINEL = "%%BM_SIGNATURE_IMAGE%%";

// Replace a sentinel (already collapsed into a single <w:t> text node) with an inline <w:drawing>.
// A drawing is run-level, so we split the enclosing <w:t> into pre-text / drawing / post-text — a run
// may legally hold that sequence — keeping any surrounding text on the signature line intact.
function insertDrawingAtSentinel(xml: string, drawing: string): string {
  let out = xml;
  while (true) {
    const sIdx = out.indexOf(SIGNATURE_IMAGE_SENTINEL);
    if (sIdx < 0) break;
    const openTagEnd = out.lastIndexOf(">", sIdx);
    const openTagStart = out.lastIndexOf("<w:t", openTagEnd);
    const closeIdx = out.indexOf("</w:t>", sIdx);
    if (openTagStart < 0 || openTagEnd < 0 || closeIdx < 0) {
      // Not inside a text node as expected; drop the sentinel rather than leave it visible.
      out = out.split(SIGNATURE_IMAGE_SENTINEL).join("");
      break;
    }
    const inner = out.slice(openTagEnd + 1, closeIdx);
    const parts = inner.split(SIGNATURE_IMAGE_SENTINEL);
    const pre = parts[0] || "";
    const post = parts.slice(1).join("");
    const rebuilt =
      (pre ? '<w:t xml:space="preserve">' + pre + "</w:t>" : "") +
      drawing +
      (post ? '<w:t xml:space="preserve">' + post + "</w:t>" : "");
    out = out.slice(0, openTagStart) + rebuilt + out.slice(closeIdx + "</w:t>".length);
  }
  return out;
}

async function replaceTokensInDocx(
  buffer: Buffer,
  tokenValues: Record<string, string>,
  loops: Record<string, Array<Record<string, string>>> = {},
  imageTokens: Record<string, string> = {},
) {
  const zip = await JSZip.loadAsync(buffer);
  const replacements = Object.entries(tokenValues).map(([token, value]) => ({ token, value, count: 0 }));
  const imageEntries = Object.entries(imageTokens);

  const partNames = Object.keys(zip.files).filter(docxTextPartName);

  // Embed the signature image into the zip once (media + rels + content types) the first time an
  // image token with usable bytes is actually placed; cache the resulting <w:drawing> XML.
  const drawingCache: Record<string, string | null> = {};
  async function drawingFor(dataUrl: string): Promise<string | null> {
    if (!(dataUrl in drawingCache)) {
      const embedded = dataUrl ? await embedSignatureImage(zip, dataUrl) : null;
      drawingCache[dataUrl] = embedded ? embedded.drawingXml : null;
    }
    return drawingCache[dataUrl];
  }

  for (const partName of partNames) {
    const file = zip.file(partName);
    if (!file) continue;

    let xml = await file.async("string");
    const isBody = partName === "word/document.xml";

    // Expand repeating table rows FIRST (so per-row {{row.*}} tokens are filled), then scalar tokens.
    xml = expandLoopRows(xml, loops);

    for (const replacement of replacements) {
      const result = replaceTokenAcrossTextNodes(xml, replacement.token, replacement.value);
      xml = result.xml;
      replacement.count += result.count;
    }

    // Image tokens. Only the document body embeds an image; headers/footers just clear the token
    // (image relationships there live in separate rels parts we intentionally do not touch).
    for (const [imgToken, dataUrl] of imageEntries) {
      if (!isBody || !String(dataUrl || "").trim()) {
        xml = replaceTokenAcrossTextNodes(xml, imgToken, "").xml;
        continue;
      }
      const collapsed = replaceTokenAcrossTextNodes(xml, imgToken, SIGNATURE_IMAGE_SENTINEL);
      xml = collapsed.xml;
      if (collapsed.count === 0) continue;
      const drawing = await drawingFor(String(dataUrl));
      if (!drawing) {
        xml = xml.split(SIGNATURE_IMAGE_SENTINEL).join("");
        continue;
      }
      xml = insertDrawingAtSentinel(xml, drawing);
    }

    zip.file(partName, xml);
  }

  const generated = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer: Buffer.from(generated), replacements };
}

async function scanDocxTokens(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const partNames = Object.keys(zip.files).filter(docxTextPartName);
  const tokens = new Set<string>();

  for (const partName of partNames) {
    const file = zip.file(partName);
    if (!file) continue;

    const xml = await file.async("string");
    const textNodeRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let match: RegExpExecArray | null;
    let combined = "";

    while ((match = textNodeRegex.exec(xml)) !== null) {
      combined += xmlUnescape(match[1] || "");
    }

    for (const token of extractTemplateTokens(combined)) tokens.add(token);
  }

  return Array.from(tokens);
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const key = clean(searchParams.get("key"));
    const versionId = clean(searchParams.get("versionId"));

    if (!key) {
      return NextResponse.json(
        { ok: false, action: "document-template-generate-preview", error: "Missing template key." },
        { status: 400 }
      );
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { key },
      include: {
        versions: {
          where: { storageKind: "db-docx-base64" },
          orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, action: "document-template-generate-preview", error: "Template not found." },
        { status: 404 }
      );
    }

    let selectedVersionForGeneration: any = null;

    if (versionId) {
      selectedVersionForGeneration = await prisma.documentTemplateVersion.findUnique({
        where: { id: versionId },
      });

      if (!selectedVersionForGeneration || selectedVersionForGeneration.templateId !== template.id) {
        return NextResponse.json(
          {
            ok: false,
            action: "document-template-generate-preview",
            error: "Requested template version was not found for this template.",
          },
          { status: 404 }
        );
      }
    } else {
      selectedVersionForGeneration =
        Array.isArray(template.versions) && template.versions.length > 0
          ? template.versions[0]
          : null;
    }

    if (!selectedVersionForGeneration) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-generate-preview",
          error: "Template has no stored DB DOCX version available for generation.",
        },
        { status: 409 }
      );
    }

    if (selectedVersionForGeneration.storageKind !== "db-docx-base64" || !selectedVersionForGeneration.contentText) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-generate-preview",
          error: "Selected template version does not have stored DB DOCX content.",
        },
        { status: 409 }
      );
    }

    const metadata = template.metadata && typeof template.metadata === "object" && !Array.isArray(template.metadata)
      ? template.metadata as Record<string, any>
      : {};

    if (!template.enabled || metadata.deleted === true || metadata.archived === true || metadata.productionTemplateReady !== true) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-generate-preview",
          error: "Template is not production-ready.",
          template: {
            key: template.key,
            enabled: template.enabled,
            productionTemplateReady: metadata.productionTemplateReady === true,
            archived: metadata.archived === true,
            deleted: metadata.deleted === true,
          },
        },
        { status: 409 }
      );
    }

    const currentVersion = selectedVersionForGeneration;

    const resolvedSigner = await resolveSigner(req);
    if (resolvedSigner.error || !resolvedSigner.signer) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-generate-preview",
          error: resolvedSigner.error || "Signer resolution failed.",
          signer: resolvedSigner.signer,
          safety: {
            localFirst: true,
            templateRepositoryWrites: false,
            clioWrites: false,
            documentsGeneratedToDatabase: false,
            graphWrites: false,
            printQueued: false,
            emailsSent: false,
            draftsCreated: false,
            signerResolvedFromAdminUser: true,
            wetSignatureRequired: false,
            wetSignatureStored: false,
          },
        },
        { status: resolvedSigner.status || 409 }
      );
    }

    const sourceBuffer = Buffer.from(currentVersion.contentText, "base64");

    const baseResolution = await resolveTemplateTokenBaseValues({
      directMatterDisplayNumber: clean(searchParams.get("directMatterDisplayNumber")),
      masterLawsuitId: clean(searchParams.get("masterLawsuitId")),
      signer: {
        email: resolvedSigner.signer.email,
        faxNumber: resolvedSigner.signer.faxNumber,
        phoneExtension: resolvedSigner.signer.phoneExtension,
        displayName: resolvedSigner.signer.displayName,
        signatureBlockName: resolvedSigner.signer.signatureBlockName,
      },
    });

    const docTokens = await scanDocxTokens(sourceBuffer);
    const tokenValues: Record<string, string> = {};
    const filledTokens: string[] = [];
    const emptyTokens: string[] = [];
    const unrecognizedTokens: string[] = [];

    for (const token of docTokens) {
      const { base, modifiers } = parseTemplateToken(token);
      if (base === "signer.signatureImage") {
        // Handled as an embedded image (not scalar text) after this loop.
        if (clean(resolvedSigner.signer.signatureImageDataUrl)) filledTokens.push(token);
        else emptyTokens.push(token);
        continue;
      }
      const entry = baseResolution.values[base];
      if (!entry) {
        // Not a known canonical/custom field we can resolve. Leave the token visible
        // so the author notices it (no silent blanking).
        unrecognizedTokens.push(token);
        continue;
      }
      const formatted = formatTokenValue(entry, modifiers);
      tokenValues[token] = formatted;
      if (clean(formatted)) filledTokens.push(token);
      else emptyTokens.push(token);
    }

    const tokenReport = {
      hasClaim: baseResolution.context.hasClaim,
      hasLawsuit: baseResolution.context.hasLawsuit,
      masterLawsuitId: baseResolution.context.masterLawsuitId,
      directMatterDisplayNumber: baseResolution.context.displayNumber,
      filledTokens,
      emptyTokens,
      unrecognizedTokens,
    };

    const imageTokens: Record<string, string> = {
      "{{signer.signatureImage}}": clean(resolvedSigner.signer.signatureImageDataUrl)
        ? String(resolvedSigner.signer.signatureImageDataUrl)
        : "",
    };
    const generated = await replaceTokensInDocx(sourceBuffer, tokenValues, baseResolution.rows, imageTokens);
    const filename = `${safeFilename(template.label || template.key)} - Generated Preview.docx`;

    return new NextResponse(generated.buffer, {
      status: 200,
      headers: {
        "Content-Type": DOCX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "'")}"`,
        "X-Barsh-Matters-Action": "document-template-generate-preview",
        "X-Barsh-Matters-Template-Key": template.key,
        "X-Barsh-Matters-Template-Version": String(currentVersion.versionNumber),
        "X-Barsh-Matters-Selected-Version-Id": String(currentVersion.id || ""),
        "X-Barsh-Matters-Requested-Version-Id": versionId || "",
        "X-Barsh-Matters-Latest-Version-Default": versionId ? "false" : "true",
        "X-Barsh-Matters-Signer": encodeURIComponent(JSON.stringify({
          id: resolvedSigner.signer.id,
          email: resolvedSigner.signer.email,
          signatureBlockName: resolvedSigner.signer.signatureBlockName,
          phoneExtension: resolvedSigner.signer.phoneExtension,
          faxNumber: resolvedSigner.signer.faxNumber,
          signerEligible: resolvedSigner.signer.signerEligible,
          signerProfileStatus: resolvedSigner.signer.signerProfileStatus,
          wetSignatureRequired: false,
          wetSignatureStored: false,
        })),
        "X-Barsh-Matters-Replacements": encodeURIComponent(JSON.stringify(generated.replacements)),
        "X-Barsh-Matters-Token-Report": encodeURIComponent(JSON.stringify(tokenReport)),
        "X-Barsh-Matters-Safety": encodeURIComponent(JSON.stringify({
          localFirst: true,
          templateRepositoryWrites: false,
          clioWrites: false,
          documentsGeneratedToDatabase: false,
          graphWrites: false,
          printQueued: false,
          emailsSent: false,
          draftsCreated: false,
          signerResolvedFromAdminUser: true,
          wetSignatureRequired: false,
          wetSignatureStored: false,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-template-generate-preview",
        error: error?.message || "Template generation preview failed.",
      },
      { status: 500 }
    );
  }
}

