// Process a single Microsoft Graph change notification for a mailbox message. Reused by the webhook
// receiver so a new/updated/deleted email is reflected in Barsh Matters in real time, mirroring the
// every-minute-cron behavior but scoped to the one changed message.
//
//   created/updated -> fetch the message, resolve its matter/lawsuit context (existing thread by
//                      conversationId, else a known Clio MailDrop recipient match), persist it, and
//                      stage any inbound attachments into the OCR review queue (flag-gated).
//   deleted         -> mark the local copy deletedLocal=true so it moves to our Deleted Items folder,
//                      mirroring a delete performed directly in Outlook. Never hard-deletes.

import { prisma } from "@/lib/prisma";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { persistGraphThreadSyncMessages } from "@/lib/graph/emailPersistence";
import { loadKnownMaildropAddresses } from "@/lib/graph/maildropRegistry";
import { isInboundAttachmentOcrEnabled } from "@/lib/graph/inboundOcrConfig";
import { ingestInboundMessageAttachments } from "@/lib/graph/inboundAttachmentOcr";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function recipEmail(v: any): string {
  return clean(v?.emailAddress?.address || v?.address || v?.email);
}
function recipName(v: any): string {
  return clean(v?.emailAddress?.name || v?.name || recipEmail(v));
}
function recipList(vs: any): string[] {
  return Array.isArray(vs) ? vs.map(recipEmail).filter(Boolean) : [];
}
function allRecipientEmails(msg: any): string[] {
  return [...recipList(msg?.toRecipients), ...recipList(msg?.ccRecipients), ...recipList(msg?.bccRecipients)]
    .map((e) => e.toLowerCase())
    .filter(Boolean);
}

const SELECT = [
  "id", "conversationId", "internetMessageId", "subject", "from",
  "toRecipients", "ccRecipients", "bccRecipients",
  "sentDateTime", "receivedDateTime", "lastModifiedDateTime",
  "bodyPreview", "body", "webLink", "hasAttachments", "isRead",
].join(",");

function messageUrl(mailbox: string, graphMessageId: string): string {
  return `${graphApiBase()}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(graphMessageId)}?$select=${encodeURIComponent(SELECT)}`;
}

function normalize(message: any) {
  const html = clean(message?.body?.contentType).toLowerCase() === "html";
  const content = clean(message?.body?.content);
  return {
    graphMessageId: clean(message?.id),
    internetMessageId: clean(message?.internetMessageId),
    conversationId: clean(message?.conversationId),
    subject: clean(message?.subject),
    from: message?.from,
    fromEmail: recipEmail(message?.from),
    toRecipients: recipList(message?.toRecipients),
    ccRecipients: recipList(message?.ccRecipients),
    bccRecipients: recipList(message?.bccRecipients),
    sentAt: clean(message?.sentDateTime),
    receivedAt: clean(message?.receivedDateTime),
    bodyPreview: clean(message?.bodyPreview),
    bodyText: html ? "" : content,
    bodyHtml: html ? content : "",
    hasAttachments: Boolean(message?.hasAttachments),
    isRead: typeof message?.isRead === "boolean" ? message.isRead : null,
    raw: message,
  };
}

export type ProcessResult = {
  ok: boolean;
  action: "persisted" | "soft_deleted" | "skipped" | "error";
  reason?: string;
  conversationId?: string;
  error?: string;
};

// Only matter-related mail is ingested: a reply into a known thread, a known Clio MailDrop recipient,
// or a subject carrying the matter/lawsuit file-number tag "[BRL_…]". Anything else is skipped (the
// user's unrelated personal mail is never stored).
function matterTagFromSubject(subject: string): string {
  const m = /\[(BRL[_-][A-Za-z0-9_-]+)\]/i.exec(subject || "");
  return m ? m[1].toUpperCase() : "";
}

