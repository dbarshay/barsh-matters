// Send a native email from a matter via Microsoft Graph, threaded to the matter.
//
// Uses draft-then-send (create the message, then POST /send) so we capture the real conversationId /
// internetMessageId / webLink and can thread replies (Phase B) and file inbound attachments (Phase D)
// against the same thread. Records an outbound EmailThread + EmailMessage + EmailMatterLink. The send
// is the primary action; the local record is best-effort. Gated by the caller (flag + operator confirm).

import { prisma } from "@/lib/prisma";
import { assertGraphDraftEnvironmentReady, graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { MATTER_EMAIL_SIMPLE_ATTACHMENT_BYTES, type ResolvedFiledAttachment } from "@/lib/graph/matterEmailAttachments";

export type SendMatterEmailInput = {
  matterId?: number | null;
  matterDisplayNumber?: string | null;
  masterLawsuitId?: string | null;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  actorEmail?: string | null;
  /** When set, this is a REPLY to that Graph message — threaded via createReply (In-Reply-To/References). */
  replyToGraphMessageId?: string | null;
  /** Phase C — already-filed documents (resolved + authorized + downloaded by the caller) to attach. */
  attachments?: ResolvedFiledAttachment[];
};

export type SendMatterEmailResult = {
  ok: boolean;
  error?: string;
  sentTo?: string[];
  subject?: string;
  webLink?: string | null;
  threadId?: string;
  messageId?: string;
  recorded?: boolean;
  attachedCount?: number;
};

const enc = encodeURIComponent;

/** Ensure the matter file number tag "[BRL_…]" is on the subject so replies stay threaded to the matter. */
export function ensureMatterSubjectTag(subject: string, matterDisplayNumber?: string | null): string {
  const s = (subject || "").trim();
  const tag = (matterDisplayNumber || "").trim();
  if (!tag) return s;
  return s.includes(`[${tag}]`) ? s : `${s} [${tag}]`.trim();
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^\s*(re|fwd?)\s*:\s*/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function addressList(emails: string[]): { emailAddress: { address: string } }[] {
  return emails.map((address) => ({ emailAddress: { address } }));
}

// 320 KiB * 10 — Graph upload-session chunks must be a multiple of 320 KiB (and <= ~4 MB per PUT).
const UPLOAD_CHUNK_BYTES = 3_276_800;

/**
 * Attach one resolved filed document to a Graph draft. Files up to the simple limit go via a single
 * POST; larger files (up to the per-file cap) stream through a Graph upload session (chunked PUT to a
 * pre-authorized URL) — no compression, no quality loss.
 */
async function attachFiledDocumentToDraft(params: {
  base: string;
  mailbox: string;
  messageId: string;
  att: ResolvedFiledAttachment;
}): Promise<{ ok: true; graphAttachmentId: string | null } | { ok: false; error: string }> {
  const { base, mailbox, messageId, att } = params;

  if (att.byteLength <= MATTER_EMAIL_SIMPLE_ATTACHMENT_BYTES) {
    const up = await graphFetchJson({
      url: `${base}/users/${enc(mailbox)}/messages/${enc(messageId)}/attachments`,
      method: "POST",
      body: {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.contentBytes,
      },
    });
    if (!up.ok) return { ok: false, error: up.error || "attachment upload failed" };
    return { ok: true, graphAttachmentId: up.json?.id ? String(up.json.id) : null };
  }

  // Upload session for the 3–5 MB range.
  const session = await graphFetchJson({
    url: `${base}/users/${enc(mailbox)}/messages/${enc(messageId)}/attachments/createUploadSession`,
    method: "POST",
    body: {
      AttachmentItem: {
        attachmentType: "file",
        name: att.name,
        size: att.byteLength,
        contentType: att.contentType,
      },
    },
  });
  if (!session.ok) return { ok: false, error: session.error || "could not start upload session" };
  const uploadUrl = session.json?.uploadUrl;
  if (!uploadUrl) return { ok: false, error: "upload session did not return an upload URL" };

  const buf = Buffer.from(att.contentBytes, "base64");
  const total = buf.byteLength;
  let graphAttachmentId: string | null = null;

  for (let start = 0; start < total; start += UPLOAD_CHUNK_BYTES) {
    const end = Math.min(start + UPLOAD_CHUNK_BYTES, total);
    const chunk = buf.subarray(start, end);
    // The uploadUrl is pre-authorized — do NOT send an Authorization header.
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Range": `bytes ${start}-${end - 1}/${total}` },
      body: new Uint8Array(chunk),
      cache: "no-store",
    });
    if (put.status !== 200 && put.status !== 201 && put.status !== 202) {
      const t = await put.text().catch(() => "");
      return { ok: false, error: `chunk upload failed (${put.status}).${t ? ` ${t.slice(0, 200)}` : ""}` };
    }
    if (put.status === 201) {
      const j = await put.json().catch(() => null);
      graphAttachmentId = j?.id ? String(j.id) : null;
    }
  }
  return { ok: true, graphAttachmentId };
}

export type SaveDraftInput = {
  matterId?: number | null;
  matterDisplayNumber?: string | null;
  masterLawsuitId?: string | null;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  actorEmail?: string | null;
};

