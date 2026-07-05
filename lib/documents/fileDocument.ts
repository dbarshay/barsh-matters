// Core filing logic (Phase 3), extracted so it's testable headlessly. Takes a Prisma-like client as
// an argument (so a script can pass a direct client and the route passes the server-only one) and
// does NOT import "@/lib/prisma" — keeping it importable in any context. Pure taxonomy enforcement +
// label dedup + duplicate-hash guard + audited write.

import {
  composeTitleLabel,
  findTitle,
  getFolder,
  isTitleAllowed,
  FREEHAND_TITLE_KEY,
} from "@/lib/documents/folderTaxonomy";

export type FileDocumentInput = {
  matterId: number;
  clioDocumentId: string;
  folderKey: string;
  titleKey: string;
  matterDisplayNumber?: string | null;
  level?: string | null;
  freehandTitle?: string | null;
  fields?: Record<string, unknown>;
  fileName?: string | null;
  contentType?: string | null;
  fileHash?: string | null;
  sourceType?: string;
  ocrExtractionId?: string | null;
  confirmDuplicate?: boolean;
  actorName?: string | null;
  actorEmail?: string | null;
};

export type FileDocumentResult =
  | { ok: true; document: { id: string; titleLabel: string; folderKey: string; level: string } }
  | { ok: false; status: number; error: string; duplicate?: boolean; existing?: unknown };

const fail = (status: number, error: string, extra?: Record<string, unknown>): FileDocumentResult => ({
  ok: false,
  status,
  error,
  ...extra,
});

/** `db` is a PrismaClient (or a client with filedDocument/auditLog/$transaction). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fileDocument(db: any, input: FileDocumentInput): Promise<FileDocumentResult> {
  const matterId = Number(input.matterId);
  const clioDocumentId = String(input.clioDocumentId ?? "").trim();
  const folderKey = String(input.folderKey ?? "").trim();
  const titleKey = String(input.titleKey ?? "").trim();
  const freehandTitle = input.freehandTitle == null ? null : String(input.freehandTitle).trim();
  const fields = (input.fields ?? {}) as Record<string, unknown>;
  const fileHash = input.fileHash == null ? null : String(input.fileHash).trim() || null;
  const confirmDuplicate = input.confirmDuplicate === true;

  if (!Number.isFinite(matterId) || matterId <= 0) return fail(400, "matterId (positive integer) required.");
  if (!clioDocumentId) return fail(400, "clioDocumentId required.");

  const folder = getFolder(folderKey);
  if (!folder || !folder.terminal) return fail(400, `Unknown terminal folder "${folderKey}".`);
  if (!isTitleAllowed(folderKey, titleKey)) return fail(400, `Title "${titleKey}" not allowed in "${folderKey}".`);
  if (titleKey === FREEHAND_TITLE_KEY && !freehandTitle) return fail(400, "Freehand title requires text.");

  // Required prompt fields (respecting showWhen conditions).
  if (titleKey !== FREEHAND_TITLE_KEY) {
    const title = findTitle(folderKey, titleKey);
    for (const p of title?.prompts ?? []) {
      if (!p.required) continue;
      if (p.showWhen) {
        const gate = String(fields[p.showWhen.field] ?? "");
        if (!p.showWhen.equals.includes(gate)) continue;
      }
      const v = fields[p.key];
      if (v == null || String(v).trim() === "") return fail(400, `Missing required field "${p.label}".`);
    }
  }

  // Exact-duplicate bytes already filed on this matter → warn unless confirmed.
  if (fileHash) {
    const dup = await db.filedDocument.findFirst({
      where: { matterId, fileHash, status: "active" },
      select: { id: true, titleLabel: true, folderKey: true },
    });
    if (dup && !confirmDuplicate) {
      return fail(409, "An identical file is already filed on this matter.", { duplicate: true, existing: dup });
    }
  }

  // Compose the label, disambiguating with (2)/(3)… if it collides in this folder.
  const base = composeTitleLabel(folderKey, titleKey, fields, freehandTitle);
  const siblings = await db.filedDocument.findMany({
    where: { matterId, folderKey, status: "active" },
    select: { titleLabel: true },
  });
  const existingLabels = new Set(siblings.map((s: { titleLabel: string }) => s.titleLabel));
  let titleLabel = base;
  if (existingLabels.has(base)) {
    let n = 2;
    while (existingLabels.has(`${base} (${n})`)) n++;
    titleLabel = `${base} (${n})`;
  }

  const matterDisplayNumber =
    input.matterDisplayNumber == null ? null : String(input.matterDisplayNumber).trim() || null;
  const level = input.level === "matter" || input.level === "lawsuit" ? String(input.level) : folder.level;
  const sourceType = ["upload", "email_attachment", "template", "scan"].includes(String(input.sourceType))
    ? String(input.sourceType)
    : "upload";

  const created = await db.$transaction(async (tx: any) => {
    const doc = await tx.filedDocument.create({
      data: {
        matterId,
        matterDisplayNumber,
        level,
        clioDocumentId,
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? null,
        fileHash,
        folderKey,
        titleKey,
        titleLabel,
        freehandTitle: titleKey === FREEHAND_TITLE_KEY ? freehandTitle : null,
        fields: JSON.parse(JSON.stringify(fields)),
        sourceType,
        ocrExtractionId: input.ocrExtractionId ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "document.filed",
        entityType: "FiledDocument",
        summary: `Filed "${titleLabel}" into ${folder.name}`,
        matterId,
        matterDisplayNumber,
        details: { folderKey, titleKey, titleLabel, clioDocumentId, sourceType, level },
        workflow: "documents",
        sourcePage: "documents-folder-tree",
        actorName: input.actorName ?? null,
        actorEmail: input.actorEmail ?? null,
      },
    });
    return doc;
  });

  return { ok: true, document: created };
}
