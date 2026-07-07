"use client";

// Outlook-style email inbox for a matter/lawsuit: a flat, date-sorted list (unread highlighted, read
// muted) on the left and a reading pane on the right. Click an email to read it (marks it read),
// Reply / Reply All / Delete like Outlook, and review inbound attachments inline under the message.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { bmConfirm } from "@/app/components/BmDialogHost";
import MatterEmailCompose from "@/components/email/MatterEmailCompose";
import InboundAttachmentReview from "@/components/email/InboundAttachmentReview";

type Msg = {
  id: string;
  graphMessageId: string | null;
  conversationId: string | null;
  direction: string | null;
  isRead: boolean | null;
  isSent: boolean | null;
  subject: string | null;
  from: string | null;
  fromEmail: string | null;
  toRecipients: any;
  ccRecipients: any;
  receivedAt: string | null;
  sentAt: string | null;
  hasAttachments: boolean | null;
  bodyHtml: string | null;
  bodyPreview: string | null;
};

function asList(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  return [];
}
function isInbound(m: Msg): boolean {
  return m.direction === "inbound";
}
function isUnread(m: Msg): boolean {
  return isInbound(m) && m.isRead !== true;
}
function senderLabel(m: Msg): string {
  if (isInbound(m)) return m.from || m.fromEmail || "Unknown sender";
  const to = asList(m.toRecipients);
  return to.length ? `To: ${to[0]}${to.length > 1 ? ` +${to.length - 1}` : ""}` : "Sent";
}
function whenOf(m: Msg): number {
  const raw = m.receivedAt || m.sentAt;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}
