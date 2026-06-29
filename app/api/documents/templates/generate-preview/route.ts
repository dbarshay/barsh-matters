import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";

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
    signerEligible: Boolean(user.signerEligible),
    signerProfileStatus: missing.length === 0 ? "Complete" : "Missing Fields",
    signerMissingFields: missing,
  };

  if (missing.length > 0) {
    return { signer, status: 409, error: "Selected signer profile is missing required signer fields." };
  }

  return { signer };
}

function buildTokenValuesFromSigner(signer: ResolvedSigner) {
  return {
    "{{signer.signatureName}}": clean(signer.signatureBlockName),
    "{{signer.email}}": clean(signer.email),
    "{{signer.extension}}": clean(signer.phoneExtension),
    "{{signer.fax}}": clean(signer.faxNumber),
  };
}

function docxTextPartName(name: string) {
  return (
    name === "word/document.xml" ||
    /^word\/header\d+\.xml$/.test(name) ||
    /^word\/footer\d+\.xml$/.test(name)
  );
}

function replaceTokenInsideTextScope(xml: string, token: string, value: string) {
  const textNodeRegex = /<w:t([^>]*)>([\\s\\S]*?)<\\/w:t>/g;
  const nodes: Array<{ start: number; end: number; attrs: string; textStart: number; textEnd: number; text: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = textNodeRegex.exec(xml)) !== null) {
    const full = match[0];
    const attrs = match[1] || "";
    const encodedText = match[2] || "";
    const textStart = (match.index || 0) + full.indexOf(encodedText);
    const textEnd = textStart + encodedText.length;
    nodes.push({
      start: match.index || 0,
      end: (match.index || 0) + full.length,
      attrs,
      textStart,
      textEnd,
      text: xmlUnescape(encodedText),
    });
  }

  if (!nodes.length) return { xml, count: 0 };

  let nextXml = xml;
  let count = 0;

  while (true) {
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
      const node = nodes[index];
      const nodeStart = cursor;
      const nodeEnd = cursor + node.text.length;

      if (firstNodeIndex < 0 && tokenStart >= nodeStart && tokenStart <= nodeEnd) {
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
      rebuilt += `<w:t${node.attrs}>${xmlEscape(changed[index])}</w:t>`;
      priorEnd = node.end;
    });

    rebuilt += nextXml.slice(priorEnd);
    nextXml = rebuilt;
    count += 1;

    // Re-run on the rebuilt scope because XML offsets changed.
    const again = replaceTokenInsideTextScope(nextXml, token, value);
    return { xml: again.xml, count: count + again.count };
  }

  return { xml: nextXml, count };
}

function replaceTokenAcrossTextNodes(xml: string, token: string, value: string) {
  // Critical: operate inside each Word paragraph/run scope only.
  // Do not build one full text stream for the whole document part, because blank paragraphs
  // and paragraph boundaries have no text nodes and can be collapsed by cross-paragraph replacement.
  const paragraphRegex = /<w:p[\\s\\S]*?<\\/w:p>/g;
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

  // Fallback for tokens in headers, footers, textboxes, or uncommon DOCX structures without paragraph wrappers.
  // This fallback only runs when no paragraph replacement occurred.
  const fallback = replaceTokenInsideTextScope(xml, token, value);
  return fallback;
}

async function replaceTokensInDocx(buffer: Buffer, tokenValues: Record<string, string>) {
  const zip = await JSZip.loadAsync(buffer);
  const replacements = Object.entries(tokenValues).map(([token, value]) => ({ token, value, count: 0 }));

  const partNames = Object.keys(zip.files).filter(docxTextPartName);

  for (const partName of partNames) {
    const file = zip.file(partName);
    if (!file) continue;

    let xml = await file.async("string");

    for (const replacement of replacements) {
      const result = replaceTokenAcrossTextNodes(xml, replacement.token, replacement.value);
      xml = result.xml;
      replacement.count += result.count;
    }

    zip.file(partName, xml);
  }

  const generated = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer: Buffer.from(generated), replacements };
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
    const tokenValues = buildTokenValuesFromSigner(resolvedSigner.signer);
    const generated = await replaceTokensInDocx(sourceBuffer, tokenValues);
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

