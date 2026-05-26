import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function clean(value: unknown): string {
  return String(value || "").trim();
}

function bool(value: unknown): boolean {
  return value === true || value === "true";
}

function safeJsonObject(value: any): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function fileNameBase(value: unknown): string {
  const raw = clean(value).replace(/\.docx$/i, "");
  return raw || "Replacement Template";
}

function replacementSafety(databaseRecordsChanged = false) {
  return {
    action: "document-template-replace-version",
    databaseRecordsChanged,
    templateRepositoryWrites: databaseRecordsChanged,
    createsNewVersionOnly: databaseRecordsChanged,
    preservesPriorVersions: true,
    updatesCurrentVersionId: databaseRecordsChanged,
    clioWrites: false,
    graphWrites: false,
    draftsCreated: false,
    emailsSent: false,
    documentsGenerated: false,
    printQueued: false,
  };
}

async function readBody(req: NextRequest) {
  const contentType = clean(req.headers.get("content-type")).toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const templateKey = clean(form.get("templateKey"));
    const confirm = bool(form.get("confirm"));
    const replacementLabel = clean(form.get("replacementLabel"));
    const note = clean(form.get("note"));
    const file = form.get("file");

    if (!(file instanceof File)) {
      return {
        ok: false,
        error: "Replacement DOCX file is required.",
      };
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const contentBase64 = bytes.toString("base64");

    return {
      ok: true,
      templateKey,
      confirm,
      replacementLabel,
      note,
      file: {
        name: clean(file.name),
        size: file.size,
        type: clean(file.type) || DOCX_CONTENT_TYPE,
        lastModified: file.lastModified,
        lastModifiedIso: file.lastModified ? new Date(file.lastModified).toISOString() : null,
        contentBase64,
        contentBase64Length: contentBase64.length,
        contentByteLength: bytes.byteLength,
      },
    };
  }

  const body = await req.json().catch(() => ({}));
  return {
    ok: true,
    templateKey: clean(body?.templateKey),
    confirm: bool(body?.confirm),
    replacementLabel: clean(body?.replacementLabel),
    note: clean(body?.note),
    file: {
      name: clean(body?.file?.name || body?.fileName),
      size: Number(body?.file?.size || body?.fileSize || 0) || 0,
      type: clean(body?.file?.type) || DOCX_CONTENT_TYPE,
      lastModified: body?.file?.lastModified || null,
      lastModifiedIso: clean(body?.file?.lastModifiedIso) || null,
      contentBase64: clean(body?.file?.contentBase64),
      contentBase64Length: clean(body?.file?.contentBase64).length,
      contentByteLength: Number(body?.file?.contentByteLength || 0) || 0,
    },
  };
}

function validateReplacement(input: any) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input?.templateKey) errors.push("Missing template key.");
  if (!input?.file?.name) errors.push("Missing replacement DOCX filename.");
  if (!input?.file?.name?.toLowerCase?.().endsWith(".docx")) {
    errors.push("Replacement file must be a .docx Word template.");
  }
  if (!input?.file?.contentBase64) {
    errors.push("Replacement DOCX content is missing.");
  }
  if (input?.file?.contentByteLength > 15 * 1024 * 1024) {
    warnings.push("Replacement DOCX is larger than 15 MB; production upload limits may require a future direct-upload path.");
  }

  return { errors, warnings };
}

