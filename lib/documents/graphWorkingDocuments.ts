import { graphApiBase } from "@/lib/graph/client";
import { getGraphAuthConfig } from "@/lib/graph/config";
import { requestMicrosoftGraphAppToken } from "@/lib/graph/token";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safeGraphFilename(value: unknown): string {
  const raw = clean(value) || `barsh-matters-working-${Date.now()}.docx`;
  const withExtension = raw.toLowerCase().endsWith(".docx") ? raw : `${raw}.docx`;

  return withExtension
    .replace(/[\/\\:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function workingFilenameSearchSlug(value: unknown): string {
  const raw = clean(value).toLowerCase();

  if (raw.includes("bill schedule")) return "Bill-Schedule";
  if (raw.includes("packet summary")) return "Packet-Summary";
  if (raw.includes("summons") || raw.includes("complaint")) return "Summons-Complaint";

  return "Document";
}

function encodeSharePointPathSegment(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "%20");
}

function buildDesktopWordFileUrl(params: {
  parentFolderWebUrl: string;
  webUrl: string;
  filename: string;
}): string {
  const parentFolderWebUrl = clean(params.parentFolderWebUrl);
  const webUrl = clean(params.webUrl);
  const filename = clean(params.filename);

  if (parentFolderWebUrl && filename) {
    return `${parentFolderWebUrl.replace(/\/$/, "")}/${encodeSharePointPathSegment(filename)}`;
  }

  if (!webUrl || !filename) return "";

  try {
    const parsed = new URL(webUrl);
    const marker = "/_layouts/15/Doc.aspx";
    const markerIndex = parsed.pathname.toLowerCase().indexOf(marker.toLowerCase());

    if (markerIndex < 0) {
      return webUrl;
    }

    const siteRootPath = parsed.pathname.slice(0, markerIndex).replace(/\/$/, "");
    return `${parsed.origin}${siteRootPath}/Documents/${encodeSharePointPathSegment(filename)}`;
  } catch {
    return webUrl;
  }
}

async function getDriveItemWebUrl(params: {
  mailboxUserId: string;
  driveItemId: string;
  accessToken?: string;
}): Promise<string> {
  const mailboxUserId = clean(params.mailboxUserId);
  const driveItemId = clean(params.driveItemId);

  if (!mailboxUserId || !driveItemId) return "";

  const url =
    `${graphApiBase()}/users/${encodeURIComponent(mailboxUserId)}` +
    `/drive/items/${encodeURIComponent(driveItemId)}?$select=webUrl`;

  const res = await graphRawFetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  }, params.accessToken);

  const json = await readGraphJson(res);

  if (!res.ok) {
    return "";
  }

  return clean(json?.webUrl);
}

async function graphRawFetch(url: string, init: RequestInit = {}, accessTokenOverride = "") {
  const accessToken = clean(accessTokenOverride);

  if (accessToken) {
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
  }

  const tokenResult = await requestMicrosoftGraphAppToken();

  if (!tokenResult.ok || !tokenResult.token?.accessToken) {
    throw new Error(tokenResult.error || "Could not acquire Microsoft Graph token.");
  }

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokenResult.token.accessToken}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

async function readGraphJson(res: Response): Promise<any> {
  const text = await res.text().catch(() => "");

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text.slice(0, 700) };
  }
}

