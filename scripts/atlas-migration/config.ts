// Env-driven config for the Atlas→Azure migration. Loads .env.local / .env (repo root) so it shares the
// same DATABASE_URL as the app; Atlas + Azure creds are migration-specific and added to that env.
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  for (const filename of [".env.development.local", ".env.local", ".env", "scripts/atlas-migration/.env"]) {
    const fp = resolve(process.cwd(), filename);
    if (!existsSync(fp)) continue;
    for (const line of readFileSync(fp, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}
loadEnv();

const bool = (v: string | undefined) => v === "1" || v === "true";
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const config = {
  atlas: {
    apiBase: process.env.ATLAS_API_BASE || "https://api.lawspades.com/AtlasAPI/api",
    token: process.env.ATLAS_TOKEN || "",
    refreshToken: process.env.ATLAS_REFRESH_TOKEN || "",
    // Auto-refresh via OAuth2 (IdentityServer). On 401 the client POSTs an OAuth2 refresh_token grant to
    // this token endpoint; the response's access_token becomes the new JWT and the (rotated) refresh_token
    // is persisted to refreshTokenFile so it survives restarts.
    tokenEndpoint: process.env.ATLAS_TOKEN_ENDPOINT || "https://identity.greenbills.health/core/connect/token",
    clientId: process.env.ATLAS_CLIENT_ID || "ATLAS",
    clientSecret: process.env.ATLAS_CLIENT_SECRET || "", // only if ATLAS is a confidential client
    // Persists the rotating refresh token across restarts (defaults next to the .env).
    refreshTokenFile: process.env.ATLAS_REFRESH_TOKEN_FILE || "scripts/atlas-migration/.refresh-token",
    // Last-resort fallback: a file the client re-reads on 401. Drop a fresh JWT here mid-run (no restart).
    tokenFile: process.env.ATLAS_TOKEN_FILE || "",
  },
  azure: {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || "",
    container: process.env.AZURE_BLOB_CONTAINER || "atlas-legacy-docs",
    accessTier: (process.env.AZURE_ACCESS_TIER || "Cool") as "Hot" | "Cool" | "Cold",
  },
  ledger: {
    databaseUrl:
      process.env.MIGRATION_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_DATABASE_URL_UNPOOLED ||
      "",
  },
  run: {
    caseConcurrency: num(process.env.CASE_CONCURRENCY, 4),
    fileConcurrency: num(process.env.FILE_CONCURRENCY, 6),
    dryRun: bool(process.env.DRY_RUN),
    limitCases: num(process.env.LIMIT_CASES, 0),
    newestFirst: !bool(process.env.OLDEST_FIRST), // default newest-first (open matters lead)
  },
};

export function assertAtlas() {
  if (!config.atlas.token) throw new Error("ATLAS_TOKEN is required (paste a fresh JWT from localStorage.token).");
}
export function assertAzure() {
  if (config.run.dryRun) return;
  if (!config.azure.connectionString) throw new Error("AZURE_STORAGE_CONNECTION_STRING is required (or set DRY_RUN=1).");
}
export function assertLedger() {
  if (!config.ledger.databaseUrl) throw new Error("No Postgres URL for the manifest (MIGRATION_DATABASE_URL / DATABASE_URL).");
}
