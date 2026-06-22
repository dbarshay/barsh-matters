import { clioFetch } from "@/lib/clio";

type ClioPutHeader = {
  name?: string;
  value?: string;
};

type ClioUploadResult = {
  documentId: number;
  documentName: string;
  documentVersionUuid: string;
  fullyUploaded: boolean;
};

export type ClioDocumentParentType = "Matter" | "Folder";

export type ClioMatterDocument = {
  id: number;
  name: string;
  filename: string;
  createdAt: string;
  updatedAt: string;
  latestDocumentVersion: {
    id: number | null;
    uuid: string;
    filename: string;
    size: number | null;
    contentType: string;
    fullyUploaded: boolean;
    receivedAt: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function positiveId(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function headersFromClioPutHeaders(putHeaders: ClioPutHeader[]): Headers {
  const headers = new Headers();

  for (const header of putHeaders || []) {
    const name = clean(header?.name);
    const value = clean(header?.value);

    if (!name || !value) continue;

    headers.set(name, value);
  }

  return headers;
}

async function readClioJson(res: Response, fallback: string): Promise<any> {
  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(
      `${fallback}: ${res.status} ${res.statusText}${json ? ` ${JSON.stringify(json)}` : text ? ` ${text}` : ""}`
    );
  }

  return json;
}

function mapClioDocumentRow(row: any): ClioMatterDocument {
  const version = row?.latest_document_version || null;

  return {
    id: Number(row?.id),
    name: clean(row?.name),
    filename: clean(row?.filename),
    createdAt: clean(row?.created_at),
    updatedAt: clean(row?.updated_at),
    latestDocumentVersion: version
      ? {
          id: version?.id == null ? null : Number(version.id),
          uuid: clean(version?.uuid),
          filename: clean(version?.filename),
          size: version?.size == null ? null : Number(version.size),
          contentType: clean(version?.content_type),
          fullyUploaded: Boolean(version?.fully_uploaded),
          receivedAt: clean(version?.received_at),
          createdAt: clean(version?.created_at),
          updatedAt: clean(version?.updated_at),
        }
      : null,
  };
}

function documentListFields(): string {
  return [
    "id",
    "name",
    "filename",
    "created_at",
    "updated_at",
    "latest_document_version{id,uuid,filename,size,content_type,fully_uploaded,received_at,created_at,updated_at}",
  ].join(",");
}

export async function uploadBufferToClioMatterDocuments(params: {
  matterId: number;
  filename: string;
  buffer: Buffer;
  contentType: string;
  parentType?: ClioDocumentParentType;
  parentId?: number;
}): Promise<ClioUploadResult> {
  const matterId = positiveId(params.matterId);
  const parentType: ClioDocumentParentType = params.parentType === "Folder" ? "Folder" : "Matter";
  const parentId = parentType === "Folder" ? positiveId(params.parentId) : matterId;
  const filename = clean(params.filename);
  const contentType = clean(params.contentType) || "application/octet-stream";
  const buffer = Buffer.isBuffer(params.buffer)
    ? params.buffer
    : Buffer.from(params.buffer);

  if (!matterId) {
    throw new Error("Missing valid Clio matter ID for document upload.");
  }

  if (!parentId) {
    throw new Error(`Missing valid Clio ${parentType} parent ID for document upload.`);
  }

  if (!filename) {
    throw new Error("Missing filename for Clio document upload.");
  }

  if (!buffer.length) {
    throw new Error(`Generated document buffer is empty for ${filename}.`);
  }

  const createRes = await clioFetch(
    "/api/v4/documents.json?fields=id,name,latest_document_version{uuid,put_url,put_headers}",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          name: filename,
          parent: {
            id: parentId,
            type: parentType,
          },
        },
      }),
    }
  );

  const createJson = await readClioJson(
    createRes,
    `Clio document create failed for ${filename}`
  );

  const documentId = Number(createJson?.data?.id);
  const documentName = clean(createJson?.data?.name || filename);
  const latestVersion = createJson?.data?.latest_document_version || {};
  const uuid = clean(latestVersion?.uuid);
  const putUrl = clean(latestVersion?.put_url);
  const putHeaders = Array.isArray(latestVersion?.put_headers)
    ? latestVersion.put_headers
    : [];

  if (!documentId || !uuid || !putUrl) {
    throw new Error(
      `Clio document create response was missing required upload fields for ${filename}: ${JSON.stringify(createJson)}`
    );
  }

  const uploadHeaders = headersFromClioPutHeaders(putHeaders);

  if (!uploadHeaders.has("Content-Type")) {
    uploadHeaders.set("Content-Type", contentType);
  }

  if (!uploadHeaders.has("Content-Length")) {
    uploadHeaders.set("Content-Length", String(buffer.byteLength));
  }

  const uploadRes = await fetch(putUrl, {
    method: "PUT",
    headers: uploadHeaders,
    body: buffer as unknown as BodyInit,
  });

  if (!uploadRes.ok) {
    const uploadText = await uploadRes.text().catch(() => "");
    throw new Error(
      `Signed Clio document upload failed for ${filename}: ${uploadRes.status} ${uploadRes.statusText}${uploadText ? ` ${uploadText}` : ""}`
    );
  }

  const finalizeRes = await clioFetch(
    `/api/v4/documents/${documentId}.json?fields=id,name,latest_document_version{fully_uploaded}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          uuid,
          fully_uploaded: "true",
        },
      }),
    }
  );

  const finalizeJson = await readClioJson(
    finalizeRes,
    `Clio document finalize failed for ${filename}`
  );

  const fullyUploaded = Boolean(
    finalizeJson?.data?.latest_document_version?.fully_uploaded
  );

  if (!fullyUploaded) {
    throw new Error(
      `Clio did not confirm fully_uploaded=true for ${filename}: ${JSON.stringify(finalizeJson)}`
    );
  }

  return {
    documentId,
    documentName,
    documentVersionUuid: uuid,
    fullyUploaded,
  };
}

export async function listClioMatterDocuments(matterIdInput: number): Promise<ClioMatterDocument[]> {
  const matterId = positiveId(matterIdInput);

  if (!matterId) {
    throw new Error("Missing valid Clio matter ID for document lookup.");
  }

  const res = await clioFetch(
    `/api/v4/documents.json?matter_id=${encodeURIComponent(String(matterId))}&limit=200&fields=${encodeURIComponent(documentListFields())}`
  );

  const json = await readClioJson(
    res,
    `Clio document lookup failed for matter ${matterId}`
  );

  const rows = Array.isArray(json?.data) ? json.data : [];

  return rows.map(mapClioDocumentRow);
}

export async function listClioFolderDocuments(folderIdInput: number): Promise<ClioMatterDocument[]> {
  const folderId = positiveId(folderIdInput);

  if (!folderId) {
    throw new Error("Missing valid Clio folder ID for document lookup.");
  }

  const res = await clioFetch(
    `/api/v4/documents.json?parent_id=${encodeURIComponent(String(folderId))}&limit=200&fields=${encodeURIComponent(documentListFields())}`
  );

  const json = await readClioJson(
    res,
    `Clio document lookup failed for folder ${folderId}`
  );

  const rows = Array.isArray(json?.data) ? json.data : [];

  return rows.map(mapClioDocumentRow);
}

export function findExistingClioDocumentsByFilename(
  existingDocuments: ClioMatterDocument[],
  filename: string
): ClioMatterDocument[] {
  const wanted = clean(filename).toLowerCase();

  if (!wanted) return [];

  return existingDocuments.filter((document) => {
    const name = clean(document?.name).toLowerCase();
    const file = clean(document?.filename).toLowerCase();
    const versionFile = clean(document?.latestDocumentVersion?.filename).toLowerCase();

    return name === wanted || file === wanted || versionFile === wanted;
  });
}
