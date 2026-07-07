// Send a native email from a matter via Microsoft Graph, threaded to the matter.
//
// Uses draft-then-send (create the message, then POST /send) so we capture the real conversationId /
// internetMessageId / webLink and can thread replies (Phase B) and file inbound attachments (Phase D)
// against the same thread. Records an outbound EmailThread + EmailMessage + EmailMatterLink. The send
// is the primary action; the local record is best-effort. Gated by the caller (flag + operator confirm).

import { prisma } from "@/lib/prisma";
import { assertGraphDraftEnvironmentReady, graphApiBase, graphFetchJson } from "@/lib/graph/client";

export type SendMatterEmailInput = {
  matterId?: number | null;
  matterDisplayNumber?: string | null;
  masterLawsuitId?: string | null;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  actorEmail?: string | null;
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

export async function sendMatterEmail(input: SendMatterEmailInput): Promise<SendMatterEmailResult> {
  const to = (input.to || []).map((e) => e.trim()).filter(Boolean);
  const cc = (input.cc || []).map((e) => e.trim()).filter(Boolean);
  if (to.length === 0) return { ok: false, error: "At least one recipient (To) is required." };

  const env = assertGraphDraftEnvironmentReady();
  if (!env.ok) return { ok: false, error: env.error };
  const mailbox = env.mailboxUserId;
  const base = graphApiBase();
  const subject = ensureMatterSubjectTag(input.subject, input.matterDisplayNumber);

  // 1) Create the draft (captures the real ids).
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
  const msg: any = draft.json || {};
  const graphMessageId: string | undefined = msg.id;

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
    const thread = await db.emailThread.create({
      data: {
        conversationId: String(msg.conversationId || `matter-compose-${graphMessageId || now.getTime()}`),
        internetMessageId: msg.internetMessageId ?? null,
        mailboxUserId: mailbox,
        subject,
        normalizedSubject: normalizeSubject(subject),
        latestMessageAt: now,
        lastSyncedAt: now,
        direction: "outbound",
        source: "matter-compose",
        matterId: input.matterId ?? null,
        matterDisplayNumber: input.matterDisplayNumber ?? null,
        masterLawsuitId: input.masterLawsuitId ?? null,
        status: "active",
      },
    });
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
  };
}