/**
 * Save a compose as a REAL draft in the firm mailbox's Outlook Drafts folder (Graph create-message,
 * no /send). Records a local EmailMessage with isDraft=true so it shows under our "Drafts" folder,
 * matching Outlook. The Graph draft is the primary action; the local record is best-effort.
 */
export async function saveMatterEmailDraft(input: SaveDraftInput): Promise<SendMatterEmailResult> {
  const to = (input.to || []).map((e) => e.trim()).filter(Boolean);
  const cc = (input.cc || []).map((e) => e.trim()).filter(Boolean);

  const env = assertGraphDraftEnvironmentReady();
  if (!env.ok) return { ok: false, error: env.error };
  const mailbox = env.mailboxUserId;
  const base = graphApiBase();
  const subject = ensureMatterSubjectTag(input.subject, input.matterDisplayNumber);

  // Create the draft in Outlook (create-message with no send leaves it in Drafts).
  const draft = await graphFetchJson({
    url: `${base}/users/${enc(mailbox)}/messages`,
    method: "POST",
    body: {
      subject,
      body: { contentType: "HTML", content: input.bodyHtml || "" },
      ...(to.length ? { toRecipients: addressList(to) } : {}),
      ...(cc.length ? { ccRecipients: addressList(cc) } : {}),
    },
  });
  if (!draft.ok) return { ok: false, error: `Draft save failed: ${draft.error}` };
  const msg: any = draft.json || {};
  const graphMessageId = msg.id;

  // Record locally as a draft (best-effort — the Outlook draft already exists).
  let threadId: string | undefined;
  let messageId: string | undefined;
  let recorded = false;
  try {
    const db = prisma as any;
    const now = new Date();
    const conversationId = String(msg.conversationId || `matter-draft-${graphMessageId || now.getTime()}`);
    let thread = msg.conversationId ? await db.emailThread.findFirst({ where: { conversationId } }) : null;
    if (!thread) {
      thread = await db.emailThread.create({
        data: {
          conversationId,
          internetMessageId: msg.internetMessageId ?? null,
          mailboxUserId: mailbox,
          subject,
          normalizedSubject: normalizeSubject(subject),
          latestMessageAt: now,
          lastSyncedAt: now,
          direction: "outbound",
          source: "matter-draft",
          matterId: input.matterId ?? null,
          matterDisplayNumber: input.matterDisplayNumber ?? null,
          masterLawsuitId: input.masterLawsuitId ?? null,
          status: "active",
        },
      });
    }
    threadId = thread.id;
    const message = await db.emailMessage.create({
      data: {
        threadId: thread.id,
        mailboxUserId: mailbox,
        graphMessageId: graphMessageId ?? null,
        internetMessageId: msg.internetMessageId ?? null,
        conversationId: msg.conversationId ?? null,
        subject,
        fromEmail: mailbox,
        toRecipients: to,
        ccRecipients: cc,
        direction: "outbound",
        isDraft: true,
        isSent: false,
        bodyHtml: input.bodyHtml || "",
        webLink: msg.webLink ?? null,
      },
    });
    messageId = message.id;
    recorded = true;
  } catch {
    recorded = false;
  }

  return { ok: true, sentTo: to, subject, webLink: msg.webLink ?? null, threadId, messageId, recorded };
}

