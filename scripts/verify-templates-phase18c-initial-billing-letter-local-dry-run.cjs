const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const fixture = JSON.parse(fs.readFileSync("test/fixtures/templates/templates-phase18c-initial-billing-letter-local-dry-run-fixtures.json", "utf8"));

function fail(message) {
  throw new Error(message);
}

function parseEnvFile(file) {
  const out = {};
  if (fs.existsSync(file) === false) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value.startsWith("\"") && value.endsWith("\"")) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

function builtPostgresUrl(env) {
  const user = env.POSTGRES_PGUSER || env.POSTGRES_USER;
  const password = env.POSTGRES_PGPASSWORD || env.POSTGRES_PASSWORD;
  const host = env.POSTGRES_PGHOST_UNPOOLED || env.POSTGRES_PGHOST || env.POSTGRES_HOST;
  const database = env.POSTGRES_PGDATABASE || env.POSTGRES_DATABASE;
  if (!user || !password || !host || !database) return "";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/${encodeURIComponent(database)}?sslmode=require`;
}

function pickConnection() {
  const local = parseEnvFile(".env.local");
  const env = parseEnvFile(".env");
  const merged = { ...env, ...local, ...process.env };
  const candidates = [process.env.DATABASE_URL, local.DATABASE_URL, env.DATABASE_URL, process.env.POSTGRES_URL, local.POSTGRES_URL, builtPostgresUrl(merged)].filter((v) => String(v || "").trim());
  if (candidates.length < 1) fail("No database connection string available for read-only dry-run.");
  return candidates[0];
}

function money(value) {
  const n = Number(value || 0);
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yy = String(d.getUTCFullYear());
  return `${mm}/${dd}/${yy}`;
}

function scanLegacyTokens(text) {
  const out = [];
  let offset = 0;
  while (true) {
    const start = text.indexOf("<<", offset);
    if (start < 0) break;
    const end = text.indexOf(">>", start + 2);
    if (end < 0) break;
    out.push(text.slice(start, end + 2));
    offset = end + 2;
  }
  return Array.from(new Set(out)).sort();
}

function insurerMailingAddress(details) {
  const hidden = details && details._hiddenImportFields ? details._hiddenImportFields : {};
  const street = String(hidden.hidden_street || "").trim();
  const city = String(hidden.hidden_city || "").trim();
  const state = String(hidden.hidden_state || "").trim();
  const zip = String(hidden.hidden_zipcode || "").trim();
  const second = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [street, second].filter(Boolean).join("\n");
}

async function main() {
  const connectionString = pickConnection();
  const client = new Client({ connectionString, ssl: connectionString.includes("sslmode=require") ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  const claim = await client.query("select * from public.\"ClaimIndex\" where display_number = $1 limit 1", [fixture.testMatterFileNumber]);
  if (claim.rows.length !== 1) fail("Expected exactly one ClaimIndex row for " + fixture.testMatterFileNumber);
  const row = claim.rows[0];
  const insurer = await client.query("select id, type, \"displayName\", \"normalizedName\", details from public.\"ReferenceEntity\" where type = $1 and \"normalizedName\" = lower($2) limit 1", [fixture.insurerReferenceType, row.insurer_name]);
  await client.end();
  if (insurer.rows.length !== 1) fail("Expected exactly one insurer ReferenceEntity row for " + row.insurer_name);
  const insurerRow = insurer.rows[0];
  const values = {
    "letter.date": formatDate(new Date()),
    "insurer.name": String(insurerRow.displayName || row.insurer_name || ""),
    "insurer.mailingAddress": insurerMailingAddress(insurerRow.details),
    "provider.name": String(row.provider_name || row.client_name || ""),
    "patient.name": String(row.patient_name || ""),
    "claim.number": String(row.claim_number_raw || row.claim_number_normalized || ""),
    "claim.amount": money(row.claim_amount),
    "claim.dosRange": row.dos_start && row.dos_end && String(row.dos_start).slice(0, 10) !== String(row.dos_end).slice(0, 10) ? `${formatDate(row.dos_start)} - ${formatDate(row.dos_end)}` : formatDate(row.dos_start || row.dos_end),
    "matter.fileNumber": String(row.display_number || "")
  };
  for (const [token, expected] of Object.entries(fixture.expectedResolvedValues)) {
    if (values[token] !== expected) fail(`${token} expected ${JSON.stringify(expected)} but received ${JSON.stringify(values[token])}`);
  }
  if (fs.existsSync(fixture.committedDocxPath) === false) fail("Committed DOCX missing.");
  const proof = [
    "Initial Billing Letter local dry-run proof",
    `Template: ${fixture.templateId}`,
    `Matter: ${values["matter.fileNumber"]}`,
    `Date: ${values["letter.date"]}`,
    `Insurer: ${values["insurer.name"]}`,
    `Insurer mailing address:`,
    values["insurer.mailingAddress"],
    `Provider: ${values["provider.name"]}`,
    `Patient: ${values["patient.name"]}`,
    `Claim No.: ${values["claim.number"]}`,
    `Amount: ${values["claim.amount"]}`,
    `Date of Service: ${values["claim.dosRange"]}`,
    `Our File Number: ${values["matter.fileNumber"]}`
  ].join("\n");
  const legacyTokens = scanLegacyTokens(proof);
  if (legacyTokens.length > 0) fail("Dry-run proof still contains legacy tokens: " + legacyTokens.join(", "));
  for (const value of Object.values(fixture.expectedResolvedValues)) {
    if (proof.includes(value) === false) fail("Dry-run proof missing expected value " + value);
  }
  fs.rmSync(fixture.localOutputDirectory, { recursive: true, force: true });
  fs.mkdirSync(fixture.localOutputDirectory, { recursive: true });
  const outputPath = path.join(fixture.localOutputDirectory, "initial-billing-letter-BRL_202600003-proof.txt");
  fs.writeFileSync(outputPath, proof + "\n");
  console.log("DRY_RUN_OUTPUT=" + outputPath);
  console.log("INSURER_ADDRESS_SOURCE=" + fixture.insurerAddressSource);
  console.log("PASS: Templates Phase 18C Initial Billing Letter local dry-run verified for BRL_202600003");
}

main().catch((error) => {
  console.error("FAIL: Templates Phase 18C Initial Billing Letter local dry-run failed");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
