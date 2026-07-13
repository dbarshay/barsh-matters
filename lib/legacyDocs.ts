// Server-side helpers for the "Legacy Docs" feature — reads the migration manifest, builds a per-matter
// folder tree, mints short-lived Azure SAS links, and logs access.
//
// LEDGER LOCATION: the manifest (legacy_case + legacy_document) lives in a DEDICATED database
// (LEGACY_DOCS_DATABASE_URL) that NOTHING else manages — the app's Neon DB was being wiped by the
// local-index backup/restore tooling (it restores the app DB from snapshots that don't contain these
// raw tables). Keeping the manifest in its own DB fully isolates it. If LEGACY_DOCS_DATABASE_URL is unset
// we fall back to the app DB (prisma). The ClaimIndex lookup (matter → Case_Id) always uses the app DB.
import { prisma } from "@/lib/prisma";
import { Pool } from "pg";

const AZURE_CONN = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const AZURE_CONTAINER = process.env.AZURE_BLOB_CONTAINER || "atlas-legacy-docs";
const SAS_TTL_MIN = Number(process.env.LEGACY_SAS_TTL_MIN || 15);
const LEDGER_URL = process.env.LEGACY_DOCS_DATABASE_URL || "";

export type LegacyDocFile = { id: string; fileName: string; byteSize: number | null };
export type LegacyDocFolder = { folder: string; files: LegacyDocFile[] };
export type LegacyDocTree = { caseId: string | null; folders: LegacyDocFolder[]; totalFiles: number };

// Dedicated pool for the manifest DB (reused across warm invocations). Falls back to the app DB.
let ledgerPool: Pool | null = null;
function ledger(): Pool | null {
  if (!LEDGER_URL) return null;
  if (!ledgerPool) ledgerPool = new Pool({ connectionString: LEDGER_URL, max: 3 });
  return ledgerPool;
}
async function ledgerQuery<T = any>(sql: string, params: any[]): Promise<T[]> {
  const pool = ledger();
  if (pool) return (await pool.query(sql, params)).rows as T[];
  return prisma.$queryRawUnsafe<T[]>(sql, ...params);
}
async function ledgerExec(sql: string, params: any[] = []): Promise<void> {
  const pool = ledger();
  if (pool) await pool.query(sql, params);
  else await prisma.$executeRawUnsafe(sql, ...params);
}

/** A matter's Atlas Case_Id is what we stored as old_matter_number. Resolve it (app DB), then its docs. */
export async function getLegacyDocTreeForMatter(matterId: number): Promise<LegacyDocTree> {
  const rows = await prisma.$queryRawUnsafe<{ old_matter_number: string | null }[]>(
    `SELECT old_matter_number FROM "ClaimIndex" WHERE matter_id = $1 LIMIT 1`,
    matterId
  );
  const caseId = rows[0]?.old_matter_number || null;
  if (!caseId) return { caseId: null, folders: [], totalFiles: 0 };
  return getLegacyDocTreeForCase(caseId);
}

/** Docs for a Case_Id, grouped by their original LawSpades folder (BILLS, MEDICAL REPORTS, …). */
export async function getLegacyDocTreeForCase(caseId: string): Promise<LegacyDocTree> {
  const docs = await ledgerQuery<{ id: string; folder_path: string | null; file_name: string; byte_size: string | null }>(
    `SELECT id::text AS id, folder_path, file_name, byte_size::text AS byte_size
       FROM legacy_document
      WHERE case_id = $1 AND status = 'stored'
      ORDER BY folder_path NULLS FIRST, file_name`,
    [caseId]
  );
  const byFolder = new Map<string, LegacyDocFile[]>();
  for (const d of docs) {
    let folder = d.folder_path || "";
    if (folder.startsWith(caseId + "/")) folder = folder.slice(caseId.length + 1);
    if (!folder) folder = "(Uncategorized)";
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder)!.push({
      id: d.id,
      fileName: d.file_name,
      byteSize: d.byte_size != null ? Number(d.byte_size) : null,
    });
  }
  const folders = Array.from(byFolder.entries())
    .map(([folder, files]) => ({ folder, files }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
  return { caseId, folders, totalFiles: docs.length };
}

/** Look up a single doc's blob key (for link generation). */
export async function getLegacyDoc(docId: string): Promise<{ blobKey: string | null; caseId: string; fileName: string } | null> {
  const rows = await ledgerQuery<{ blob_key: string | null; case_id: string; file_name: string }>(
    `SELECT blob_key, case_id, file_name FROM legacy_document WHERE id = $1::bigint AND status = 'stored' LIMIT 1`,
    [docId]
  );
  const r = rows[0];
  return r ? { blobKey: r.blob_key, caseId: r.case_id, fileName: r.file_name } : null;
}

/** Mint a read-only, ~15-minute SAS URL so the browser opens the file straight from Azure. */
export async function generateLegacySasUrl(blobKey: string, downloadName?: string): Promise<string> {
  if (!AZURE_CONN) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured.");
  // @ts-ignore - optional dep; install with `npm i @azure/storage-blob` in the app.
  const { BlobServiceClient, BlobSASPermissions } = await import("@azure/storage-blob");
  const svc = BlobServiceClient.fromConnectionString(AZURE_CONN);
  const blob = svc.getContainerClient(AZURE_CONTAINER).getBlobClient(blobKey);
  return blob.generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    startsOn: new Date(Date.now() - 60_000),
    expiresOn: new Date(Date.now() + SAS_TTL_MIN * 60_000),
    contentDisposition: downloadName ? `inline; filename="${downloadName.replace(/"/g, "")}"` : undefined,
  });
}

/** Per-user audit trail: who opened which legacy doc, when (table auto-creates in the ledger DB). */
export async function logLegacyDocAccess(docId: string, caseId: string, fileName: string, actorName: string | null) {
  await ledgerExec(
    `CREATE TABLE IF NOT EXISTS legacy_doc_access_log (
       id BIGSERIAL PRIMARY KEY, document_id BIGINT, case_id TEXT, file_name TEXT,
       actor_name TEXT, accessed_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  );
  await ledgerExec(
    `INSERT INTO legacy_doc_access_log (document_id, case_id, file_name, actor_name) VALUES ($1::bigint, $2, $3, $4)`,
    [docId, caseId, fileName, actorName]
  );
}
