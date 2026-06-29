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

function xmlTextWithBreaks(value: string) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((part) => xmlEscape(part))
    .join("</w:t><w:br/><w:t>");
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

function signerReplacementValueForContext(token: string, value: string, fullText: string, tokenStart: number) {
  if (token !== "{{signer.signatureName}}") return value;

  const beforeToken = fullText.slice(0, tokenStart).replace(/\s+$/g, "");
  const closingImmediatelyBeforeSignature =
    beforeToken.endsWith("Very truly yours,") ||
    beforeToken.endsWith("Very truly yours:");

  if (!closingImmediatelyBeforeSignature) return value;
  if (/^\s*\r?\n/.test(value)) return value;

  return "\n" + value;
}

function replaceTokenAcrossTextNodes(xml: string, token: string, value: string) {
  let nextXml = xml;
  let count = 0;

  while (true) {
    const nodes: Array<{ start: number; end: number; open: string; close: string; raw: string; text: string }> = [];
    const regex = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(nextXml)) !== null) {
      nodes.push({
        start: match.index,
        end: match.index + match[0].length,
        open: match[1],
        raw: match[2],
        close: match[3],
        text: xmlUnescape(match[2]),
      });
    }

    const fullText = nodes.map((node) => node.text).join("");
    const tokenStart = fullText.indexOf(token);
    if (tokenStart < 0) break;

    const tokenEnd = tokenStart + token.length;
    let cursor = 0;
    let firstNodeIndex = -1;
    let lastNodeIndex = -1;
    let firstOffset = 0;
    let lastOffset = 0;

    for (let i = 0; i < nodes.length; i += 1) {
      const nodeStart = cursor;
      const nodeEnd = cursor + nodes[i].text.length;

      if (firstNodeIndex < 0 && tokenStart >= nodeStart && tokenStart <= nodeEnd) {
        firstNodeIndex = i;
        firstOffset = tokenStart - nodeStart;
      }

      if (firstNodeIndex >= 0 && tokenEnd >= nodeStart && tokenEnd <= nodeEnd) {
        lastNodeIndex = i;
        lastOffset = tokenEnd - nodeStart;
        break;
      }

      cursor = nodeEnd;
    }

    if (firstNodeIndex < 0 || lastNodeIndex < 0) break;

    const replacementValue = signerReplacementValueForContext(token, value, fullText, tokenStart);

    const changed = nodes.map((node, index) => {
      if (index < firstNodeIndex || index > lastNodeIndex) return node.text;
      if (firstNodeIndex === lastNodeIndex) {
        return node.text.slice(0, firstOffset) + replacementValue + node.text.slice(lastOffset);
      }
      if (index === firstNodeIndex) return node.text.slice(0, firstOffset) + replacementValue;
      if (index === lastNodeIndex) return node.text.slice(lastOffset);
      return "";
    });

    let rebuilt = "";
    let priorEnd = 0;

    nodes.forEach((node, index) => {
      rebuilt += nextXml.slice(priorEnd, node.start);
      rebuilt += node.open + xmlTextWithBreaks(changed[index]) + node.close;
      priorEnd = node.end;
    });

    rebuilt += nextXml.slice(priorEnd);
    nextXml = rebuilt;
    count += 1;
  }

  return { xml: nextXml, count };
}

function normalizeSignatureBreaksBeforeGeneration(xml: string) {
  const signatureToken = "{{signer.signatureName}}";
  if (!xml.includes(signatureToken) || !xml.includes("Very truly yours,")) return xml;

  const closings = [
    "Very truly yours,",
    "Very truly yours:"
  ];

  let nextXml = xml;
  for (const closing of closings) {
    const plainPattern = closing + signatureToken;
    if (nextXml.includes(plainPattern)) {
      nextXml = nextXml.replaceAll(plainPattern, closing + "\n" + signatureToken);
    }
  }

  return nextXml;
}

async function replaceTokensInDocx(buffer: Buffer, tokenValues: Record<string, string>) {
  const zip = await JSZip.loadAsync(buffer);
  const replacements = Object.entries(tokenValues).map(([token, value]) => ({ token, value, count: 0 }));

  const partNames = Object.keys(zip.files).filter(docxTextPartName);

  for (const partName of partNames) {
    const file = zip.file(partName);
    if (!file) continue;

    let xml = normalizeSignatureBreaksBeforeGeneration(await file.async("string"));

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
    const key = clean(req.nextUrl.searchParams.get("key"));

    if (!key) {
      return NextResponse.json(
        { ok: false, action: "document-template-generate-preview", error: "Missing template key." },
        { status: 400 }
      );
    }

    let template = await prisma.documentTemplate.findUnique({
      where: { key },
      include: {
        versions: {
          orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    
    let selectedVersionForGeneration: any = null;

    if (versionId) {
      selectedVersionForGeneration = await prisma.documentTemplateVersion.findUnique({
        where: { id: versionId },
      });

      if (!selectedVersionForGeneration || selectedVersionForGeneration.templateId !== template.id) {
        return NextResponse.json(
          { ok: false, error: "Requested template version was not found for this template." },
          { status: 404 },
        );
      }
    } else {
      selectedVersionForGeneration =
        Array.isArray(template.versions) && template.versions.length > 0
          ? template.versions[0]
          : template.currentVersion;
    }

    if (!selectedVersionForGeneration) {
      return NextResponse.json(
        { ok: false, error: "Template has no stored DOCX version available for generation." },
        { status: 404 },
      );
    }

    if (selectedVersionForGeneration.storageKind !== "db-docx-base64" || !selectedVersionForGeneration.contentText) {
      return NextResponse.json(
        { ok: false, error: "Selected template version does not have stored DOCX content." },
        { status: 400 },
      );
    }

    template.currentVersion = selectedVersionForGeneration;

if (!template) {
      return NextResponse.json(
        { ok: false, action: "document-template-generate-preview", error: "Template not found." },
        { status: 404 }
      );
    }

    const metadata = template.metadata && typeof template.metadata === "object" && !Array.isArray(template.metadata)
      ? template.metadata as Record<string, any>
      : {};

    const currentVersion =
      template.versions.find((version) => clean(version.id) === clean(template.currentVersionId)) ||
      template.versions[0] ||
      null;

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

    if (!currentVersion || currentVersion.storageKind !== "db-docx-base64" || !currentVersion.contentText) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-generate-preview",
          error: "Template does not have a stored DB DOCX current version.",
        },
        { status: 409 }
      );
    }

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