export async function POST(req: NextRequest) {
  try {
    const input = await readBody(req);

    if (!input.ok) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-replace-version",
          error: input.error || "Replacement request could not be parsed.",
          safety: replacementSafety(false),
        },
        { status: 400 }
      );
    }

    const validation = validateReplacement(input);

    const template = input.templateKey
      ? await prisma.documentTemplate.findUnique({
          where: { key: input.templateKey },
          include: {
            versions: {
              orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
              take: 1,
            },
            mergeFields: {
              orderBy: [{ source: "asc" }, { key: "asc" }],
            },
          },
        })
      : null;

    if (!template) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-replace-version",
          error: "Template was not found in the local Barsh Matters template repository.",
          templateKey: input.templateKey,
          validation,
          safety: replacementSafety(false),
        },
        { status: 404 }
      );
    }

    const latestVersion = template.versions?.[0] || null;
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    const replacementFile: any = input.file;

    const preview = {
      templateId: template.id,
      templateKey: template.key,
      templateLabel: template.label,
      currentVersionId: template.currentVersionId || null,
      currentVersionNumber: latestVersion?.versionNumber || null,
      nextVersionNumber,
      replacementFilename: replacementFile.name,
      replacementLabel: input.replacementLabel || fileNameBase(replacementFile.name),
      replacementByteLength:
        replacementFile.contentByteLength || Buffer.from(replacementFile.contentBase64, "base64").byteLength,
      replacementBase64Length: replacementFile.contentBase64Length,
      mergeFieldCount: template.mergeFields?.length || 0,
      validation,
      confirmRequired: true,
    };

    if (validation.errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-replace-version",
          mode: "preview",
          error: "Replacement template validation failed.",
          preview,
          safety: replacementSafety(false),
        },
        { status: 400 }
      );
    }

    if (!input.confirm) {
      return NextResponse.json({
        ok: true,
        action: "document-template-replace-version",
        mode: "preview",
        preview,
        safety: replacementSafety(false),
        note:
          "Preview only.  No database records changed.  Confirm replacement to create a new DocumentTemplateVersion and make it current.",
      });
    }

    let createdVersion: any = null;

    await prisma.$transaction(
      async (tx) => {
        const version = await tx.documentTemplateVersion.create({
          data: {
            templateId: template.id,
            versionNumber: nextVersionNumber,
            status: "active",
            bodyFormat: "docx-template",
            storageKind: "db-docx-base64",
            contentText: replacementFile.contentBase64,
            contentJson: {
              replacementSource: "template-detail-replacement-upload",
              replacementLabel: input.replacementLabel || fileNameBase(replacementFile.name),
              note: input.note || null,
              uploadedTemplateFile: {
                name: replacementFile.name,
                size: replacementFile.size,
                type: replacementFile.type || DOCX_CONTENT_TYPE,
                lastModified: replacementFile.lastModified || null,
                lastModifiedIso: replacementFile.lastModifiedIso || null,
                storageKind: "db-docx-base64",
                actualFileStored: true,
                contentRead: true,
                contentBase64Length: replacementFile.contentBase64Length,
                contentByteLength: replacementFile.contentByteLength || null,
              },
              priorCurrentVersionId: template.currentVersionId || null,
              priorLatestVersionNumber: latestVersion?.versionNumber || null,
              replacementConfirmedAt: new Date().toISOString(),
            },
            mergeFieldSet:
              latestVersion?.mergeFieldSet ||
              clean((safeJsonObject(template.metadata) as any).mergeFieldSet) ||
              null,
          },
        });

        await tx.documentTemplate.update({
          where: { id: template.id },
          data: {
            currentVersionId: version.id,
            metadata: {
              ...safeJsonObject(template.metadata),
              lastReplacement: {
                versionId: version.id,
                versionNumber: version.versionNumber,
                filename: replacementFile.name,
                replacementLabel: input.replacementLabel || fileNameBase(replacementFile.name),
                confirmedAt: new Date().toISOString(),
              },
            },
          },
        });

        createdVersion = version;
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    return NextResponse.json({
      ok: true,
      action: "document-template-replace-version",
      mode: "confirm",
      template: {
        id: template.id,
        key: template.key,
        label: template.label,
        priorCurrentVersionId: template.currentVersionId || null,
        newCurrentVersionId: createdVersion?.id || null,
      },
      version: {
        id: createdVersion?.id || null,
        versionNumber: createdVersion?.versionNumber || nextVersionNumber,
        status: createdVersion?.status || "active",
        storageKind: createdVersion?.storageKind || "db-docx-base64",
        hasStoredDocx: Boolean(createdVersion?.contentText),
        storedDocxBytes: createdVersion?.contentText
          ? Buffer.from(createdVersion.contentText, "base64").byteLength
          : preview.replacementByteLength,
      },
      preview,
      safety: replacementSafety(true),
      note:
        "Confirmed replacement created a new DocumentTemplateVersion, preserved prior versions, and updated currentVersionId.  It did not generate documents, upload to Clio, send email, create drafts, print, or queue documents.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-template-replace-version",
        error: error?.message || "Template replacement failed.",
        safety: replacementSafety(false),
      },
      { status: 500 }
    );
  }
}
