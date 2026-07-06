// Template auto-file mapping: which approved folder + title a generated (finalized) document
// files into. Stored on DocumentTemplate.metadata (admin-editable), read at finalize time.
// Keys used in metadata: filedFolderKey, filedTitleKey, filedFreehandTitle.

import { isTitleAllowed, getFolder, FREEHAND_TITLE_KEY } from "@/lib/documents/folderTaxonomy";

export type TemplateFilingTarget = {
  folderKey: string | null;
  titleKey: string | null;
  freehandTitle: string | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Read the (possibly empty) filing target from a template's metadata JSON. */
export function readTemplateFilingTarget(metadata: unknown): TemplateFilingTarget {
  const m = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>;
  return {
    folderKey: str(m.filedFolderKey) || null,
    titleKey: str(m.filedTitleKey) || null,
    freehandTitle: str(m.filedFreehandTitle) || null,
  };
}

/** True when the template has a valid, approved folder+title mapping (freehand needs text). */
export function isTemplateFilingMapped(metadata: unknown): boolean {
  const t = readTemplateFilingTarget(metadata);
  if (!t.folderKey || !t.titleKey) return false;
  const folder = getFolder(t.folderKey);
  if (!folder || !folder.terminal) return false;
  if (!isTitleAllowed(t.folderKey, t.titleKey)) return false;
  if (t.titleKey === FREEHAND_TITLE_KEY && !t.freehandTitle) return false;
  return true;
}

/** Validate + normalize a filing target for persistence. Returns an error string if invalid. */
export function validateTemplateFilingTarget(input: {
  folderKey?: unknown;
  titleKey?: unknown;
  freehandTitle?: unknown;
}): { ok: true; target: TemplateFilingTarget } | { ok: false; error: string } {
  const folderKey = str(input.folderKey);
  const titleKey = str(input.titleKey);
  const freehandTitle = str(input.freehandTitle);

  // Empty mapping is allowed (unmapped); finalize will block until it's set.
  if (!folderKey && !titleKey) {
    return { ok: true, target: { folderKey: null, titleKey: null, freehandTitle: null } };
  }
  if (!folderKey || !titleKey) {
    return { ok: false, error: "Pick both a folder and a title (or leave both blank)." };
  }
  const folder = getFolder(folderKey);
  if (!folder || !folder.terminal) return { ok: false, error: "Folder must be a terminal (fileable) folder." };
  if (!isTitleAllowed(folderKey, titleKey)) return { ok: false, error: "Title is not allowed in that folder." };
  if (titleKey === FREEHAND_TITLE_KEY && !freehandTitle) {
    return { ok: false, error: "A custom title is required when using Other (freehand)." };
  }
  return {
    ok: true,
    target: { folderKey, titleKey, freehandTitle: titleKey === FREEHAND_TITLE_KEY ? freehandTitle : null },
  };
}
