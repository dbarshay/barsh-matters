import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type GraphEnvStatus = {
  name: string;
  configured: boolean;
  requiredFor: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function configured(name: string): boolean {
  return clean(process.env[name]).length > 0;
}

function envStatus(name: string, requiredFor: string): GraphEnvStatus {
  return {
    name,
    configured: configured(name),
    requiredFor,
  };
}

function firstConfigured(names: string[]): string | null {
  return names.find((name) => configured(name)) || null;
}

export async function GET() {
  const tenantEnvNames = ["MICROSOFT_GRAPH_TENANT_ID", "AZURE_TENANT_ID"];
  const clientIdEnvNames = ["MICROSOFT_GRAPH_CLIENT_ID", "AZURE_CLIENT_ID"];
  const clientSecretEnvNames = ["MICROSOFT_GRAPH_CLIENT_SECRET", "AZURE_CLIENT_SECRET"];
  const mailboxEnvNames = ["MICROSOFT_GRAPH_MAILBOX_USER_ID", "MICROSOFT_GRAPH_DEFAULT_MAILBOX", "OUTLOOK_DEFAULT_MAILBOX"];

  const tenantConfiguredAs = firstConfigured(tenantEnvNames);
  const clientIdConfiguredAs = firstConfigured(clientIdEnvNames);
  const clientSecretConfiguredAs = firstConfigured(clientSecretEnvNames);
  const mailboxConfiguredAs = firstConfigured(mailboxEnvNames);

  const appOnlyReady = Boolean(tenantConfiguredAs && clientIdConfiguredAs && clientSecretConfiguredAs);
  const mailboxReady = Boolean(mailboxConfiguredAs);

  return NextResponse.json({
    action: "graph-config-health",
    readOnly: true,
    previewOnly: true,
    graphCallsMade: false,
    createsOutlookDraft: false,
    sendsEmail: false,
    readsMailbox: false,
    syncsMailbox: false,
    clioRecordsChanged: false,
    databaseRecordsChanged: false,
    env: {
      tenant: {
        configured: Boolean(tenantConfiguredAs),
        configuredAs: tenantConfiguredAs,
        acceptedNames: tenantEnvNames,
      },
      clientId: {
        configured: Boolean(clientIdConfiguredAs),
        configuredAs: clientIdConfiguredAs,
        acceptedNames: clientIdEnvNames,
      },
      clientSecret: {
        configured: Boolean(clientSecretConfiguredAs),
        configuredAs: clientSecretConfiguredAs,
        acceptedNames: clientSecretEnvNames,
      },
      mailbox: {
        configured: Boolean(mailboxConfiguredAs),
        configuredAs: mailboxConfiguredAs,
        acceptedNames: mailboxEnvNames,
      },
    },
    requiredEnvironment: [
      envStatus("MICROSOFT_GRAPH_TENANT_ID", "Microsoft Graph app-only token acquisition"),
      envStatus("MICROSOFT_GRAPH_CLIENT_ID", "Microsoft Graph app-only token acquisition"),
      envStatus("MICROSOFT_GRAPH_CLIENT_SECRET", "Microsoft Graph app-only token acquisition"),
      envStatus("MICROSOFT_GRAPH_MAILBOX_USER_ID", "Outlook draft creation and mailbox sync target"),
    ],
    aliasesAccepted: {
      MICROSOFT_GRAPH_TENANT_ID: tenantEnvNames,
      MICROSOFT_GRAPH_CLIENT_ID: clientIdEnvNames,
      MICROSOFT_GRAPH_CLIENT_SECRET: clientSecretEnvNames,
      MICROSOFT_GRAPH_MAILBOX_USER_ID: mailboxEnvNames,
    },
    readiness: {
      appOnlyTokenConfigReady: appOnlyReady,
      mailboxTargetReady: mailboxReady,
      readyForFutureDraftCreation: appOnlyReady && mailboxReady,
      readyForFutureReadOnlySync: appOnlyReady && mailboxReady,
    },
    plannedGraphScopes: [
      "Mail.Read",
      "Mail.ReadWrite",
      "Mail.Send",
      "offline_access if delegated auth is later added",
    ],
    plannedMatterLinkingKeys: [
      "graphMessageId",
      "internetMessageId",
      "conversationId",
      "matterId",
      "matterDisplayNumber",
      "masterLawsuitId",
      "clioMatterId",
      "clioDisplayNumber",
      "clioMaildropEmail",
    ],
    note:
      "Read-only Graph configuration health check.  This route reports whether required environment variable names are present, but it never returns secret values and does not call Microsoft Graph.",
  });
}
