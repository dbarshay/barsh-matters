import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  downloadWorkingDocxFromGraph,
  uploadWorkingDocxToGraph,
} from "@/lib/documents/graphWorkingDocuments";
import { readSignedAdminIdentityCookie, ADMIN_IDENTITY_COOKIE_NAME } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};
}

function safeFilename(value: unknown): string {
  return (clean(value) || "Template")
    .replace(/\.docx$/i, "")
    .replace(/[\/\\:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function editSafety(databaseRecordsChanged = false, graphFileCreated = false, graphFileRead = false) {
  return {
    action: "document-template-edit-working-docx",
    localTemplateRepositoryWrite: databaseRecordsChanged,
    createsNewVersionOnly: databaseRecordsChanged,
    preservesPriorVersions: true,
    updatesCurrentVersionId: databaseRecordsChanged,
    graphFileCreated,
    graphFileRead,
    clioWrites: false,
    draftsCreated: false,
    emailsSent: false,
    printQueued: false,
    documentsGenerated: false,
  };
}

async function loadCurrentStoredTemplate(key: string) {
  const template = await prisma.documentTemplate.findUnique({
    where: { key },
    include: {
      versions: {
        orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
      },
      mergeFields: {
        orderBy: [{ source: "asc" }, { key: "asc" }],
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const key = clean(body?.key);
    const mode = clean(body?.mode || body?.action || "launch").toLowerCase();

    const editorDisplayName = (() => {
      try {
        const identity = readSignedAdminIdentityCookie(req.cookies.get(ADMIN_IDENTITY_COOKIE_NAME)?.value);
        if (!identity) return "System";
        return clean(identity.username) || clean(identity.email) || "System";
      } catch {
        return "System";
      }
    })();

    if (!key) {
      return NextResponse.json({ ok: false, action: "document-template-edit-working-docx", error: "Missing template key.", safety: editSafety(false, false, false) }, { status: 400 });
    }

    if (mode === "launch") {
      const loaded = await loadCurrentStoredTemplate(key);
      if ("error" in loaded) {
        return NextResponse.json({ ok: false, action: "document-template-edit-working-docx", error: loaded.error, safety: editSafety(false, false, false) }, { status: loaded.status });
      }

      const sourceBuffer = Buffer.from(loaded.currentVersion.contentText || "", "base64");
      const filename = `${safeFilename(loaded.template.label || loaded.template.key)} - Template Edit v${loaded.currentVersion.versionNumber}.docx`;
      const working = await uploadWorkingDocxToGraph({
        docxBuffer: sourceBuffer,
        filename,
        folder: "BarshMattersTemplateEdits",
      });

      return NextResponse.json({
        ok: true,
        action: "document-template-edit-working-docx",
        mode: "launch",
        template: {
          id: loaded.template.id,
          key: loaded.template.key,
          label: loaded.template.label,
          currentVersionId: loaded.template.currentVersionId || loaded.currentVersion.id,
          currentVersionNumber: loaded.currentVersion.versionNumber,
        },
        workingDocument: working,
        safety: editSafety(false, true, false),
        note: "Working DOCX was created in Microsoft Graph/OneDrive for editing. Save Edited Template pulls this edited DOCX back into the local template repository as a new current version.",
      });
    }

    if (mode === "save") {
      const driveItemId = clean(body?.driveItemId);
      if (!driveItemId) {
        return NextResponse.json({ ok: false, action: "document-template-edit-working-docx", error: "Missing working document driveItemId.", safety: editSafety(false, false, false) }, { status: 400 });
      }

      const loaded = await loadCurrentStoredTemplate(key);
      if ("error" in loaded) {
        return NextResponse.json({ ok: false, action: "document-template-edit-working-docx", error: loaded.error, safety: editSafety(false, false, false) }, { status: loaded.status });
      }

      const edited = await downloadWorkingDocxFromGraph(driveItemId);
      if (!edited.buffer.byteLength) {
        return NextResponse.json({ ok: false, action: "document-template-edit-working-docx", error: "Edited working DOCX was empty.", safety: editSafety(false, false, true) }, { status: 409 });
      }

      const latestVersion = loaded.template.versions[0] || loaded.currentVersion;
      const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
      let createdVersion: any = null;

      await prisma.$transaction(async (tx) => {
        const version = await tx.documentTemplateVersion.create({
          data: {
            templateId: loaded.template.id,
            versionNumber: nextVersionNumber,
            status: loaded.currentVersion.status || "production-ready",
            bodyFormat: "docx-template",
            storageKind: "db-docx-base64",
            contentText: edited.buffer.toString("base64"),
            contentJson: {
              ...safeObject(loaded.currentVersion.contentJson),
              editTemplateSource: "template-detail-edit-template-working-docx",
              graphDriveItemId: driveItemId,
              graphEditedContentType: edited.contentType || DOCX_CONTENT_TYPE,
              graphEditedByteLength: edited.byteLength,
              priorCurrentVersionId: loaded.template.currentVersionId || null,
              priorLatestVersionNumber: latestVersion?.versionNumber || null,
              savedFromGraphAt: new Date().toISOString(),
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
              lastEditedBy: editorDisplayName,
              lastEditedAt: new Date().toISOString(),
              lastEditTemplateSave: {
                versionId: version.id,
                versionNumber: version.versionNumber,
                graphDriveItemId: driveItemId,
                editedByteLength: edited.byteLength,
                savedAt: new Date().toISOString(),
              },
            },
          },
        });

        createdVersion = version;
      }, { maxWait: 10000, timeout: 30000 });

      return NextResponse.json({
        ok: true,
        action: "document-template-edit-working-docx",
        mode: "save",
        template: {
          key: loaded.template.key,
          label: loaded.template.label,
          priorCurrentVersionId: loaded.template.currentVersionId || loaded.currentVersion.id,
          newCurrentVersionId: createdVersion?.id || null,
        },
        version: {
          id: createdVersion?.id || null,
          versionNumber: createdVersion?.versionNumber || nextVersionNumber,
          storageKind: createdVersion?.storageKind || "db-docx-base64",
          hasStoredDocx: Boolean(createdVersion?.contentText),
          editedByteLength: edited.byteLength,
        },
        safety: editSafety(true, false, true),
        note: "Saved edited working DOCX as a new current DocumentTemplateVersion. Prior versions were preserved. No Clio, email, draft, print, queue, or document-generation action was performed.",
      });
    }

    return NextResponse.json({ ok: false, action: "document-template-edit-working-docx", error: "Unsupported mode. Use launch or save.", safety: editSafety(false, false, false) }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, action: "document-template-edit-working-docx", error: error?.message || "Template edit workflow failed.", safety: editSafety(false, false, false) }, { status: 500 });
  }
}
