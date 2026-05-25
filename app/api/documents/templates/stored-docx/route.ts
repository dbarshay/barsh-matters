import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safeFilename(value: unknown): string {
  const raw = clean(value) || "Document Template.docx";
  const cleaned = raw.replace(/[\\/:*?"<>|#%{}~&]+/g, "_").slice(0, 180);
  return cleaned.toLowerCase().endsWith(".docx") ? cleaned : `${cleaned || "Document Template"}.docx`;
}

function metadataFileName(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const json = value as any;
  const uploaded = json.uploadedTemplateFile;
  if (!uploaded || typeof uploaded !== "object" || Array.isArray(uploaded)) return "";
  return clean(uploaded.name);
}

export async function GET(req: NextRequest) {
  try {
    const versionId = clean(req.nextUrl.searchParams.get("versionId"));
    const templateKey = clean(req.nextUrl.searchParams.get("templateKey"));

    if (!versionId && !templateKey) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-stored-docx-download",
          error: "Missing versionId or templateKey.",
          safety: {
            readOnly: true,
            noDatabaseRecordsChanged: true,
            noClioRecordsChanged: true,
            noEmailSent: true,
            noPrintQueueChanged: true,
          },
        },
        { status: 400 }
      );
    }

    const version = versionId
      ? await prisma.documentTemplateVersion.findUnique({
          where: { id: versionId },
          include: { template: true },
        })
      : await prisma.documentTemplateVersion.findFirst({
          where: {
            template: {
              key: templateKey,
            },
          },
          orderBy: { versionNumber: "desc" },
          include: { template: true },
        });

    if (!version) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-stored-docx-download",
          error: "Stored template version was not found.",
          versionId: versionId || null,
          templateKey: templateKey || null,
          safety: {
            readOnly: true,
            noDatabaseRecordsChanged: true,
            noClioRecordsChanged: true,
            noEmailSent: true,
            noPrintQueueChanged: true,
          },
        },
        { status: 404 }
      );
    }

    if (version.storageKind !== "db-docx-base64" || !version.contentText) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-stored-docx-download",
          error: "This template version does not have a stored DOCX payload.",
          templateKey: version.template?.key || null,
          versionId: version.id,
          storageKind: version.storageKind,
          safety: {
            readOnly: true,
            noDatabaseRecordsChanged: true,
            noClioRecordsChanged: true,
            noEmailSent: true,
            noPrintQueueChanged: true,
          },
        },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(version.contentText, "base64");
    const filename = safeFilename(
      metadataFileName(version.contentJson) ||
        version.template?.defaultFilenameSuffix ||
        version.template?.label ||
        version.template?.key ||
        "Document Template.docx"
    );

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": DOCX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Barsh-Matters-Action": "document-template-stored-docx-download",
        "X-Barsh-Matters-Template-Key": version.template?.key || "",
        "X-Barsh-Matters-Template-Version-Id": version.id,
        "X-Barsh-Matters-Read-Only": "true",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-template-stored-docx-download",
        error: error?.message || "Stored DOCX download failed.",
        safety: {
          readOnly: true,
          noDatabaseRecordsChanged: true,
          noClioRecordsChanged: true,
          noEmailSent: true,
          noPrintQueueChanged: true,
        },
      },
      { status: 500 }
    );
  }
}
