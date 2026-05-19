import fs from "node:fs";

let failures = 0;

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    console.error(`Missing file: ${path}`);
    failures += 1;
    return "";
  }
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL ${label}: missing ${JSON.stringify(needle)}`);
    failures += 1;
  }
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) {
    console.error(`FAIL ${label}: forbidden ${JSON.stringify(needle)}`);
    failures += 1;
  }
}

const configPath = "lib/graph/config.ts";
const tokenPath = "lib/graph/token.ts";
const configRoutePath = "app/api/graph/config-health/route.ts";
const tokenRoutePath = "app/api/graph/token-health/route.ts";
const packagePath = "package.json";

const config = read(configPath);
const token = read(tokenPath);
const configRoute = read(configRoutePath);
const tokenRoute = read(tokenRoutePath);
const packageJson = read(packagePath);

console.log("=== GRAPH TOKEN FOUNDATION SAFETY VERIFICATION ===");

mustContain(configPath, config, "getGraphAuthConfig");
mustContain(configPath, config, "getGraphAuthReadiness");
mustContain(configPath, config, "MICROSOFT_GRAPH_TENANT_ID");
mustContain(configPath, config, "MICROSOFT_GRAPH_CLIENT_ID");
mustContain(configPath, config, "MICROSOFT_GRAPH_CLIENT_SECRET");
mustContain(configPath, config, "MICROSOFT_GRAPH_MAILBOX_USER_ID");

mustContain(tokenPath, token, "requestMicrosoftGraphAppToken");
mustContain(tokenPath, token, "buildMicrosoftGraphTokenEndpoint");
mustContain(tokenPath, token, "buildMicrosoftGraphClientCredentialsBody");
mustContain(tokenPath, token, "https://login.microsoftonline.com/");
mustContain(tokenPath, token, "https://graph.microsoft.com/.default");
mustContain(tokenPath, token, "client_credentials");
mustContain(tokenPath, token, "cache: \"no-store\"");
mustContain(tokenPath, token, "redactSecretForError");

mustContain(configRoutePath, configRoute, 'action: "graph-config-health"');
mustContain(configRoutePath, configRoute, "getGraphAuthReadiness");
mustContain(configRoutePath, configRoute, "graphCallsMade: false");
mustContain(configRoutePath, configRoute, "createsOutlookDraft: false");
mustContain(configRoutePath, configRoute, "sendsEmail: false");
mustContain(configRoutePath, configRoute, "readsMailbox: false");
mustContain(configRoutePath, configRoute, "syncsMailbox: false");

mustContain(tokenRoutePath, tokenRoute, 'action: "graph-token-health"');
mustContain(tokenRoutePath, tokenRoute, "readOnly: true");
mustContain(tokenRoutePath, tokenRoute, "previewOnly: true");
mustContain(tokenRoutePath, tokenRoute, "graphCallsMade: false");
mustContain(tokenRoutePath, tokenRoute, "tokenRequested: false");
mustContain(tokenRoutePath, tokenRoute, "accessTokenReturned: false");
mustContain(tokenRoutePath, tokenRoute, "createsOutlookDraft: false");
mustContain(tokenRoutePath, tokenRoute, "sendsEmail: false");
mustContain(tokenRoutePath, tokenRoute, "readsMailbox: false");
mustContain(tokenRoutePath, tokenRoute, "syncsMailbox: false");
mustContain(tokenRoutePath, tokenRoute, "clioRecordsChanged: false");
mustContain(tokenRoutePath, tokenRoute, "databaseRecordsChanged: false");
mustContain(tokenRoutePath, tokenRoute, "buildMicrosoftGraphTokenEndpoint");

mustNotContain(configRoutePath, configRoute, "fetch(");
mustNotContain(tokenRoutePath, tokenRoute, "fetch(");
mustNotContain(tokenRoutePath, tokenRoute, "requestMicrosoftGraphAppToken(");
mustNotContain(tokenRoutePath, tokenRoute, "prisma.");
mustNotContain(tokenRoutePath, tokenRoute, "clioFetch(");
mustNotContain(tokenRoutePath, tokenRoute, "sendMail");
mustNotContain(tokenRoutePath, tokenRoute, "/sendMail");
mustNotContain(tokenRoutePath, tokenRoute, "messages/");
mustNotContain(tokenRoutePath, tokenRoute, "createUploadSession");
mustNotContain(tokenRoutePath, tokenRoute, "export async function POST");
mustNotContain(tokenRoutePath, tokenRoute, "export async function PATCH");
mustNotContain(tokenRoutePath, tokenRoute, "export async function DELETE");

if (packageJson.includes('"verify:graph-token-foundation-safety"')) {
  console.log("PASS package.json exposes verify:graph-token-foundation-safety script.");
} else {
  console.error("FAIL package.json missing verify:graph-token-foundation-safety script.");
  failures += 1;
}

if (failures > 0) {
  console.error(`=== GRAPH TOKEN FOUNDATION SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== GRAPH TOKEN FOUNDATION SAFETY PASSED ===");
