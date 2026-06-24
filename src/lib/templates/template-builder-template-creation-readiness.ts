import {
  TEMPLATE_BUILDER_PERMISSION,
  TEMPLATE_REPOSITORY_STORAGE_PREFIXES,
  templateBuilderStoragePrefixForStatus,
} from "./template-builder-readiness-contract";

export type TemplateBuilderDefaultSignatureMode = "Firm" | "User Selects";

export type TemplateBuilderTemplateCreationField =
  | "BM display name"
  | "local DOCX file picker"
  | "default signature mode";

export type TemplateBuilderCreationReadinessResult = {
  ready: boolean;
  blockingIssues: string[];
  warnings: string[];
};

export const TEMPLATE_BUILDER_TEMPLATE_CREATION_PERMISSION = TEMPLATE_BUILDER_PERMISSION;

export const TEMPLATE_BUILDER_TEMPLATE_CREATION_REQUIRED_FIELDS: TemplateBuilderTemplateCreationField[] = [
  "BM display name",
  "local DOCX file picker",
  "default signature mode",
];

export const TEMPLATE_BUILDER_DEFAULT_SIGNATURE_MODES: TemplateBuilderDefaultSignatureMode[] = [
  "Firm",
  "User Selects",
];

export const TEMPLATE_BUILDER_TEMPLATE_CREATION_DEFAULT_STATUS = "Inactive" as const;

export const TEMPLATE_BUILDER_TEMPLATE_CREATION_STORAGE_PREFIX = templateBuilderStoragePrefixForStatus("Inactive");

export const TEMPLATE_BUILDER_TEMPLATE_CREATION_REJECTED_FILE_TYPES = [
  "pdf",
  "doc",
  "rtf",
  "txt",
  "pages",
  "odt",
  "zip",
] as const;

export const TEMPLATE_BUILDER_TEMPLATE_FILENAME_UNIQUENESS_SCOPE = TEMPLATE_REPOSITORY_STORAGE_PREFIXES;

export const TEMPLATE_BUILDER_TEMPLATE_CREATION_AUDIT_ACTIONS = [
  "template created/seeded",
  "DOCX stored in BM cloud template repository",
  "initial token scan completed",
] as const;

export function templateBuilderCreationShowsStoredPathInRoutineUi() {
  return false;
}

export function templateBuilderCreationStoresTemplatesInClio() {
  return false;
}

export function templateBuilderCreationWritesMatterSideGenerateDocuments() {
  return false;
}

export function templateBuilderCreationRequiresTokenScanBeforeSave() {
  return true;
}

export function templateBuilderCreationUpdatesLastEdited() {
  return true;
}

export function templateBuilderCreationInitialStatus() {
  return TEMPLATE_BUILDER_TEMPLATE_CREATION_DEFAULT_STATUS;
}

export function templateBuilderCreationStoragePrefix() {
  return TEMPLATE_BUILDER_TEMPLATE_CREATION_STORAGE_PREFIX;
}

export function templateBuilderIsSupportedTemplateDocxFilename(filename: string) {
  const name = String(filename || "").trim();
  return name.toLowerCase().endsWith(".docx") && name.length > ".docx".length;
}

export function templateBuilderNormalizeUploadedTemplateFilename(filename: string) {
  return String(filename || "")
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, " ");
}

export function templateBuilderTemplateDisplayNameValid(displayName: string) {
  return String(displayName || "").trim().length > 0;
}

export function templateBuilderDefaultSignatureModeValid(mode: string): mode is TemplateBuilderDefaultSignatureMode {
  return TEMPLATE_BUILDER_DEFAULT_SIGNATURE_MODES.includes(mode as TemplateBuilderDefaultSignatureMode);
}

export function templateBuilderFilenameAvailableAcrossRepository(
  uploadedFilename: string,
  existingRepositoryFilenames: string[],
  currentTemplateFilename?: string,
) {
  const normalized = templateBuilderNormalizeUploadedTemplateFilename(uploadedFilename).toLowerCase();
  const current = templateBuilderNormalizeUploadedTemplateFilename(currentTemplateFilename || "").toLowerCase();
  return existingRepositoryFilenames
    .map((name) => templateBuilderNormalizeUploadedTemplateFilename(name).toLowerCase())
    .every((name) => name === current || name !== normalized);
}

export function templateBuilderCreationReadinessCheck(input: {
  displayName: string;
  filename: string;
  defaultSignatureMode: string;
  existingRepositoryFilenames?: string[];
}) {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (!templateBuilderTemplateDisplayNameValid(input.displayName)) {
    blockingIssues.push("BM display name is required.");
  }

  if (!templateBuilderIsSupportedTemplateDocxFilename(input.filename)) {
    blockingIssues.push("A .docx Word template file is required.");
  }

  if (!templateBuilderDefaultSignatureModeValid(input.defaultSignatureMode)) {
    blockingIssues.push("Default signature mode must be Firm or User Selects.");
  }

  if (
    templateBuilderIsSupportedTemplateDocxFilename(input.filename) &&
    !templateBuilderFilenameAvailableAcrossRepository(input.filename, input.existingRepositoryFilenames || [])
  ) {
    blockingIssues.push("Uploaded local DOCX filename is already used in the template repository.");
  }

  if (templateBuilderIsSupportedTemplateDocxFilename(input.filename) && input.filename !== templateBuilderNormalizeUploadedTemplateFilename(input.filename)) {
    warnings.push("Uploaded filename will be normalized before cloud storage.");
  }

  return {
    ready: blockingIssues.length === 0,
    blockingIssues,
    warnings,
  } satisfies TemplateBuilderCreationReadinessResult;
}

export function templateBuilderCreationReadyForImplementationSummary() {
  return {
    permission: TEMPLATE_BUILDER_TEMPLATE_CREATION_PERMISSION,
    requiredFields: TEMPLATE_BUILDER_TEMPLATE_CREATION_REQUIRED_FIELDS,
    defaultStatus: TEMPLATE_BUILDER_TEMPLATE_CREATION_DEFAULT_STATUS,
    storagePrefix: TEMPLATE_BUILDER_TEMPLATE_CREATION_STORAGE_PREFIX,
    filenameUniquenessScope: TEMPLATE_BUILDER_TEMPLATE_FILENAME_UNIQUENESS_SCOPE,
    storesInClio: templateBuilderCreationStoresTemplatesInClio(),
    wiresGenerateDocuments: templateBuilderCreationWritesMatterSideGenerateDocuments(),
    showsStoredPathInRoutineUi: templateBuilderCreationShowsStoredPathInRoutineUi(),
    requiresTokenScanBeforeSave: templateBuilderCreationRequiresTokenScanBeforeSave(),
    updatesLastEdited: templateBuilderCreationUpdatesLastEdited(),
  };
}