async function resolveContext(conversationId: string, recipients: string[], subject: string): Promise<any | null> {
  // 1) Reply into an existing matter/lawsuit thread — reuse its context.
  if (conversationId) {
    const thread = await prisma.emailThread.findFirst({
      where: { conversationId },
      select: { matterId: true, matterDisplayNumber: true, masterLawsuitId: true, clioMatterId: true, clioDisplayNumber: true, clioMaildropEmail: true, clioMaildropLabel: true },
    });
    if (thread) return { source: "graph_webhook", ...thread };
  }
  // 2) Subject carries a matter/lawsuit file-number tag [BRL_…] — associate by display number. Reuse an
  //    existing thread's fuller context for that tag when available.
  const tag = matterTagFromSubject(subject);
  if (tag) {
    const byTag = await prisma.emailThread.findFirst({
      where: { matterDisplayNumber: tag },
      select: { matterId: true, matterDisplayNumber: true, masterLawsuitId: true, clioMatterId: true, clioDisplayNumber: true, clioMaildropEmail: true, clioMaildropLabel: true },
    });
    if (byTag) return { source: "graph_webhook", ...byTag };
    return { source: "graph_webhook", matterDisplayNumber: tag };
  }
  // 3) New inbound addressed to a known Clio MailDrop — associate to that matter/lawsuit.
  const recipSet = new Set(recipients.map((r) => r.toLowerCase()));
  if (recipSet.size) {
    const known = await loadKnownMaildropAddresses(200);
    for (const rec of known as any[]) {
      const email = clean(rec?.clioMaildropEmail).toLowerCase();
      if (email && recipSet.has(email)) {
        return {
          source: "graph_webhook",
          matterId: rec.matterId ?? null,
          matterDisplayNumber: rec.matterDisplayNumber ?? null,
          masterLawsuitId: rec.masterLawsuitId ?? null,
          clioMatterId: rec.clioMatterId ?? null,
          clioDisplayNumber: rec.clioDisplayNumber ?? null,
          clioMaildropEmail: rec.clioMaildropEmail ?? null,
          clioMaildropLabel: rec.clioMaildropLabel ?? null,
        };
      }
    }
  }
  return null;
}

export async function processChangedMessage(input: { graphMessageId: string; changeType: string; mailbox: string }): Promise<ProcessResult> {
  const graphMessageId = clean(input.graphMessageId);
  if (!graphMessageId) return { ok: false, action: "error", error: "Missing message id." };
  const changeType = clean(input.changeType).toLowerCase();
  // The mailbox comes from the notification's resource (the specific user's mailbox — no firm mailbox).
  const mailbox = clean(input.mailbox).toLowerCase();
  if (!mailbox.includes("@")) return { ok: false, action: "error", error: "Missing mailbox on notification." };

  // Deleted in Outlook → mirror as a soft delete locally (moves to our Deleted Items). Never hard delete.
  if (changeType.includes("deleted")) {
    try {
      await (prisma as any).emailMessage.updateMany({ where: { graphMessageId }, data: { deletedLocal: true } });
    } catch {
      /* non-fatal */
    }
    return { ok: true, action: "soft_deleted" };
  }

  const res = await graphFetchJson({ url: messageUrl(mailbox, graphMessageId), method: "GET" });
  if (!res.ok) {
    // Gone (moved/deleted between notification and fetch) → treat as a soft delete.
    if (res.status === 404) {
      try {
        await (prisma as any).emailMessage.updateMany({ where: { graphMessageId }, data: { deletedLocal: true } });
      } catch {
        /* non-fatal */
      }
      return { ok: true, action: "soft_deleted", reason: "message not found (moved/deleted)" };
    }
    return { ok: false, action: "error", error: `Graph message fetch failed: ${res.error}` };
  }

  const message = normalize(res.json || {});
  const conversationId = message.conversationId;
  if (!conversationId) return { ok: true, action: "skipped", reason: "no conversationId" };

  const context = await resolveContext(conversationId, allRecipientEmails(res.json || {}), message.subject);
  if (!context) return { ok: true, action: "skipped", reason: "not matter-related (no tracked conversation, [BRL_] tag, or maildrop)" };

  await persistGraphThreadSyncMessages({ mailboxUserId: mailbox, conversationId, messages: [message], context });

  // Stage inbound attachments into the OCR review queue (flag-gated, best-effort; no Clio write).
  if (isInboundAttachmentOcrEnabled() && message.hasAttachments) {
    try {
      const local = await prisma.emailMessage.findFirst({
        where: { graphMessageId, direction: "inbound" },
        select: { id: true, mailboxUserId: true, thread: { select: { matterId: true, masterLawsuitId: true, matterDisplayNumber: true } } },
      });
      if (local) {
        await ingestInboundMessageAttachments(prisma, {
          mailboxUserId: local.mailboxUserId || mailbox,
          graphMessageId,
          localMessageId: local.id,
          context: {
            matterId: local.thread?.matterId ?? null,
            masterLawsuitId: local.thread?.masterLawsuitId ?? null,
            matterDisplayNumber: local.thread?.matterDisplayNumber ?? null,
          },
        });
      }
    } catch {
      /* non-fatal — attachment OCR is a backstop, the cron also stages these */
    }
  }

  return { ok: true, action: "persisted", conversationId };
}
