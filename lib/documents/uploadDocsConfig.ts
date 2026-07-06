// Upload Docs module feature flag. Mirrors lib/import/importConfig.ts.
// Enable with env BARSH_UPLOAD_DOCS_ENABLED=1 (or "true"/"yes"/"on").
//
// NOTE: this flag only gates the Upload Docs UI + API surface. The actual live write into
// Clio is separately gated by the shared Clio storage write-guard flags
// (CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED / _CREATE_FOLDERS_ENABLED / _LIVE_WRITE_ENABLED).
// Both must be on for a real Clio upload to occur.
export function isUploadDocsEnabled(): boolean {
  const v = String(process.env.BARSH_UPLOAD_DOCS_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export const UPLOAD_DOCS_DISABLED_MESSAGE =
  "Upload Docs is disabled. Set BARSH_UPLOAD_DOCS_ENABLED=1 to enable.";