function timeLabel(m: Msg): string {
  const raw = m.receivedAt || m.sentAt;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yst = new Date(now);
  yst.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yst.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

export default function MatterEmailInbox({
  matterId,
  masterLawsuitId,
  matterDisplayNumber,
  displayNumber,
  onChanged,
}: {
  matterId?: number | null;
  masterLawsuitId?: string | null;
  matterDisplayNumber?: string | null;
  displayNumber?: string | null;
  onChanged?: () => void;
}) {
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState<{ mode: "reply" | "replyAll"; msg: Msg } | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useMemo(() => {
    if (Number.isFinite(matterId as number) && (matterId as number) > 0) return `matterId=${matterId}`;
    if (masterLawsuitId) return `masterLawsuitId=${encodeURIComponent(masterLawsuitId)}`;
    if (matterDisplayNumber) return `matterDisplayNumber=${encodeURIComponent(matterDisplayNumber)}`;
    return "";
  }, [matterId, masterLawsuitId, matterDisplayNumber]);

  const load = useCallback(async () => {
    if (!query) return;
    setError(null);
    try {
      const res = await fetch(`/api/graph/matter-email/messages?${query}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) setMessages((j.messages as Msg[]).slice().sort((a, b) => whenOf(b) - whenOf(a)));
      else setError(j?.error || "Failed to load emails.");
    } catch {
      setError("Failed to load emails.");
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => (messages || []).find((m) => m.id === selectedId) || null, [messages, selectedId]);

  async function openMessage(m: Msg) {
    setSelectedId(m.id);
    setReply(null);
    if (isUnread(m)) {
      setMessages((cur) => (cur || []).map((x) => (x.id === m.id ? { ...x, isRead: true } : x)));
      try {
        await fetch("/api/graph/matter-email/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: m.id, isRead: true }),
        });
        onChanged?.();
      } catch {
        /* non-fatal */
      }
    }
  }

  async function deleteMessage(m: Msg) {
    const ok = await bmConfirm({ title: "Delete email", message: `Move this email from ${senderLabel(m)} to Deleted Items?`, submitLabel: "Delete" });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/graph/matter-email/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: m.id, confirmDelete: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        setMessages((cur) => (cur || []).filter((x) => x.id !== m.id));
        if (selectedId === m.id) setSelectedId(null);
        onChanged?.();
      } else setError(j?.error || "Delete failed.");
    } catch {
      setError("Delete request failed.");
    } finally {
      setBusy(false);
    }
  }

  function replyContext(mode: "reply" | "replyAll", m: Msg) {
    const to = isInbound(m) ? m.fromEmail || "" : asList(m.toRecipients).join(", ");
    if (mode === "reply") return { to, cc: "" };
    const allTo = [m.fromEmail || "", ...asList(m.toRecipients)].filter(Boolean);
    return { to: Array.from(new Set(allTo)).join(", "), cc: asList(m.ccRecipients).join(", ") };
  }

  const listStyle: React.CSSProperties = { flex: "0 0 46%", maxWidth: "46%", borderRight: "1px solid #e6e8eb", overflowY: "auto" };
  const paneStyle: React.CSSProperties = { flex: 1, overflowY: "auto", background: "#fff" };

  return (
    <div style={{ border: "1px solid #e1dfdd", borderRadius: 8, overflow: "hidden", background: "#fff" }} data-barsh-email-inbox="true">
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #e6e8eb", background: "#faf9f8" }}>
        <strong style={{ fontSize: 16, color: "#00346e" }}>Inbox</strong>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => void load()}
          style={{ border: "1px solid #cdd6e0", borderRadius: 6, background: "#fff", color: "#26364a", fontSize: 12, fontWeight: 800, padding: "5px 12px", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      {error && <div style={{ color: "#b00020", padding: 10, fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", height: 560 }}>
        {/* Left — the flat, date-sorted list */}
        <div style={listStyle}>
          {messages === null ? (
            <div style={{ color: "#8a97a8", padding: 12, fontSize: 13 }}>Loading…</div>
          ) : messages.length === 0 ? (
            <div style={{ color: "#8a97a8", padding: 12, fontSize: 13, fontStyle: "italic" }}>No emails yet.</div>
          ) : (
            messages.map((m) => {
              const unread = isUnread(m);
              const active = m.id === selectedId;
              return (
                <div
                  key={m.id}
                  onClick={() => void openMessage(m)}
                  style={{
                    display: "grid",
                    gap: 2,
                    padding: "9px 12px 9px 13px",
                    borderBottom: "1px solid #eef0f2",
                    borderLeft: unread ? "3px solid #2563eb" : "3px solid transparent",
                    background: active ? "#e8eefb" : unread ? "#eff4ff" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: unread ? 900 : 700, color: unread ? "#0b57d0" : "#1b2a3d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {senderLabel(m)}
                    </span>
                    {m.hasAttachments ? <span aria-hidden style={{ color: "#5a6b80", fontSize: 12 }}>📎</span> : null}
                    <span style={{ fontSize: 12, color: unread ? "#0b57d0" : "#8a97a8", fontWeight: unread ? 800 : 600, whiteSpace: "nowrap" }}>{timeLabel(m)}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: unread ? 800 : 600, color: unread ? "#111827" : "#33415a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.subject || "(no subject)"}
                  </div>
                  <div style={{ fontSize: 12, color: "#8a97a8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.bodyPreview || ""}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right — reading pane */}
        <div style={paneStyle}>
          {!selected ? (
            <div style={{ color: "#8a97a8", padding: 24, fontSize: 14, textAlign: "center" }}>Select an email to read it.</div>
          ) : (
            <div style={{ display: "grid", gap: 12, padding: 16 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setReply({ mode: "reply", msg: selected })} style={actionBtn}>↩︎ Reply</button>
                <button type="button" onClick={() => setReply({ mode: "replyAll", msg: selected })} style={actionBtn}>↩︎ Reply All</button>
                <div style={{ flex: 1 }} />
                <button type="button" onClick={() => void deleteMessage(selected)} disabled={busy} style={{ ...actionBtn, borderColor: "#fecaca", color: "#b91c1c", background: "#fef2f2" }}>🗑 Delete</button>
              </div>

              <div style={{ borderBottom: "1px solid #eef0f2", paddingBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#00346e" }}>From: {senderLabel(selected)}</div>
                <div style={{ fontSize: 12, color: "#5a6b80", marginTop: 3 }}>{selected.subject || "(no subject)"}</div>
                <div style={{ fontSize: 11, color: "#8a97a8", marginTop: 2 }}>{timeLabel(selected)}</div>
              </div>

              {reply && reply.msg.id === selected.id ? (
                <MatterEmailCompose
                  key={`${reply.mode}-${selected.id}`}
                  matterId={Number.isFinite(matterId as number) ? (matterId as number) : null}
                  masterLawsuitId={masterLawsuitId ?? null}
                  displayNumber={displayNumber ?? matterDisplayNumber ?? null}
                  replyToGraphMessageId={selected.graphMessageId}
                  initialTo={replyContext(reply.mode, selected).to}
                  initialCc={replyContext(reply.mode, selected).cc}
                  onSent={() => { setReply(null); void load(); onChanged?.(); }}
                />
              ) : (
                <iframe
                  title="Email body"
                  sandbox=""
                  srcDoc={selected.bodyHtml || `<pre style="font-family:system-ui;white-space:pre-wrap">${(selected.bodyPreview || "").replace(/</g, "&lt;")}</pre>`}
                  style={{ width: "100%", minHeight: 300, border: "1px solid #eef0f2", borderRadius: 6, background: "#fff" }}
                />
              )}

              {/* Inbound attachments that arrived on this email — reviewed inline. */}
              {isInbound(selected) && selected.hasAttachments ? (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: "#00346e", margin: "0 0 6px" }}>Attachments</div>
                  <InboundAttachmentReview
                    matterId={Number.isFinite(matterId as number) ? (matterId as number) : null}
                    masterLawsuitId={masterLawsuitId ?? null}
                    conversationId={selected.conversationId}
                    onChanged={() => { onChanged?.(); }}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  border: "1px solid #cdd6e0",
  borderRadius: 6,
  background: "#fff",
  color: "#00346e",
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 12px",
  cursor: "pointer",
};
