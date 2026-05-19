import { getGraphAuthConfig } from "@/lib/graph/config";

export type MicrosoftGraphAppToken = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  extExpiresIn?: number;
  acquiredAt: string;
};

export type MicrosoftGraphTokenRequestResult = {
  ok: boolean;
  status: number;
  statusText: string;
  token?: MicrosoftGraphAppToken;
  error?: string;
};

function redactSecretForError(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "[configured]";
  return `${value.slice(0, 3)}…${value.slice(-3)}`;
}

export function buildMicrosoftGraphTokenEndpoint(tenantId: string): string {
  const tenant = encodeURIComponent(tenantId);
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
}

export function buildMicrosoftGraphClientCredentialsBody(params: {
  clientId: string;
  clientSecret: string;
  scope?: string;
}): URLSearchParams {
  const body = new URLSearchParams();
  body.set("client_id", params.clientId);
  body.set("client_secret", params.clientSecret);
  body.set("scope", params.scope || "https://graph.microsoft.com/.default");
  body.set("grant_type", "client_credentials");
  return body;
}

export async function requestMicrosoftGraphAppToken(): Promise<MicrosoftGraphTokenRequestResult> {
  const config = getGraphAuthConfig();

  const missing = [
    !config.tenantId ? "MICROSOFT_GRAPH_TENANT_ID" : "",
    !config.clientId ? "MICROSOFT_GRAPH_CLIENT_ID" : "",
    !config.clientSecret ? "MICROSOFT_GRAPH_CLIENT_SECRET" : "",
  ].filter(Boolean);

  if (missing.length) {
    return {
      ok: false,
      status: 0,
      statusText: "Missing configuration",
      error: `Missing Microsoft Graph app-only token configuration: ${missing.join(", ")}`,
    };
  }

  const endpoint = buildMicrosoftGraphTokenEndpoint(config.tenantId);
  const body = buildMicrosoftGraphClientCredentialsBody({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
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
      json?.error_description ||
      json?.error ||
      text ||
      `Microsoft Graph token request failed: ${response.status} ${response.statusText}`;

    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      error: String(message).replace(config.clientSecret, redactSecretForError(config.clientSecret)),
    };
  }

  const accessToken = typeof json?.access_token === "string" ? json.access_token : "";
  if (!accessToken) {
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      error: "Microsoft Graph token response did not include access_token.",
    };
  }

  return {
    ok: true,
    status: response.status,
    statusText: response.statusText,
    token: {
      accessToken,
      tokenType: typeof json?.token_type === "string" ? json.token_type : "Bearer",
      expiresIn: Number(json?.expires_in || 0),
      extExpiresIn: json?.ext_expires_in === undefined ? undefined : Number(json.ext_expires_in || 0),
      acquiredAt: new Date().toISOString(),
    },
  };
}