export async function uploadWorkingDocxToGraph(params: {
  docxBuffer: Buffer;
  filename: string;
  folder?: string;
  accessToken?: string;
}) {
  if (!Buffer.isBuffer(params.docxBuffer) || params.docxBuffer.byteLength <= 0) {
    throw new Error("Cannot upload an empty DOCX working document.");
  }

  const config = getGraphAuthConfig();
  const mailboxUserId = clean(config.mailboxUserId);

  if (!mailboxUserId) {
    throw new Error("Missing MICROSOFT_GRAPH_MAILBOX_USER_ID for working document upload.");
  }

  const originalFilename = safeGraphFilename(params.filename);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const searchSlug = workingFilenameSearchSlug(originalFilename);
  const uniqueFilename = `BM-Working-${searchSlug}-${timestamp}.docx`;
  const folder = clean(params.folder) || "BarshMattersWorkingDocs";
  const uploadUrl =
    `${graphApiBase()}/users/${encodeURIComponent(mailboxUserId)}` +
    `/drive/root:/${encodeURIComponent(folder)}/${encodeURIComponent(uniqueFilename)}:/content`;

  const docxBody = new Uint8Array(params.docxBuffer);

  const uploadRes = await graphRawFetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": DOCX_CONTENT_TYPE,
    },
    body: docxBody,
  }, params.accessToken);

  const uploadJson = await readGraphJson(uploadRes);

  if (!uploadRes.ok) {
    throw new Error(
      `Microsoft Graph working DOCX upload failed: ${uploadRes.status} ${uploadRes.statusText} ${
        uploadJson?.error?.message || uploadJson?.error || JSON.stringify(uploadJson)
      }`
    );
  }

  const driveItemId = clean(uploadJson?.id);
  const webUrl = clean(uploadJson?.webUrl);
  const parentReference = uploadJson?.parentReference || null;
  const name = clean(uploadJson?.name) || uniqueFilename;

  if (!driveItemId) {
    throw new Error("Microsoft Graph working DOCX upload did not return a drive item id.");
  }

  const downloadUrl =
    `${graphApiBase()}/users/${encodeURIComponent(mailboxUserId)}` +
    `/drive/items/${encodeURIComponent(driveItemId)}/content`;

  const parentFolderWebUrl = await getDriveItemWebUrl({
    mailboxUserId,
    driveItemId: clean(parentReference?.id),
    accessToken: params.accessToken,
  });

  const desktopWordFileUrl = buildDesktopWordFileUrl({
    parentFolderWebUrl,
    webUrl,
    filename: name,
  });

  return {
    ok: true,
    mailboxUserId,
    driveItemId,
    name,
    originalFilename,
    webUrl,
    parentFolderWebUrl,
    desktopWordFileUrl,
    downloadUrl,
    size: Number(uploadJson?.size || params.docxBuffer.byteLength),
    contentType: DOCX_CONTENT_TYPE,
    msWordEditUrl: desktopWordFileUrl ? `ms-word:ofe|u|${desktopWordFileUrl}` : "",
    graphSource: "users-drive-working-docx",
  };
}

const PDF_CONTENT_TYPE = "application/pdf";

