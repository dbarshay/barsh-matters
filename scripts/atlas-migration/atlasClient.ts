// Thin client over the Atlas (LawSpades) REST API. All endpoints confirmed. Handles 4-hour JWT expiry with a
// two-layer refresh (OAuth2 refresh_token grant, then a re-readable token file) so multi-day runs don't
// stall — with SINGLE-FLIGHT refresh, because the refresh token rotates and concurrent refreshes would
// invalidate each other. Also backs off on 429/5xx-overload, which is what higher concurrency provokes.
import { existsSync, readFileSync, writeFileSync } from "fs";
import { config, assertAtlas } from "./config";

export type AtlasFileLeaf = {
  atlasFileId: number; // node leaf id (== ImageId)
  fileName: string;
  folderPath: string; // e.g. "BILLS" or "COURTS/NOTICE OF ENTRY"
};

// Mutable in-memory creds (start from env, updated by refresh).
let currentToken = config.atlas.token;
let currentRefresh = config.atlas.refreshToken;

// Single-flight refresh state. The Atlas refresh token ROTATES (each one is single-use), so two concurrent
// refreshes are actively destructive: the first invalidates the token the second is holding, and we can end
// up persisting a dead token — breaking auth for the whole run, not just one file. At the 4-hour expiry
// every in-flight worker 401s at the same instant (up to CASE_CONCURRENCY * FILE_CONCURRENCY of them), so
// this must be exact, not best-effort.
//
//   tokenGen        — bumped on every successful refresh. A request that 401'd with an OLD generation
//                     doesn't need a refresh at all; someone else already got a new token, so just retry.
//   refreshInFlight — the ONE in-flight refresh promise. Everyone else awaits it instead of starting theirs.
let tokenGen = 0;
let refreshInFlight: Promise<boolean> | null = null;

// Prefer a persisted (rotated) refresh token over the .env one, so restarts continue the chain.
if (config.atlas.refreshTokenFile && existsSync(config.atlas.refreshTokenFile)) {
  try {
    const rt = readFileSync(config.atlas.refreshTokenFile, "utf8").trim();
    if (rt) currentRefresh = rt;
  } catch {
    /* ignore */
  }
}