export async function sendMatterEmail(input: SendMatterEmailInput): Promise<SendMatterEmailResult> {
  const to = (input.to || []).map((e) => e.trim()).filter(Boolean);
  const cc = (input.cc || []).map((e) => e.trim()).filter(Boolean);
  const isReply = Boolean(input.replyToGraphMessageId);
  // On a reply, recipients default to the original sender (createReply pre-fills them), so To is optional.
  if (!isReply && to.length === 0) return { ok: false, error: "At least one recipient (To) is required." };

  const env = assertGraphDraftEnvironmentReady();
  if (!env.ok) return { ok: false, error: env.error };
  const mailbox = env.mailboxUserId;
  const base = graphApiBase();

  let msg: any = {};
  let graphMessageId: string | undefined;
  let subject = ensureMatterSubjectTag(input.subject, input.matterDisplayNumber);

  if (isReply) {
    // Reply path: createReply (threaded draft w/ quoted history) → prepend operator text → send.
    const cr = await graphFetchJson({
      url: `${base}/users/${enc(mailbox)}/messages/${enc(String(input.replyToGraphMessageId))}/createReply`,
      method: "POST",
      body: {},
    });
    if (!cr.ok) return { ok: false, error: `Reply draft failed: ${cr.error}` };
    msg = cr.json || {};
    graphMessageId = msg.id;
    subject = msg.subject || subject;
    const quoted = msg?.body?.content || "";
    const patchBody: any = { body: { contentType: "HTML", content: `${input.bodyHtml || ""}${quoted ? `<br><br>${quoted}` : ""}` } };
    if (to.length) patchBody.toRecipients = addressList(to);
    if (cc.length) patchBody.ccRecipients = addressList(cc);
    const patch = await graphFetchJson({
      url: `${base}/users/${enc(mailbox)}/messages/${enc(String(graphMessageId))}`,
      method: "PATCH",
      body: patchBody,
    });
    if (!patch.ok) return { ok: false, error: `Reply update failed: ${patch.error}` };
  } else {
    // New-send path: create the draft (captures the real ids).
    const draft = await graphFetchJson({
      url: `${base}/users/${enc(mailbox)}/messages`,
      method: "POST",
      body: {
        subject,
        body: { contentType: "HTML", content: input.bodyHtml || "" },
        toRecipients: addressList(to),
        ...(cc.length ? { ccRecipients: addressList(cc) } : {}),
      },
    });
    if (!draft.ok) return { ok: false, error: `Draft create failed: ${draft.error}` };
    msg = draft.json || {};
    graphMessageId = msg.id;
  }

  // 1b) Attach filed documents to the draft (before /send). Each is uploaded as a Graph fileAttachment;
  // the bytes were already downloaded + size-checked + authorized to this matter/lawsuit by the caller.
  const attachments = (input.attachments || []).filter((a) => a && a.contentBytes);
  const attachmentResults: { name: string; clioDocumentId: string; graphAttachmentId: string | null; byteLength: number; contentType: string }[] = [];
  for (const att of attachments) {
    const up = await attachFiledDocumentToDraft({ base, mailbox, messageId: String(graphMessageId), att });
    if (!up.ok) return { ok: false, error: `Attaching "${att.name}" failed: ${up.error}` };
    attachmentResults.push({
      name: att.name,
      clioDocumentId: att.clioDocumentId,
      graphAttachmentId: up.graphAttachmentId,
      byteLength: att.byteLength,
      contentType: att.contentType,
    });
  }

  // 2) Send it.
  const sent = await graphFetchJson({
    url: `${base}/users/${enc(mailbox)}/messages/${enc(String(graphMessageId))}/send`,
    method: "POST",
    body: {},
  });
  if (!sent.ok) return { ok: false, error: `Send failed: ${sent.error}` };

  // 3) Record the outbound thread/message + matter link (best-effort — the email is already sent).
  let threadId: string | undefined;
  let messageId: string | undefined;
  let recorded = false;
  try {
    const db = prisma as any;
    const now = new Date();
    const conversationId = String(msg.conversationId || `matter-compose-${graphMessageId || now.getTime()}`);
    // Reuse the existing thread when replying (same conversationId); otherwise create a new one.
    let thread = msg.conversationId
      ? await db.emailThread.findFirst({ where: { conversationId } })
      : null;
    if (thread) {
      await db.emailThread.update({ where: { id: thread.id }, data: { latestMessageAt: now, lastSyncedAt: now } });
    } else {
      thread = await db.emailThread.create({
        data: {
          conversationId,
          internetMessageId: msg.internetMessageId ?? null,
          mailboxUserId: mailbox,
          subject,
          normalizedSubject: normalizeSubject(subject),
          latestMessageAt: now,
          lastSyncedAt: now,
          direction: "outbound",
          source: isReply ? "matter-reply" : "matter-compose",
          matterId: input.matterId ?? null,
          matterDisplayNumber: input.matterDisplayNumber ?? null,
          masterLawsuitId: input.masterLawsuitId ?? null,
          status: "active",
        },
      });
    }
    threadId = thread.id;
    const message = await db.emailMessage.create({
      data: {
        threadId: thread.id,
        mailboxUserId: mailbox,
        graphMessageId: graphMessageId ?? null,
        internetMessageId: msg.internetMessageId ?? null,
        conversationId: msg.conversationId ?? null,
        subject,
        fromEmail: mailbox,
        toRecipients: to,
        ccRecipients: cc,
        sentAt: now,
        direction: "outbound",
        isSent: true,
        bodyHtml: input.bodyHtml || "",
        webLink: msg.webLink ?? null,
      },
    });
    messageId = message.id;
    // Record each attached filed document (metadata only — the bytes stay in the Clio vault).
    for (const ar of attachmentResults) {
      try {
        await db.emailAttachment.create({
          data: {
            messageId: message.id,
            provider: "microsoft_graph",
            graphAttachmentId: ar.graphAttachmentId,
            name: ar.name,
            contentType: ar.contentType,
            sizeBytes: ar.byteLength,
            isInline: false,
            clioDocumentId: ar.clioDocumentId,
            clioDocumentName: ar.name,
            storageStatus: "clio_vault",
          },
        });
      } catch {
        /* best-effort — the email + attachment already went out */
      }
    }
    await db.emailMatterLink.create({
      data: {
        threadId: thread.id,
        messageId: message.id,
        matterId: input.matterId ?? null,
        matterDisplayNumber: input.matterDisplayNumber ?? null,
        masterLawsuitId: input.masterLawsuitId ?? null,
        linkReason: "matter-compose",
        confidence: "high",
        createdBy: input.actorEmail ?? null,
      },
    });
    recorded = true;
  } catch {
    recorded = false;
  }

  return {
    ok: true,
    sentTo: to,
    subject,
    webLink: msg.webLink ?? null,
    threadId,
    messageId,
    recorded,
    attachedCount: attachmentResults.length,
  };
}
