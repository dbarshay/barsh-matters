export type GraphConfigStatus = {
  name: string;
  configured: boolean;
  requiredFor: string;
};

export type GraphAuthConfig = {
  tenantId: string;
  tenantConfiguredAs: string | null;
  clientId: string;
  clientIdConfiguredAs: string | null;
  clientSecret: string;
  clientSecretConfiguredAs: string | null;
  mailboxUserId: string;
  mailboxConfiguredAs: string | null;
  tenantEnvNames: string[];
  clientIdEnvNames: string[];
  clientSecretEnvNames: string[];
  mailboxEnvNames: string[];
};

export type GraphAuthReadiness = {
  tenantConfigured: boolean;
  tenantConfiguredAs: string | null;
  clientIdConfigured: boolean;
  clientIdConfiguredAs: string | null;
  clientSecretConfigured: boolean;
  clientSecretConfiguredAs: string | null;
  mailboxConfigured: boolean;
  mailboxConfiguredAs: string | null;
  appOnlyTokenConfigReady: boolean;
  mailboxTargetReady: boolean;
  readyForFutureDraftCreation: boolean;
  readyForFutureReadOnlySync: boolean;
};

export function cleanGraphConfigValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstConfigured(names: string[]): string | null {
  return names.find((name) => cleanGraphConfigValue(process.env[name]).length > 0) || null;
}

function valueFor(names: string[]): { value: string; configuredAs: string | null } {
  const configuredAs = firstConfigured(names);
  return {
    configuredAs,
    value: configuredAs ? cleanGraphConfigValue(process.env[configuredAs]) : "",
  };
}

export function graphEnvStatus(name: string, requiredFor: string): GraphConfigStatus {
  return {
    name,
    configured: cleanGraphConfigValue(process.env[name]).length > 0,
    requiredFor,
  };
}

export function getGraphAuthConfig(): GraphAuthConfig {
  const tenantEnvNames = ["MICROSOFT_GRAPH_TENANT_ID", "AZURE_TENANT_ID"];
  const clientIdEnvNames = ["MICROSOFT_GRAPH_CLIENT_ID", "AZURE_CLIENT_ID"];
  const clientSecretEnvNames = ["MICROSOFT_GRAPH_CLIENT_SECRET", "AZURE_CLIENT_SECRET"];
  const mailboxEnvNames = [
    "MICROSOFT_GRAPH_MAILBOX_USER_ID",
    "MICROSOFT_GRAPH_DEFAULT_MAILBOX",
    "OUTLOOK_DEFAULT_MAILBOX",
  ];

  const tenant = valueFor(tenantEnvNames);
  const clientId = valueFor(clientIdEnvNames);
  const clientSecret = valueFor(clientSecretEnvNames);
  const mailbox = valueFor(mailboxEnvNames);

  return {
    tenantId: tenant.value,
    tenantConfiguredAs: tenant.configuredAs,
    clientId: clientId.value,
    clientIdConfiguredAs: clientId.configuredAs,
    clientSecret: clientSecret.value,
    clientSecretConfiguredAs: clientSecret.configuredAs,
    mailboxUserId: mailbox.value,
    mailboxConfiguredAs: mailbox.configuredAs,
    tenantEnvNames,
    clientIdEnvNames,
    clientSecretEnvNames,
    mailboxEnvNames,
  };
}

export function getGraphAuthReadiness(config = getGraphAuthConfig()): GraphAuthReadiness {
  const tenantConfigured = config.tenantId.length > 0;
  const clientIdConfigured = config.clientId.length > 0;
  const clientSecretConfigured = config.clientSecret.length > 0;
  const mailboxConfigured = config.mailboxUserId.length > 0;

  const appOnlyTokenConfigReady = tenantConfigured && clientIdConfigured && clientSecretConfigured;
  const mailboxTargetReady = mailboxConfigured;

  return {
    tenantConfigured,
    tenantConfiguredAs: config.tenantConfiguredAs,
    clientIdConfigured,
    clientIdConfiguredAs: config.clientIdConfiguredAs,
    clientSecretConfigured,
    clientSecretConfiguredAs: config.clientSecretConfiguredAs,
    mailboxConfigured,
    mailboxConfiguredAs: config.mailboxConfiguredAs,
    appOnlyTokenConfigReady,
    mailboxTargetReady,
    readyForFutureDraftCreation: appOnlyTokenConfigReady && mailboxTargetReady,
    readyForFutureReadOnlySync: appOnlyTokenConfigReady && mailboxTargetReady,
  };
}

export function requiredGraphEnvironment(): GraphConfigStatus[] {
  return [
    graphEnvStatus("MICROSOFT_GRAPH_TENANT_ID", "Microsoft Graph app-only token acquisition"),
    graphEnvStatus("MICROSOFT_GRAPH_CLIENT_ID", "Microsoft Graph app-only token acquisition"),
    graphEnvStatus("MICROSOFT_GRAPH_CLIENT_SECRET", "Microsoft Graph app-only token acquisition"),
    graphEnvStatus("MICROSOFT_GRAPH_MAILBOX_USER_ID", "Outlook draft creation and mailbox sync target"),
  ];
}

export function acceptedGraphEnvironmentAliases() {
  const config = getGraphAuthConfig();
  return {
    MICROSOFT_GRAPH_TENANT_ID: config.tenantEnvNames,
    MICROSOFT_GRAPH_CLIENT_ID: config.clientIdEnvNames,
    MICROSOFT_GRAPH_CLIENT_SECRET: config.clientSecretEnvNames,
    MICROSOFT_GRAPH_MAILBOX_USER_ID: config.mailboxEnvNames,
  };
}
