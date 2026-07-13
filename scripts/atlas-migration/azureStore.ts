// Azure Blob upload for the migration. Uploads to Cool tier under {caseId}/{folder}/{fileName}. Content
// is deduped upstream by sha256 (ledger.blobKeyForHash), so identical sibling docs are stored once.
// Requires: npm i @azure/storage-blob
import { createHash } from "crypto";
import { config, assertAzure } from "./config";

// Lazy import so DRY_RUN works without the package installed.
let containerClient: any = null;
async function container() {
  if (containerClient) return containerClient;
  assertAzure();
  // @ts-ignore - optional dep; install with `npm i @azure/storage-blob` before a real (non-DRY) run.
  const { BlobServiceClient } = await import("@azure/storage-blob");
  const svc = BlobServiceClient.fromConnectionString(config.azure.connectionString);
  const c = svc.getContainerClient(config.azure.container);
  await c.createIfNotExists(); // private by default (no public access)
  containerClient = c;
  return c;
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9._\-\/]+/g, "_").replace(/\/+/g, "/").slice(0, 800);

/** Blob key for a file. Content-addressed by hash so dedup is trivial; friendly path kept in the manifest. */
export function blobKeyFor(caseId: string, folderPath: string, fileName: string, hash: string): string {
  const ext = (fileName.match(/\.[A-Za-z0-9]{1,5}$/) || [""])[0];
  // content-addressed (dedup-friendly); the human path lives in legacy_document.folder_path/file_name
  return `by-hash/${hash.slice(0, 2)}/${hash}${ext}`;
  // Alternative human-readable layout (no dedup): return safe(`${caseId}/${folderPath}/${fileName}`);
}

export async function uploadBlob(key: string, buf: Buffer, contentType?: string): Promise<void> {
  if (config.run.dryRun) return;
  const c = await container();
  const b = c.getBlockBlobClient(key);
  await b.uploadData(buf, {
    blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined,
    tier: config.azure.accessTier,
  });
}

export async function blobExists(key: string): Promise<boolean> {
  if (config.run.dryRun) return false;
  const c = await container();
  return c.getBlockBlobClient(key).exists();
}

export { safe };