function persistRefresh(rt: string) {
  try {
    if (config.atlas.refreshTokenFile) writeFileSync(config.atlas.refreshTokenFile, rt, "utf8");
  } catch {
    /* non-fatal */
  }
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${currentToken}`, Accept: "application/json" };
}

/** Layer 1: OAuth2 refresh_token grant against the IdentityServer token endpoint. Rotates the refresh
 *  token (IdentityServer issues a new one each time) and persists it so multi-day/restart runs continue. */
async function refreshViaEndpoint(): Promise<boolean> {
  if (!currentRefresh) return false;
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: currentRefresh,
      client_id: config.atlas.clientId,
    });
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    if (config.atlas.clientSecret) {
      headers.Authorization = "Basic " + Buffer.from(`${config.atlas.clientId}:${config.atlas.clientSecret}`).toString("base64");
    }
    const res = await fetch(config.atlas.tokenEndpoint, { method: "POST", headers, body });
    if (!res.ok) return false;
    const j: any = await res.json().catch(() => null);
    if (j?.access_token) {
      currentToken = j.access_token;
      if (j.refresh_token) {
        currentRefresh = j.refresh_token;
        persistRefresh(currentRefresh);
      }
      console.log(`[auth] refreshed JWT via OAuth2 (expires_in ${j.expires_in}s)`);
      return true;
    }
  } catch {
    /* fall through to file */
  }
  return false;
}

/** Layer 2: re-read the token from a file the operator can update mid-run (raw JWT or {token,refreshtoken}). */
function reloadFromFile(): boolean {
  if (!config.atlas.tokenFile || !existsSync(config.atlas.tokenFile)) return false;
  try {
    const raw = readFileSync(config.atlas.tokenFile, "utf8").trim();
    let t = raw;
    if (raw.startsWith("{")) {
      const j = JSON.parse(raw);
      t = j.token || j.access_token || "";
      if (j.refreshtoken) currentRefresh = j.refreshtoken;
    }
    if (t && t !== currentToken) {
      currentToken = t;
      console.log("[auth] loaded a fresh token from ATLAS_TOKEN_FILE");
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Single-flight token refresh.
 *
 * `seenGen` is the token generation the caller USED for the request that 401'd. If the generation has since
 * moved on, another worker already refreshed while our request was in flight — there is nothing to do but
 * retry with the new token. Otherwise exactly one caller performs the refresh and every other caller awaits
 * that same promise. This is what makes a rotating refresh token safe under concurrency: one POST, one
 * rotation, one persisted token.
 */
async function refresh(seenGen: number): Promise<boolean> {
  if (tokenGen !== seenGen) return true; // somebody else already refreshed — just retry with the new token
  if (refreshInFlight) return refreshInFlight; // a refresh is running — join it rather than racing it
  refreshInFlight = (async () => {
    try {
      const ok = (await refreshViaEndpoint()) || reloadFromFile();
      if (ok) tokenGen++; // publish the new token to everyone waiting/arriving
      return ok;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Transient-failure retries. Raising concurrency provokes exactly these: 429 (rate limited) and 502/503/504
 * (server overloaded). They are NOT permanent — backing off and retrying usually succeeds, and doing so here
 * is far cheaper than failing the doc and recovering it in a whole separate --retry-errors pass.
 * NOTE: a plain 500 is deliberately NOT retried here — for Atlas that usually means an unservable file
 * (broken cross-org reference), so retrying in-line would just burn time. Those go to the ledger.
 */
const RETRYABLE = new Set([429, 502, 503, 504]);
const MAX_TRANSIENT_RETRIES = Number(process.env.HTTP_RETRIES || 3);

async function api(path: string, init?: RequestInit, _retried = false, _attempt = 0): Promise<Response> {
  assertAtlas();
  const url = path.startsWith("http") ? path : `${config.atlas.apiBase}${path}`;
  const gen = tokenGen; // capture BEFORE the request, so we can tell whether a refresh happened meanwhile

  // NETWORK-level failures ("fetch failed" / ECONNRESET / socket timeout) throw rather than return a status.
  // Under high concurrency a slow Atlas causes these transiently — retry with backoff instead of failing the
  // doc and (worse) letting a burst of them trip the stall detector and halt the whole run.
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init?.headers || {}) } });
  } catch (e: any) {
    if (_attempt < MAX_TRANSIENT_RETRIES) {
      await sleep(2 ** _attempt * 1000 + Math.random() * 500);
      return api(path, init, _retried, _attempt + 1);
    }
    throw e;
  }

  if (res.status === 401 && !_retried) {
    if (await refresh(gen)) return api(path, init, true, _attempt);
    throw new Error(
      "Atlas 401 and refresh failed. Drop a fresh token into ATLAS_TOKEN_FILE (localStorage.token from a " +
        "logged-in tab) — the run resumes automatically; nothing is lost."
    );
  }

  if (RETRYABLE.has(res.status) && _attempt < MAX_TRANSIENT_RETRIES) {
    // Honor Retry-After when the server sends it; otherwise exponential backoff with jitter.
    const ra = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2 ** _attempt * 1000 + Math.random() * 500;
    await sleep(wait);
    return api(path, init, _retried, _attempt + 1);
  }

  return res;
}

// One-shot diagnostic: dump the RAW tree JSON so we can see exactly which metadata Atlas gives us per file.
// The question we're answering: does a file node carry a CONTENT HASH / checksum (an identity signal — safe
// to dedup on, like atlas_file_id) or merely a size (a coincidence signal — NOT safe: two different bills
// for the same patient, same template, same byte count would silently misfile onto the wrong claim).
// Enable with ATLAS_DEBUG_TREE=1. Uses the running process's own auth — no extra Atlas login, so it cannot
// rotate the refresh token out from under the sweep.
let dumpedTree = 0;

/** CONFIRMED: full document tree for a case, including file leaves. */
export async function getCaseDocumentTree(caseId: string): Promise<any[]> {
  const res = await api(`/case/${encodeURIComponent(caseId)}/document/node/false`);
  if (!res.ok) throw new Error(`document tree ${caseId}: HTTP ${res.status}`);
  const json = await res.json();
  const tree = Array.isArray(json) ? json : json?.items || json?.data || [];

  if (process.env.ATLAS_DEBUG_TREE === "1" && dumpedTree < 3 && tree.length) {
    dumpedTree++;
    // Collect ALL file leaves in this case, so we can inspect candidate request-free discriminators
    // (friendly_name, created_date, created_by) — and, crucially, whether SAME-filename leaves within one
    // case carry DIFFERENT values for those fields (which is what a real content discriminator would do).
    const leaves: any[] = [];
    const collect = (nodes: any[]) => {
      for (const n of nodes || []) {
        const kids = Array.isArray(n?.items) ? n.items : [];
        if (!kids.length && (n?.id ?? n?.ImageId)) leaves.push(n);
        else collect(kids);
      }
    };
    collect(tree);
    console.log(`\n=== ATLAS_DEBUG_TREE (${dumpedTree}/3): case ${caseId} — ${leaves.length} file leaves ===`);
    if (leaves[0]) console.log("full first leaf:", JSON.stringify(leaves[0], null, 2));
    const pick = (n: any) => ({
      id: n.id ?? n.ImageId,
      name: n.name ?? n.text,
      friendly_name: n.friendly_name,
      created_date: n.created_date ?? n.created,
      created_by: n.created_by,
    });
    console.log("first up-to-12 leaves (identity-relevant fields):");
    console.table(leaves.slice(0, 12).map(pick));
    // Highlight same-NAME pairs: do their friendly_name/created_date differ? (a discriminator would)
    const byName: Record<string, any[]> = {};
    for (const n of leaves) (byName[String(n.name ?? n.text)] ||= []).push(n);
    const dupNames = Object.entries(byName).filter(([, v]) => v.length > 1).slice(0, 5);
    if (dupNames.length) {
      console.log("SAME-FILENAME groups in this case (the collision-relevant set):");
      for (const [name, group] of dupNames) {
        console.log(`  "${name}" ×${group.length}:`, group.map(pick).map((x) => ({ id: x.id, cdate: x.created_date, fname: x.friendly_name })));
      }
    } else {
      console.log("(no same-filename groups in this case)");
    }
    console.log("");
  }

  return tree;
}

const FILE_RE = /\.(pdf|docx?|xlsx?|tiff?|jpe?g|png|gif|msg|eml|txt|rtf)$/i;

/** Walk the tree → flat list of file leaves with their folder path. */
export function flattenFileLeaves(tree: any[]): AtlasFileLeaf[] {
  const out: AtlasFileLeaf[] = [];
  const walk = (nodes: any[], path: string[]) => {
    for (const n of nodes || []) {
      const name = String(n?.name ?? n?.text ?? "").trim();
      const isFile = n?.isLeaf === true || FILE_RE.test(name);
      const hasKids = Array.isArray(n?.items) && n.items.length > 0;
      if (isFile && !hasKids) {
        out.push({ atlasFileId: Number(n.id ?? n.ImageId), fileName: name, folderPath: path.join("/") });
      } else {
        walk(n?.items || [], name ? [...path, name] : path);
      }
    }
  };
  walk(tree, []);
  return out.filter((f) => Number.isFinite(f.atlasFileId) && f.fileName);
}

/**
 * CONFIRMED (from DevTools capture): the single-file download is a plain authenticated GET that streams the
 * raw bytes — `GET /case/{caseId}/document/file/{fileId}/view` → 200 with Content-Type (e.g. application/pdf)
 * and `Content-Disposition: attachment; filename=...`. No CORS preflight server-side (that was a
 * browser-only artifact of the custom Authorization header). `fileId` == the tree leaf's `id`/`ImageId`.
 */
let dumpedHeaders = 0;
export async function fetchFileBytes(leaf: AtlasFileLeaf, caseId: string): Promise<Buffer> {
  const res = await api(`/case/${encodeURIComponent(caseId)}/document/file/${leaf.atlasFileId}/view`);
  if (!res.ok) throw new Error(`file ${leaf.atlasFileId} (${caseId} "${leaf.fileName}"): HTTP ${res.status}`);

  // ATLAS_DEBUG_HEADERS=1: dump the response headers of the first few real downloads (ZERO extra Atlas
  // requests — these are downloads we're doing anyway). We're hunting for a server-provided CONTENT
  // fingerprint — Content-MD5, a content-derived ETag, or Content-Digest — that we could match BEFORE
  // pulling the body (via a cheap HEAD) to skip the 84% of downloads that are byte-dupes. Also prints the
  // SHA-256 of the body so we can eyeball whether any header actually tracks content (an ETag that changes
  // when the SHA does = content-derived = usable; one that doesn't = coincidence = unsafe).
  const buf = Buffer.from(await res.arrayBuffer());
  if (process.env.ATLAS_DEBUG_HEADERS === "1" && dumpedHeaders < 5) {
    dumpedHeaders++;
    const { createHash } = await import("crypto");
    const sha = createHash("sha256").update(buf).digest("hex");
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    console.log(`\n=== ATLAS_DEBUG_HEADERS (${dumpedHeaders}/5): file ${leaf.atlasFileId} "${leaf.fileName}" ===`);
    console.log("  bytes:", buf.length, "| sha256:", sha);
    console.log("  response headers:", JSON.stringify(headers, null, 2));
    console.log("  → want a header that tracks sha256 (Content-MD5 / content ETag / Content-Digest)\n");
  }
  return buf;
}

/**
 * Cheap metadata-only probe: HEAD the file endpoint (no body) to see whether Atlas supports HEAD at all and
 * what fingerprint headers it returns. Only used by --probe-head; NOT on the hot path.
 */
export async function headFile(atlasFileId: number, caseId: string): Promise<{ status: number; headers: Record<string, string> }> {
  const res = await api(`/case/${encodeURIComponent(caseId)}/document/file/${atlasFileId}/view`, { method: "HEAD" });
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));
  return { status: res.status, headers };
}


/**
 * Enumerate all Case_Ids (open + closed). Preferred source is a CSV you control; the Atlas search paging
 * below is a scaffold — confirm the request/response shape of `Case/simple_search` from a capture before
 * relying on it (BM's closed-only sheet does NOT include open matters).
 */
export async function enumerateCasesFromAtlas(pageSize = 500): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page < 100000; page++) {
    const res = await api(`/Case/simple_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, pageSize, searchText: "", filter: {} }), // TODO(capture): confirm shape
    });
    if (!res.ok) throw new Error(`Case/simple_search page ${page}: HTTP ${res.status}`);
    const json = await res.json();
    const rows: any[] = json?.data || json?.items || (Array.isArray(json) ? json : []);
    if (!rows.length) break;
    for (const r of rows) {
      const id = String(r?.case_id ?? r?.caseId ?? r?.CaseId ?? "").trim();
      if (id) ids.push(id);
    }
  }
  return Array.from(new Set(ids));
}