export async function downloadWorkingDocxFromGraph(driveItemId: string): Promise<{
  buffer: Buffer;
  contentType: string;
  byteLength: number;
}> {
  const cleanDriveItemId = clean(driveItemId);
  const config = getGraphAuthConfig();
  const mailboxUserId = clean(config.mailboxUserId);

  if (!mailboxUserId) {
    throw new Error("Missing MICROSOFT_GRAPH_MAILBOX_USER_ID for working document download.");
  }

  if (!cleanDriveItemId) {
    throw new Error("Missing Graph working document driveItemId.");
  }

  const downloadUrl =
    `${graphApiBase()}/users/${encodeURIComponent(mailboxUserId)}` +
    `/drive/items/${encodeURIComponent(cleanDriveItemId)}/content`;

  const res = await graphRawFetch(downloadUrl, {
    method: "GET",
    headers: {
      Accept: DOCX_CONTENT_TYPE,
    },
  });

  if (!res.ok) {
    const json = await readGraphJson(res);
    throw new Error(
      `Microsoft Graph working DOCX download failed: ${res.status} ${res.statusText} ${
        json?.error?.message || json?.error || JSON.stringify(json)
      }`
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  if (!buffer.byteLength) {
    throw new Error("Microsoft Graph returned an empty working DOCX buffer.");
  }

  return {
    buffer,
    contentType: res.headers.get("content-type") || DOCX_CONTENT_TYPE,
    byteLength: buffer.byteLength,
  };
}

export async function convertWorkingDocxDriveItemToPdf(params: {
  driveItemId: string;
}): Promise<{
  pdfBuffer: Buffer;
  pdfContentType: string;
  pdfByteLength: number;
  sourceDriveItemId: string;
}> {
  const cleanDriveItemId = clean(params.driveItemId);
  const config = getGraphAuthConfig();
  const mailboxUserId = clean(config.mailboxUserId);

  if (!mailboxUserId) {
    throw new Error("Missing MICROSOFT_GRAPH_MAILBOX_USER_ID for working document PDF conversion.");
  }

  if (!cleanDriveItemId) {
    throw new Error("Missing Graph working document driveItemId.");
  }

  const pdfUrl =
    `${graphApiBase()}/users/${encodeURIComponent(mailboxUserId)}` +
    `/drive/items/${encodeURIComponent(cleanDriveItemId)}/content?format=pdf`;

  const res = await graphRawFetch(pdfUrl, {
    method: "GET",
    headers: {
      Accept: PDF_CONTENT_TYPE,
    },
  });

  if (!res.ok) {
    const json = await readGraphJson(res);
    throw new Error(
      `Microsoft Graph working DOCX to PDF conversion failed: ${res.status} ${res.statusText} ${
        json?.error?.message || json?.error || JSON.stringify(json)
      }`
    );
  }

  const pdfBuffer = Buffer.from(await res.arrayBuffer());

  if (!pdfBuffer.byteLength) {
    throw new Error("Microsoft Graph returned an empty PDF buffer.");
  }

  if (pdfBuffer.slice(0, 4).toString("utf8") !== "%PDF") {
    throw new Error("Microsoft Graph conversion response did not look like a PDF.");
  }

  return {
    pdfBuffer,
    pdfContentType: res.headers.get("content-type") || PDF_CONTENT_TYPE,
    pdfByteLength: pdfBuffer.byteLength,
    sourceDriveItemId: cleanDriveItemId,
  };
}


export async function findLatestWorkingDocxInGraph(params: {
  filenameIncludes?: string;
  folder?: string;
}) {
  const config = getGraphAuthConfig();
  const mailboxUserId = clean(config.mailboxUserId);

  if (!mailboxUserId) {
    throw new Error("Missing MICROSOFT_GRAPH_MAILBOX_USER_ID for working document lookup.");
  }

  const folder = clean(params.folder) || "BarshMattersWorkingDocs";
  const childrenUrl =
    `${graphApiBase()}/users/${encodeURIComponent(mailboxUserId)}` +
    `/drive/root:/${encodeURIComponent(folder)}:/children?$top=200&$orderby=lastModifiedDateTime desc`;

  const res = await graphRawFetch(childrenUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const json = await readGraphJson(res);

  if (!res.ok) {
    throw new Error(
      `Microsoft Graph working document lookup failed: ${res.status} ${res.statusText} ${
        json?.error?.message || json?.error || JSON.stringify(json)
      }`
    );
  }

  const wanted = clean(params.filenameIncludes).toLowerCase();
  const rows = Array.isArray(json?.value) ? json.value : [];
  const docxRows = rows.filter((row: any) => {
    const name = clean(row?.name).toLowerCase();
    if (!name.endsWith(".docx")) return false;
    if (wanted && !name.includes(wanted)) return false;
    return true;
  });

  const row = docxRows[0] || null;

  if (!row) {
    return {
      ok: false,
      found: false,
      folder,
      filenameIncludes: wanted,
      candidateCount: docxRows.length,
    };
  }

  const driveItemId = clean(row.id);
  const webUrl = clean(row.webUrl);

  const name = clean(row.name);
  const parentFolderWebUrl = await getDriveItemWebUrl({
    mailboxUserId,
    driveItemId: clean(row?.parentReference?.id),
  });

  const desktopWordFileUrl = buildDesktopWordFileUrl({
    parentFolderWebUrl,
    webUrl,
    filename: name,
  });

  return {
    ok: true,
    found: true,
    folder,
    filenameIncludes: wanted,
    driveItemId,
    name,
    webUrl,
    parentFolderWebUrl,
    desktopWordFileUrl,
    lastModifiedDateTime: clean(row.lastModifiedDateTime),
    createdDateTime: clean(row.createdDateTime),
    size: Number(row.size || 0),
    msWordEditUrl: desktopWordFileUrl ? `ms-word:ofe|u|${desktopWordFileUrl}` : "",
    graphSource: "users-drive-working-docx-latest",
  };
}
