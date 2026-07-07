// Native matter email feature flag. Mirrors lib/documents/uploadDocsConfig.ts.
// Enable with env BARSH_MATTER_EMAIL_ENABLED=1 (or "true"/"yes"/"on").
//
// This gates the matter-email SEND surface (compose + send). Off = the send route 403s and the
// compose UI is hidden. Sending a real email is always additionally operator-confirmed per send.
export function isMatterEmailEnabled(): boolean {
  const v = String(process.env.BARSH_MATTER_EMAIL_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export const MATTER_EMAIL_DISABLED_MESSAGE =
  "Matter email is disabled. Set BARSH_MATTER_EMAIL_ENABLED=1 to enable.";
