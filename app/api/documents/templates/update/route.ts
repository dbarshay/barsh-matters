import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTemplateFilingTarget } from "@/lib/documents/templateFiling";
import { readSignedAdminIdentityCookie, ADMIN_IDENTITY_COOKIE_NAME } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};
}

function normalizeCategory(value: unknown) {
  const text = clean(value);
  if (text === "correspondence" || text === "pleadings" || text === "discovery" || text === "general") return text;
  return "general";
}

function normalizeOutputFormat(value: unknown) {
  const text = clean(value).toLowerCase();
  return text || "docx";
}

function normalizeSignerMode(value: unknown) {
  const text = clean(value);
  if (text === "select_at_generation") return text;
  return "signed_in_user";
}

function normalizeContactMode(value: unknown) {
  const text = clean(value);
  if (text === "firm") return text;
  return "signer";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const key = clean(body?.key);

    if (!key) {
      return NextResponse.json({ ok: false, action: "document-template-update", error: "Missing template key." }, { status: 400 });
    }

    const editorDisplayName = (() => {
      try {
        const identity = readSignedAdminIdentityCookie(req.cookies.get(ADMIN_IDENTITY_COOKIE_NAME)?.value);
        if (!identity) return "System";
        return clean(identity.username) || clean(identity.email) || "System";
      } catch {
        return "System";
      }
    })();

    const existing = await prisma.documentTemplate.findUnique({
      where: { key },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, action: "document-template-update", error: "Template not found." }, { status: 404 });
    }

    const label = clean(body?.label);
    if (!label) {
      return NextResponse.json({ ok: false, action: "document-template-update", error: "Template display name is required." }, { status: 400 });
    }

    const priorMetadata = safeObject(existing.metadata);
    const defaultSignerMode = normalizeSignerMode(body?.defaultSignerMode);
    const defaultContactDisplayMode = normalizeContactMode(body?.defaultContactDisplayMode);

    // Auto-file target: which approved folder/title the generated (finalized) document files into.
    const filingValidation = validateTemplateFilingTarget({
      folderKey: body?.filedFolderKey,
      titleKey: body?.filedTitleKey,
      freehandTitle: body?.filedFreehandTitle,
    });
    if (!filingValidation.ok) {
      return NextResponse.json(
        { ok: false, action: "document-template-update", error: filingValidation.error },
        { status: 400 },
      );
    }

    const metadata = {
      ...priorMetadata,
      defaultSignerMode,
      defaultContactDisplayMode,
      filedFolderKey: filingValidation.target.folderKey,
      filedTitleKey: filingValidation.target.titleKey,
      filedFreehandTitle: filingValidation.target.freehandTitle,
      selectedSignerRule:
        defaultSignerMode === "signed_in_user"
          ? "defaults to signed-in generating user; other eligible signers remain selectable"
          : "no fixed default signer; select eligible signer during generation",
      signerTokenRule: "signer.* tokens resolve from selected signer",
      lastMetadataEditAt: new Date().toISOString(),
      lastMetadataEditSource: "template-detail-ui",
      lastEditedBy: editorDisplayName,
      lastEditedAt: new Date().toISOString(),
    };

    const updated = await prisma.documentTemplate.update({
      where: { key },
      data: {
        label,
        category: normalizeCategory(body?.category),
        description: clean(body?.description) || null,
        defaultFilenameSuffix: clean(body?.defaultFilenameSuffix) || null,
        generationEndpoint: clean(body?.generationEndpoint) || null,
        outputFormat: normalizeOutputFormat(body?.outputFormat),
        metadata,
      },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
    });

    return NextResponse.json({
      ok: true,
      action: "document-template-update",
      key,
      template: {
        id: updated.id,
        key: updated.key,
        label: updated.label,
        category: updated.category,
        description: updated.description,
        defaultFilenameSuffix: updated.defaultFilenameSuffix,
        generationEndpoint: updated.generationEndpoint,
        outputFormat: updated.outputFormat,
        enabled: updated.enabled,
        metadata: updated.metadata,
        currentVersionId: updated.currentVersionId,
        currentVersion: updated.versions[0]
          ? {
              id: updated.versions[0].id,
              versionNumber: updated.versions[0].versionNumber,
              status: updated.versions[0].status,
              storageKind: updated.versions[0].storageKind,
              mergeFieldSet: updated.versions[0].mergeFieldSet,
            }
          : null,
      },
      safety: {
        localFirst: true,
        templateRepositoryWrites: true,
        storedDocxAltered: false,
        clioWrites: false,
        documentsGenerated: false,
        printQueued: false,
        emailsSent: false,
        draftsCreated: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-template-update",
        error: error?.message || "Template update failed.",
      },
      { status: 500 }
    );
  }
}
