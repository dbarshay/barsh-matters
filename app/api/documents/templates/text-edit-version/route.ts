import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function xmlUnescape(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripXml(value: string): string {
  return value
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function docxTextPartName(name: string) {
  return (
    name === "word/document.xml" ||
    /^word\/header\d+\.xml$/.test(name) ||
    /^word\/footer\d+\.xml$/.test(name)
  );
}

function extractReadableTextFromXml(xml: string): string {
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g, (match) => stripXml(match))
    .replace(/<[^>]+>/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function renderTextWithBreaks(open: string, close: string, text: string) {
  const pieces = text.split(/\r?\n/);
  return pieces.map((piece) => `${open}${xmlEscape(piece)}${close}`).join("<w:br/>");
}

function replaceTextAcrossTextNodes(xml: string, findText: string, replacementText: string) {
  let nextXml = xml;
  let count = 0;

  while (findText) {
    const nodes: Array<{ start: number; end: number; open: string; close: string; raw: string; text: string }> = [];
    const regex = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(nextXml))) {
      nodes.push({
        start: match.index,
        end: match.index + match[0].length,
        open: match[1],
        close: match[3],
        raw: match[0],
        text: xmlUnescape(match[2]),
      });
    }

    const fullText = nodes.map((node) => node.text).join("");
    const tokenStart = fullText.indexOf(findText);
    if (tokenStart < 0) break;

    const tokenEnd = tokenStart + findText.length;
    let cursor = 0;
    let firstNodeIndex = -1;
    let lastNodeIndex = -1;
    let firstOffset = 0;
    let lastOffset = 0;

    for (let i = 0; i < nodes.length; i++) {
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

    const changed = nodes.map((node, index) => {
      if (index < firstNodeIndex || index > lastNodeIndex) return node.text;
      if (firstNodeIndex === lastNodeIndex) {
        return node.text.slice(0, firstOffset) + replacementText + node.text.slice(lastOffset);
      }
      if (index === firstNodeIndex) return node.text.slice(0, firstOffset) + replacementText;
      if (index === lastNodeIndex) return node.text.slice(lastOffset);
      return "";
    });

    let rebuilt = nextXml.slice(0, nodes[0].start);
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      rebuilt += nextXml.slice(i === 0 ? node.start : nodes[i - 1].end, node.start);
      rebuilt += renderTextWithBreaks(node.open, node.close, changed[i]);
    }
    rebuilt += nextXml.slice(nodes[nodes.length - 1].end);
    nextXml = rebuilt;
    count += 1;
  }

  return { xml: nextXml, count };
}

async function currentDbDocxTemplate(key: string) {
  const template = await prisma.documentTemplate.findUnique({
    where: { key },
    include: {
      versions: {
        orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!template) return { error: "Template not found.", status: 404 as const };
  const currentVersion =
    template.versions.find((version) => clean(version.id) === clean(template.currentVersionId)) ||
    template.versions[0] ||
    null;

  if (!currentVersion || currentVersion.storageKind !== "db-docx-base64" || !currentVersion.contentText) {
    return { error: "Template does not have a stored DB DOCX current version.", status: 409 as const };
  }

  return { template, currentVersion };
}

function safety(databaseRecordsChanged = false) {
  return {
    action: "document-template-text-edit-version",
    localTemplateRepositoryWrite: databaseRecordsChanged,
    createsNewVersionOnly: databaseRecordsChanged,
    preservesPriorVersions: true,
    updatesCurrentVersionId: databaseRecordsChanged,
    clioWrites: false,
    graphWrites: false,
    draftsCreated: false,
    emailsSent: false,
    printQueued: false,
    documentsGenerated: false,
  };
}

export async function GET(req: NextRequest) {
  try {
    const key = clean(req.nextUrl.searchParams.get("key"));
    if (!key) {
      return NextResponse.json({ ok: false, action: "document-template-text-edit-version", error: "Missing template key.", safety: safety(false) }, { status: 400 });
    }

    const loaded = await currentDbDocxTemplate(key);
    if ("error" in loaded) {
      return NextResponse.json({ ok: false, action: "document-template-text-edit-version", error: loaded.error, safety: safety(false) }, { status: loaded.status });
    }

    const buffer = Buffer.from(loaded.currentVersion.contentText || "", "base64");
    const zip = await JSZip.loadAsync(buffer);
    const parts = Object.keys(zip.files).filter(docxTextPartName);
    const textParts = [];
    for (const partName of parts) {
      const file = zip.file(partName);
      if (!file) continue;
      const xml = await file.async("string");
      textParts.push({ partName, text: extractReadableTextFromXml(xml) });
    }

    return NextResponse.json({
      ok: true,
      action: "document-template-text-edit-version",
      templateKey: loaded.template.key,
      templateLabel: loaded.template.label,
      currentVersionId: loaded.currentVersion.id,
      currentVersionNumber: loaded.currentVersion.versionNumber,
      contentType: DOCX_CONTENT_TYPE,
      textParts,
      combinedText: textParts.map((part) => `--- ${part.partName} ---\n${part.text}`).join("\n\n"),
      safety: safety(false),
      note: "Read-only DOCX text extraction. No database records changed.",
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, action: "document-template-text-edit-version", error: error?.message || "Could not extract template text.", safety: safety(false) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const key = clean(body?.key);
    const findText = String(body?.findText ?? "");
    const replacementText = String(body?.replacementText ?? "");
    const apply = body?.apply === true;

    if (!key) return NextResponse.json({ ok: false, action: "document-template-text-edit-version", error: "Missing template key.", safety: safety(false) }, { status: 400 });
    if (!findText) return NextResponse.json({ ok: false, action: "document-template-text-edit-version", error: "Find text is required.", safety: safety(false) }, { status: 400 });

    const loaded = await currentDbDocxTemplate(key);
    if ("error" in loaded) {
      return NextResponse.json({ ok: false, action: "document-template-text-edit-version", error: loaded.error, safety: safety(false) }, { status: loaded.status });
    }

    const buffer = Buffer.from(loaded.currentVersion.contentText || "", "base64");
    const zip = await JSZip.loadAsync(buffer);
    const parts = Object.keys(zip.files).filter(docxTextPartName);
    const replacements: Array<{ partName: string; count: number }> = [];

    for (const partName of parts) {
      const file = zip.file(partName);
      if (!file) continue;
      const xml = await file.async("string");
      const result = replaceTextAcrossTextNodes(xml, findText, replacementText);
      replacements.push({ partName, count: result.count });
      if (result.count > 0) zip.file(partName, result.xml);
    }

    const replacementCount = replacements.reduce((sum, entry) => sum + entry.count, 0);
    if (replacementCount === 0) {
      return NextResponse.json({
        ok: false,
        action: "document-template-text-edit-version",
        error: "Find text was not found in editable DOCX text nodes.",
        templateKey: loaded.template.key,
        currentVersionId: loaded.currentVersion.id,
        currentVersionNumber: loaded.currentVersion.versionNumber,
        replacements,
        safety: safety(false),
      }, { status: 409 });
    }

    const latestVersion = loaded.template.versions[0] || loaded.currentVersion;
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    const preview = {
      templateKey: loaded.template.key,
      currentVersionId: loaded.template.currentVersionId || loaded.currentVersion.id,
      currentVersionNumber: loaded.currentVersion.versionNumber,
      nextVersionNumber,
      replacementCount,
      replacements,
      findText,
      replacementText,
    };

    if (!apply) {
      return NextResponse.json({
        ok: true,
        action: "document-template-text-edit-version",
        mode: "preview",
        preview,
        safety: safety(false),
        note: "Preview only. No database records changed. Confirm to create a new DocumentTemplateVersion from this text edit.",
      });
    }

    const generated = await zip.generateAsync({ type: "nodebuffer" });
    let createdVersion: any = null;

    await prisma.$transaction(async (tx) => {
      const version = await tx.documentTemplateVersion.create({
        data: {
          templateId: loaded.template.id,
          versionNumber: nextVersionNumber,
          status: loaded.currentVersion.status || "production-ready",
          bodyFormat: "docx-template",
          storageKind: "db-docx-base64",
          contentText: Buffer.from(generated).toString("base64"),
          contentJson: {
            ...safeObject(loaded.currentVersion.contentJson),
            textEditSource: "template-detail-ui-text-editor",
            textEditAppliedAt: new Date().toISOString(),
            priorCurrentVersionId: loaded.template.currentVersionId || null,
            priorLatestVersionNumber: latestVersion?.versionNumber || null,
            findText,
            replacementText,
            replacementCount,
            replacements,
          },
          mergeFieldSet: loaded.currentVersion.mergeFieldSet || clean((safeObject(loaded.template.metadata) as any).mergeFieldSet) || null,
        },
      });

      await tx.documentTemplate.update({
        where: { id: loaded.template.id },
        data: {
          currentVersionId: version.id,
          metadata: {
            ...safeObject(loaded.template.metadata),
            lastTextEdit: {
              versionId: version.id,
              versionNumber: version.versionNumber,
              replacementCount,
              editedAt: new Date().toISOString(),
            },
          },
        },
      });

      createdVersion = version;
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json({
      ok: true,
      action: "document-template-text-edit-version",
      mode: "apply",
      templateKey: loaded.template.key,
      priorCurrentVersionId: loaded.template.currentVersionId || null,
      newCurrentVersionId: createdVersion?.id || null,
      version: {
        id: createdVersion?.id || null,
        versionNumber: createdVersion?.versionNumber || nextVersionNumber,
        storageKind: createdVersion?.storageKind || "db-docx-base64",
        hasStoredDocx: Boolean(createdVersion?.contentText),
      },
      preview,
      safety: safety(true),
      note: "Confirmed text edit created a new DocumentTemplateVersion, preserved prior versions, and updated currentVersionId. It did not generate documents, upload to Clio, send email, create drafts, print, or queue documents.",
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, action: "document-template-text-edit-version", error: error?.message || "Template text edit failed.", safety: safety(false) }, { status: 500 });
  }
}
