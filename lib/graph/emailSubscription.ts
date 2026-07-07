// Microsoft Graph subscription lifecycle for real-time inbound email — PER USER. Every active user's
// own BRL mailbox gets its own change-notification subscription (there is no shared firm mailbox). The
// renewal cron ensures a live subscription for each active user, so newly-added users are picked up
// automatically; creating a user also provisions immediately. Subscriptions self-heal (create/renew/
// recreate) and are mirrored in the GraphSubscription table (one row per mailbox). No mail is read here.

import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthReadiness } from "@/lib/graph/config";
import { getWebhookClientState, getWebhookNotificationUrl, isEmailWebhookEnabled } from "@/lib/graph/webhookConfig";
import { listActiveUserMailboxes } from "@/lib/graph/userMailbox";
import { prisma } from "@/lib/prisma";

const CHANGE_TYPE = "created,updated,deleted";
// Graph caps message subscriptions at 4230 minutes (~2.94 days); renew to a hair under that.
const RENEW_TARGET_MINUTES = 4000;
// Renew when the current subscription has less than this long left (the cron runs well inside this).
const RENEW_WHEN_UNDER_MINUTES = 1440; // 24h

function db() {
  return prisma as any;
}
function resourceForMailbox(mailbox: string): string {
  return `/users/${mailbox}/messages`;
}
function targetExpirationIso(): string {
  return new Date(Date.now() + RENEW_TARGET_MINUTES * 60_000).toISOString();
}

export type PerMailboxResult = {
  ok: boolean;
  mailbox: string;
  action: "created" | "renewed" | "recreated" | "noop" | "error";
  subscriptionId?: string;
  expirationDateTime?: string;
  error?: string;
  reason?: string;
};

export type EnsureSubscriptionResult = {
  ok: boolean;
  action: "ensured" | "error";
  error?: string;
  mailboxes?: number;
  results?: PerMailboxResult[];
};

