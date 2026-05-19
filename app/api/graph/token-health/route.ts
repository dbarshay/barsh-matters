import { NextResponse } from "next/server";
import {
  acceptedGraphEnvironmentAliases,
  getGraphAuthConfig,
  getGraphAuthReadiness,
  requiredGraphEnvironment,
} from "@/lib/graph/config";
import { buildMicrosoftGraphTokenEndpoint } from "@/lib/graph/token";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getGraphAuthConfig();
  const readiness = getGraphAuthReadiness(config);

  return NextResponse.json({
    action: "graph-token-health",
    readOnly: true,
    previewOnly: true,
    graphCallsMade: false,
    tokenRequested: false,
    accessTokenReturned: false,
    createsOutlookDraft: false,
    sendsEmail: false,
    readsMailbox: false,
    syncsMailbox: false,
    clioRecordsChanged: false,
    databaseRecordsChanged: false,
    readiness,
    requiredEnvironment: requiredGraphEnvironment(),
    aliasesAccepted: acceptedGraphEnvironmentAliases(),
    tokenPlan: {
      grantType: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
      tokenEndpointReady: readiness.tenantConfigured,
      tokenEndpointPreview: readiness.tenantConfigured
        ? buildMicrosoftGraphTokenEndpoint(config.tenantId)
        : null,
      appOnlyTokenConfigReady: readiness.appOnlyTokenConfigReady,
    },
    nextSteps: [
      "Register or confirm the Azure app registration.",
      "Grant Microsoft Graph application permissions for Mail.Read, Mail.ReadWrite, and Mail.Send if app-only mailbox access is approved.",
      "Add MICROSOFT_GRAPH_TENANT_ID, MICROSOFT_GRAPH_CLIENT_ID, MICROSOFT_GRAPH_CLIENT_SECRET, and MICROSOFT_GRAPH_MAILBOX_USER_ID to local and Vercel environments.",
      "Run a separate explicit live token test route only after environment variables and Microsoft admin consent are confirmed.",
    ],
    note:
      "Read-only token readiness check.  This route does not request an access token and never returns client secret values.",
  });
}
