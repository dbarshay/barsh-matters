// Kill-switch for the matter-import module. OFF by default — import routes 403 unless enabled.
// Enable with env BARSH_IMPORT_ENABLED=1 (or "true").
export function isImportEnabled(): boolean {
  const v = String(process.env.BARSH_IMPORT_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export const IMPORT_DISABLED_MESSAGE =
  "Matter import is disabled. Set BARSH_IMPORT_ENABLED=1 to enable.";
