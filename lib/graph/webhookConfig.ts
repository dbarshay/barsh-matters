// Config for the Microsoft Graph email webhook (real-time inbound sync). Flag-gated and off by default.
// The client-state secret authenticates notifications (Graph echoes it back on every POST); the
// notification URL must be a public HTTPS endpoint reachable by Microsoft.

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export const EMAIL_WEBHOOK_DISABLED_MESSAGE =
  "Email webhook is disabled. Set BARSH_EMAIL_WEBHOOK_ENABLED=1 to enable real-time Graph notifications.";

export function isEmailWebhookEnabled(): boolean {
  return clean(process.env.BARSH_EMAIL_WEBHOOK_ENABLED) === "1";
}

/** Shared secret Graph echoes back in every notification (`clientState`); we reject any mismatch. */
export function getWebhookClientState(): string {
  return clean(process.env.BARSH_EMAIL_WEBHOOK_CLIENT_STATE);
}

/**
 * Public HTTPS URL Graph will POST notifications to. Prefer an explicit override; otherwise derive it
 * from the deployment's public base URL (VERCEL env or a configured base) + the webhook path.
 */
export function getWebhookNotificationUrl(): string {
  const explicit = clean(process.env.BARSH_EMAIL_WEBHOOK_URL);
  if (explicit) return explicit;
  const base =
    clean(process.env.BARSH_PUBLIC_BASE_URL) ||
    clean(process.env.NEXT_PUBLIC_APP_URL) ||
    (clean(process.env.VERCEL_PROJECT_PRODUCTION_URL) ? `https://${clean(process.env.VERCEL_PROJECT_PRODUCTION_URL)}` : "") ||
    (clean(process.env.VERCEL_URL) ? `https://${clean(process.env.VERCEL_URL)}` : "");
  if (!base) return "";
  return `${base.replace(/\/+$/, "")}/api/graph/webhook`;
}
