// Single source of truth for resolving the Postgres connection URL.
//
// WHY THIS EXISTS (permanent fix for "password authentication failed for user 'neondb_owner'"):
// The Neon–Vercel integration keeps its component vars (POSTGRES_PGUSER / POSTGRES_PGPASSWORD /
// POSTGRES_PGHOST[_UNPOOLED] / POSTGRES_PGDATABASE) in sync on every password rotation. Hand-maintained
// full-URL vars (DATABASE_URL, POSTGRES_DATABASE_URL_UNPOOLED, ...) do NOT auto-refresh, so after a Neon
// password rotation they silently go stale and the app fails auth. On Vercel we therefore BUILD the URL
// from the integration-managed components (unpooled host, TLS required) so rotations propagate
// automatically and never need a manual env edit again. Locally, an explicitly configured full URL wins
// so existing dev setups (.env.local) are unaffected.
//
// Mirrors the `builtPostgresUrl` pattern already used across scripts/ (kept identical on purpose).

function builtPostgresUrl(
  user?: string,
  password?: string,
  host?: string,
  database?: string
): string | null {
  if (!user || !password || !host || !database) return null;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/${encodeURIComponent(
    database
  )}?sslmode=require`;
}

// Build from Neon-integration-managed components. Prefer the UNPOOLED host (the app uses its own pg Pool
// and the codebase deliberately connects unpooled), then the pooled host, then the generic POSTGRES_* set.
function integrationBuiltUrl(): string | null {
  const e = process.env;
  return (
    builtPostgresUrl(e.POSTGRES_PGUSER, e.POSTGRES_PGPASSWORD, e.POSTGRES_PGHOST_UNPOOLED, e.POSTGRES_PGDATABASE) ||
    builtPostgresUrl(e.POSTGRES_PGUSER, e.POSTGRES_PGPASSWORD, e.POSTGRES_PGHOST, e.POSTGRES_PGDATABASE) ||
    builtPostgresUrl(e.POSTGRES_USER, e.POSTGRES_PASSWORD, e.POSTGRES_HOST, e.POSTGRES_DATABASE)
  );
}

// Explicitly configured full connection URLs (preserves the previous precedence for local/dev).
function explicitUrl(): string | undefined {
  return (
    process.env.POSTGRES_DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    undefined
  );
}

/**
 * Resolve the Postgres connection string.
 *
 * DATABASE_URL FIRST, everywhere. The Neon–Vercel integration does NOT reliably propagate password
 * rotations to its managed POSTGRES_* vars (confirmed: after a rotation the integration vars stayed
 * stale on Vercel while only DATABASE_URL, set manually, was current). So we no longer depend on the
 * integration vars — DATABASE_URL is maintained by hand in Vercel + .env.local and updated on the rare
 * rotation. The integration-built URL and other explicit URLs remain as last-resort fallbacks.
 */
export function resolveDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || integrationBuiltUrl() || explicitUrl() || undefined;
}