function commonPreflight(): { ok: true; notificationUrl: string; clientState: string } | { ok: false; error: string } {
  if (!isEmailWebhookEnabled()) return { ok: false, error: "Email webhook disabled (BARSH_EMAIL_WEBHOOK_ENABLED != 1)." };
  const readiness = getGraphAuthReadiness();
  if (!readiness.appOnlyTokenConfigReady) return { ok: false, error: "Microsoft Graph app credentials are not configured (tenant/client/secret)." };
  const clientState = getWebhookClientState();
  if (!clientState) return { ok: false, error: "BARSH_EMAIL_WEBHOOK_CLIENT_STATE is not set — refusing to subscribe without a notification secret." };
  const notificationUrl = getWebhookNotificationUrl();
  if (!/^https:\/\//i.test(notificationUrl)) return { ok: false, error: "A public HTTPS notification URL is required (set BARSH_EMAIL_WEBHOOK_URL or a public base URL)." };
  return { ok: true, notificationUrl, clientState };
}

async function createSubscriptionForMailbox(mailbox: string, notificationUrl: string, clientState: string): Promise<PerMailboxResult> {
  const expirationDateTime = targetExpirationIso();
  const res = await graphFetchJson({
    url: `${graphApiBase()}/subscriptions`,
    method: "POST",
    body: {
      changeType: CHANGE_TYPE,
      notificationUrl,
      resource: resourceForMailbox(mailbox),
      expirationDateTime,
      clientState,
      latestSupportedTlsVersion: "v1_2",
    },
  });
  if (!res.ok) return { ok: false, mailbox, action: "error", error: `create failed: ${res.error}` };

  const sub = res.json || {};
  const subscriptionId = String(sub.id || "");
  try {
    // One active subscription per mailbox: retire stale local rows for THIS mailbox only.
    await db().graphSubscription.updateMany({ where: { mailboxUserId: mailbox, status: "active" }, data: { status: "retired" } });
    await db().graphSubscription.upsert({
      where: { subscriptionId },
      update: { resource: resourceForMailbox(mailbox), changeType: CHANGE_TYPE, notificationUrl, clientState, mailboxUserId: mailbox, expirationDateTime: new Date(sub.expirationDateTime || expirationDateTime), status: "active", lastRenewedAt: new Date() },
      create: { subscriptionId, resource: resourceForMailbox(mailbox), changeType: CHANGE_TYPE, notificationUrl, clientState, mailboxUserId: mailbox, expirationDateTime: new Date(sub.expirationDateTime || expirationDateTime), status: "active", lastRenewedAt: new Date() },
    });
  } catch {
    /* best-effort mirror */
  }
  return { ok: true, mailbox, action: "created", subscriptionId, expirationDateTime: String(sub.expirationDateTime || expirationDateTime) };
}

async function renewSubscriptionRow(row: any, notificationUrl: string, clientState: string): Promise<PerMailboxResult> {
  const mailbox = String(row.mailboxUserId || "");
  const expirationDateTime = targetExpirationIso();
  const res = await graphFetchJson({
    url: `${graphApiBase()}/subscriptions/${encodeURIComponent(row.subscriptionId)}`,
    method: "PATCH",
    body: { expirationDateTime },
  });
  if (res.ok) {
    try {
      await db().graphSubscription.update({ where: { subscriptionId: row.subscriptionId }, data: { expirationDateTime: new Date(res.json?.expirationDateTime || expirationDateTime), status: "active", lastRenewedAt: new Date() } });
    } catch {
      /* best-effort */
    }
    return { ok: true, mailbox, action: "renewed", subscriptionId: row.subscriptionId, expirationDateTime: String(res.json?.expirationDateTime || expirationDateTime) };
  }
  // 404/410 => gone on Graph; self-heal by recreating.
  if (res.status === 404 || res.status === 410) {
    try {
      await db().graphSubscription.update({ where: { subscriptionId: row.subscriptionId }, data: { status: "expired" } });
    } catch {
      /* best-effort */
    }
    const created = await createSubscriptionForMailbox(mailbox, notificationUrl, clientState);
    return created.ok ? { ...created, action: "recreated" } : created;
  }
  return { ok: false, mailbox, action: "error", error: `renew failed: ${res.error}` };
}

/** Idempotent self-heal for ONE mailbox: create if none, renew if near expiry, recreate if gone. */
export async function ensureSubscriptionForMailbox(mailbox: string): Promise<PerMailboxResult> {
  const pre = commonPreflight();
  if (!pre.ok) return { ok: false, mailbox, action: "error", error: pre.error };
  const address = String(mailbox || "").trim().toLowerCase();
  if (!address.includes("@")) return { ok: false, mailbox, action: "error", error: "Invalid mailbox address." };

  let active: any = null;
  try {
    active = await db().graphSubscription.findFirst({ where: { mailboxUserId: address, status: "active" }, orderBy: { expirationDateTime: "desc" } });
  } catch {
    active = null;
  }
  if (!active) return createSubscriptionForMailbox(address, pre.notificationUrl, pre.clientState);

  const minutesLeft = (new Date(active.expirationDateTime).getTime() - Date.now()) / 60_000;
  if (minutesLeft <= RENEW_WHEN_UNDER_MINUTES) return renewSubscriptionRow(active, pre.notificationUrl, pre.clientState);
  return { ok: true, mailbox: address, action: "noop", subscriptionId: active.subscriptionId, expirationDateTime: new Date(active.expirationDateTime).toISOString(), reason: `Healthy (${Math.round(minutesLeft)} min left).` };
}

/** Ensure a live subscription for EVERY active user mailbox. Safe to call on a schedule / on user create. */
export async function ensureEmailSubscription(): Promise<EnsureSubscriptionResult> {
  const pre = commonPreflight();
  if (!pre.ok) return { ok: false, action: "error", error: pre.error };
  const mailboxes = await listActiveUserMailboxes();
  const results: PerMailboxResult[] = [];
  for (const mailbox of mailboxes) {
    results.push(await ensureSubscriptionForMailbox(mailbox));
  }
  return { ok: results.every((r) => r.ok), action: "ensured", mailboxes: mailboxes.length, results };
}
