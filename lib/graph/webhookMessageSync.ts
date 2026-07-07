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

// Only matter-related mail is ingested: a reply into a known thread, or a matter/lawsuit file number
// found ANYWHERE in the subject or body. Two accepted formats: the BM number "BRL_YYYYNNNNN" and the
// dotted number "YYYY.MM.NNNNN". Anything with no match is skipped (personal mail is never stored).
export function extractMatterNumbers(text: string): string[] {
  const out: string[] = [];
  const t = String(text || "");
  // BRL_ form (brackets optional, separator optional): BRL_202600002 / [BRL-202600002] / BRL 202600002
  const brl = /BRL[ _\-]?(\d{6,})/gi;
  let m: RegExpExecArray | null;
  while ((m = brl.exec(t))) out.push(`BRL_${m[1]}`);
  // Dotted form: 2026.07.00002 (also tolerate - or / as separators, normalize to dots). The final group
  // is 3+ digits so a plain calendar date like 2026.07.15 is not mistaken for a matter number.
  const dotted = /\b(20\d{2})[.\-/](\d{2})[.\-/](\d{3,})\b/g;
  while ((m = dotted.exec(t))) out.push(`${m[1]}.${m[2]}.${m[3]}`);
  return Array.from(new Set(out));
}

export async function resolveMatterContext(conversationId: string, matchText: string): Promise<any | null> {
  // 1) Reply into an existing matter/lawsuit thread — reuse its context.
  if (conversationId) {
    const thread = await prisma.emailThread.findFirst({
      where: { conversationId },
      select: { matterId: true, matterDisplayNumber: true, masterLawsuitId: true, clioMatterId: true, clioDisplayNumber: true, clioMaildropEmail: true, clioMaildropLabel: true },
    });
    if (thread) return { source: "graph_webhook", ...thread };
  }
  // 2) A matter number appears anywhere in the subject or body — resolve it to a matter.
  const tags = extractMatterNumbers(matchText);
  if (tags.length) {
    // Prefer a real matter record: ClaimIndex.display_number → numeric matter_id (so per-matter badges
    // match, not just the firm-wide display-number view).
    try {
      const claim = await (prisma as any).claimIndex.findFirst({ where: { display_number: { in: tags } }, select: { matter_id: true, display_number: true } });
      if (claim) return { source: "graph_webhook", matterId: typeof claim.matter_id === "number" ? claim.matter_id : null, matterDisplayNumber: claim.display_number };
    } catch {
      /* fall through */
    }
    // Else reuse an existing thread that already carries one of these numbers.
    const byTag = await prisma.emailThread.findFirst({
      where: { matterDisplayNumber: { in: tags } },
      select: { matterId: true, matterDisplayNumber: true, masterLawsuitId: true, clioMatterId: true, clioDisplayNumber: true, clioMaildropEmail: true, clioMaildropLabel: true },
    });
    if (byTag) return { source: "graph_webhook", ...byTag };
    // A number was present but matches no matter record yet — still tag it so the firm-wide view surfaces it.
    return { source: "graph_webhook", matterDisplayNumber: tags[0] };
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

  const matchText = [message.subject, message.bodyText, message.bodyHtml, message.bodyPreview].filter(Boolean).join("\n");
  const context = await resolveMatterContext(conversationId, matchText);
  if (!context) return { ok: true, action: "skipped", reason: "not matter-related (no tracked conversation or matter number in subject/body)" };

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
