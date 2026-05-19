import { NextResponse } from "next/server";
import {
  acceptedGraphEnvironmentAliases,
  getGraphAuthConfig,
  getGraphAuthReadiness,
  requiredGraphEnvironment,
} from "@/lib/graph/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getGraphAuthConfig();
  const readiness = getGraphAuthReadiness(config);

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
        configured: readiness.tenantConfigured,
        configuredAs: readiness.tenantConfiguredAs,
        acceptedNames: config.tenantEnvNames,
      },
      clientId: {
        configured: readiness.clientIdConfigured,
        configuredAs: readiness.clientIdConfiguredAs,
        acceptedNames: config.clientIdEnvNames,
      },
      clientSecret: {
        configured: readiness.clientSecretConfigured,
        configuredAs: readiness.clientSecretConfiguredAs,
        acceptedNames: config.clientSecretEnvNames,
      },
      mailbox: {
        configured: readiness.mailboxConfigured,
        configuredAs: readiness.mailboxConfiguredAs,
        acceptedNames: config.mailboxEnvNames,
      },
    },
    requiredEnvironment: requiredGraphEnvironment(),
    aliasesAccepted: acceptedGraphEnvironmentAliases(),
    readiness,
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
