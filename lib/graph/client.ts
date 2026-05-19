import { getGraphAuthConfig, getGraphAuthReadiness } from "@/lib/graph/config";
import { requestMicrosoftGraphAppToken } from "@/lib/graph/token";

export type GraphJsonResult = {
  ok: boolean;
  status: number;
  statusText: string;
  json?: any;
  error?: string;
};

export function graphApiBase(): string {
  return "https://graph.microsoft.com/v1.0";
}

export function graphMailboxMessagesUrl(mailboxUserId: string): string {
  return `${graphApiBase()}/users/${encodeURIComponent(mailboxUserId)}/messages`;
}

export async function graphFetchJson(params: {
  url: string;
  method?: string;
  body?: unknown;
}): Promise<GraphJsonResult> {
  const tokenResult = await requestMicrosoftGraphAppToken();

  if (!tokenResult.ok || !tokenResult.token?.accessToken) {
    return {
      ok: false,
      status: tokenResult.status,
      statusText: tokenResult.statusText,
      error: tokenResult.error || "Microsoft Graph token request failed.",
    };
  }

  const response = await fetch(params.url, {
    method: params.method || "GET",
    headers: {
      Authorization: `Bearer ${tokenResult.token.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
    cache: "no-store",
  });

  const text = await response.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message =
      json?.error?.message ||
      json?.error_description ||
      json?.error ||
      text ||
      `Microsoft Graph request failed: ${response.status} ${response.statusText}`;

    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      json,
      error: String(message),
    };
  }

  return {
    ok: true,
    status: response.status,
    statusText: response.statusText,
    json,
  };
}

export function assertGraphDraftEnvironmentReady(): { ok: true; mailboxUserId: string } | { ok: false; error: string; readiness: any } {
  const config = getGraphAuthConfig();
  const readiness = getGraphAuthReadiness(config);

  if (!readiness.readyForFutureDraftCreation) {
    return {
      ok: false,
      readiness,
      error:
        "Microsoft Graph draft creation is not configured.  Configure tenant ID, client ID, client secret, and mailbox user before creating drafts.",
    };
  }

  return { ok: true, mailboxUserId: config.mailboxUserId };
}
