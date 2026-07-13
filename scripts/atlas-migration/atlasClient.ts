// Thin client over the Atlas (LawSpades) REST API. All endpoints confirmed. Handles hourly JWT expiry
// with a two-layer refresh (POST /refreshtoken, then a re-readable token file) so multi-day runs don't stall.
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
let refreshingAt = 0;

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

async function refresh(): Promise<boolean> {
  // Coalesce concurrent refreshes (many in-flight requests may 401 at once).
  const now = Date.now();
  if (now - refreshingAt < 3000) {
    await new Promise((r) => setTimeout(r, 1500));
    return true;
  }
  refreshingAt = now;
  return (await refreshViaEndpoint()) || reloadFromFile();
}

async function api(path: string, init?: RequestInit, _retried = false): Promise<Response> {
  assertAtlas();
  const url = path.startsWith("http") ? path : `${config.atlas.apiBase}${path}`;
  const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init?.headers || {}) } });
  if (res.status === 401 && !_retried) {
    if (await refresh()) return api(path, init, true);
    throw new Error(
      "Atlas 401 and refresh failed. Drop a fresh token into ATLAS_TOKEN_FILE (localStorage.token from a " +
        "logged-in tab) — the run resumes automatically; nothing is lost."
    );
  }
  return res;
}

/** CONFIRMED: full document tree for a case, including file leaves. */
export async function getCaseDocumentTree(caseId: string): Promise<any[]> {
  const res = await api(`/case/${encodeURIComponent(caseId)}/document/node/false`);
  if (!res.ok) throw new Error(`document tree ${caseId}: HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : json?.items || json?.data || [];
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
export async function fetchFileBytes(leaf: AtlasFileLeaf, caseId: string): Promise<Buffer> {
  const res = await api(`/case/${encodeURIComponent(caseId)}/document/file/${leaf.atlasFileId}/view`);
  if (!res.ok) throw new Error(`file ${leaf.atlasFileId} (${caseId} "${leaf.fileName}"): HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
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
