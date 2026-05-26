import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function clean(value: unknown): string {
  return String(value || "").trim();
}

function safeFilename(value: unknown): string {
  const raw = clean(value) || "barsh-matters-template.docx";
  const withExtension = raw.toLowerCase().endsWith(".docx") ? raw : `${raw}.docx`;
  return withExtension.replace(/[^\w.\- ()]/g, "_");
}

export async function GET(req: NextRequest) {
  try {
    const versionId = clean(req.nextUrl.searchParams.get("versionId"));
    if (!versionId) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-stored-docx-download",
          error: "Missing versionId.",
        },
        { status: 400 }
      );
    }

    const version = await prisma.documentTemplateVersion.findUnique({
      where: { id: versionId },
      include: {
        template: {
          select: {
            key: true,
            label: true,
            defaultFilenameSuffix: true,
          },
        },
      },
    });

    if (!version) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-stored-docx-download",
          error: "Stored DOCX template version was not found.",
        },
        { status: 404 }
      );
    }

    if (version.storageKind !== "db-docx-base64" || !version.contentText) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-stored-docx-download",
          error: "This template version does not contain a stored DB DOCX payload.",
          storageKind: version.storageKind,
          hasContentText: Boolean(version.contentText),
        },
        { status: 409 }
      );
    }

    const filename = safeFilename(
      version.template?.defaultFilenameSuffix ||
        version.template?.label ||
        version.template?.key ||
        version.id
    );

    const buffer = Buffer.from(version.contentText, "base64");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": DOCX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Barsh-Matters-Action": "document-template-stored-docx-download",
        "X-Barsh-Matters-Storage-Kind": "db-docx-base64",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-template-stored-docx-download",
        error: error?.message || "Stored DOCX template download failed.",
      },
      { status: 500 }
    );
  }
}
