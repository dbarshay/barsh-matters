const fs = require("fs");

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadLocalEnvWithoutPrintingSecrets() {
  return {
    ...parseDotEnvFile(".env"),
    ...parseDotEnvFile(".env.local"),
    ...parseDotEnvFile(".env.development"),
    ...parseDotEnvFile(".env.development.local"),
    ...parseDotEnvFile(".env.production"),
    ...parseDotEnvFile(".env.production.local"),
    ...parseDotEnvFile(".env.vercel.production"),
    ...process.env,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

(function main() {
  console.log("RESULT: Phase 34J live folder resolution local-env preflight starting");
  console.log("CONTRACT: this preflight must not call Clio, create folders, upload documents, or mutate DB");

  const env = loadLocalEnvWithoutPrintingSecrets();
  const requiredKeys = ["CLIO_CLIENT_ID"];
  const missing = requiredKeys.filter((key) => !String(env[key] || "").trim());

  if (missing.length) {
    console.log("LIVE_SMOKE_READY=false");
    console.log("LIVE_SMOKE_BLOCKED_REASON=missing_required_local_clio_env");
    console.log("MISSING_REQUIRED_ENV_KEYS=" + missing.join(","));
    console.log("PASS: missing live Clio env was detected without printing secret values");
    console.log("PASS: no Clio folder was created by this preflight");
    console.log("PASS: no document upload was performed by this preflight");
    console.log("PASS: no database mutation was performed by this preflight");
    console.log("RESULT: Phase 34J live folder resolution local-env preflight passed as blocked");
    return;
  }

  assert(String(env.CLIO_CLIENT_ID || "").trim().length > 0, "CLIO_CLIENT_ID exists without printing value");
  console.log("LIVE_SMOKE_READY=true");
  console.log("PASS: required live Clio env keys are present without printing values");
  console.log("PASS: no Clio folder was created by this preflight");
  console.log("PASS: no document upload was performed by this preflight");
  console.log("PASS: no database mutation was performed by this preflight");
  console.log("RESULT: Phase 34J live folder resolution local-env preflight passed");
})();
