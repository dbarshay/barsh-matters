"use client";

// Reusable Outlook-style compose-and-send panel for native matter/lawsuit email (Phase A) via Graph.
// Sends through POST /api/graph/matter-email/send (flag-gated + operator-confirmed server-side).
// Keeps the [BRL_…] subject tag so replies stay threaded to the matter/lawsuit.

import React, { useState } from "react";
import { bmConfirm } from "@/app/components/BmDialogHost";

const OUTLOOK_BLUE = "#0078d4";
const OUTLOOK_BLUE_HOVER = "#106ebe";

export default function MatterEmailCompose({
  matterId,
  masterLawsuitId,
  displayNumber,
  onSent,
  replyToGraphMessageId,
  initialTo,
  initialSubject,
}: {
  matterId?: number | null;
  masterLawsuitId?: string | null;
  displayNumber?: string | null;
  onSent?: () => void;
  replyToGraphMessageId?: string | null;
  initialTo?: string | null;
  initialSubject?: string | null;
}) {
  const tag = (displayNumber || "").trim();
  const isReply = Boolean(replyToGraphMessageId);
  const [to, setTo] = useState(initialTo || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(initialSubject || (tag ? `[${tag}] ` : ""));
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function send() {
    if (!to.trim()) { setMsg({ kind: "err", text: "Enter at least one recipient." }); return; }
    if (!subject.trim()) { setMsg({ kind: "err", text: "Enter a subject." }); return; }
    const ok = await bmConfirm({
      title: "Send email",
      message: `Send this email to ${to.trim()}${cc.trim() ? ` (cc ${cc.trim()})` : ""} from the firm mailbox?${tag ? ` It will be filed to ${tag}.` : ""}`,
      submitLabel: "Send",
    });
    if (!ok) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/graph/matter-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId: matterId ?? null,
          masterLawsuitId: masterLawsuitId ?? null,
          matterDisplayNumber: tag || null,
          to, cc, subject,
          body: body.replace(/\n/g, "<br>"),
          replyToMessageId: replyToGraphMessageId ?? null,
          confirmSend: true,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        setMsg({ kind: "ok", text: `Sent to ${(j.sentTo || []).join(", ")}.` });
        setTo(""); setCc(""); setSubject(tag ? `[${tag}] ` : ""); setBody("");
        onSent?.();
      } else {
        setMsg({ kind: "err", text: j?.error || "Send failed." });
      }
    } catch (err: any) {
      setMsg({ kind: "err", text: err?.message || "Send request failed." });
    } finally {
      setSending(false);
    }
  }

  const fieldRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "56px 1fr",
    alignItems: "center",
    borderBottom: "1px solid #edebe9",
    minHeight: 40,
  };
  const fieldLabel: React.CSSProperties = { fontSize: 13, color: "#605e5c", paddingLeft: 12 };
  const fieldInput: React.CSSProperties = {
    border: "none",
    outline: "none",
    fontSize: 14,
    padding: "9px 12px",
    width: "100%",
    background: "transparent",
    color: "#201f1e",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  };

  return (
    <div
      style={{
        border: "1px solid #e1dfdd",
        borderRadius: 4,
        background: "#ffffff",
        boxShadow: "0 1.6px 3.6px rgba(0,0,0,0.13), 0 0.3px 0.9px rgba(0,0,0,0.11)",
        overflow: "hidden",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Outlook command bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #edebe9", background: "#faf9f8" }}>
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          onMouseOver={(e) => { if (!sending) (e.currentTarget.style.background = OUTLOOK_BLUE_HOVER); }}
          onMouseOut={(e) => { if (!sending) (e.currentTarget.style.background = OUTLOOK_BLUE); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: sending ? "#a19f9d" : OUTLOOK_BLUE, color: "#fff", border: "none",
            borderRadius: 2, padding: "7px 18px", fontWeight: 600, fontSize: 14,
            cursor: sending ? "default" : "pointer",
          }}
        >
          <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>➤</span>
          {sending ? "Sending…" : isReply ? "Send reply" : "Send"}
        </button>
        {isReply && <span style={{ fontSize: 12, color: "#605e5c", fontWeight: 600 }}>Reply (threaded)</span>}
        {msg && <span style={{ fontSize: 13, color: msg.kind === "ok" ? "#107c10" : "#a4262c" }}>{msg.text}</span>}
      </div>

      {/* Recipient + subject rows (Outlook underlined fields) */}
      <div style={fieldRow}>
        <span style={fieldLabel}>To</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="" style={fieldInput} />
      </div>
      <div style={fieldRow}>
        <span style={fieldLabel}>Cc</span>
        <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="" style={fieldInput} />
      </div>
      <div style={{ ...fieldRow, gridTemplateColumns: "1fr" }}>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Add a subject" style={{ ...fieldInput, fontWeight: 600 }} />
      </div>

      {/* Body */}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={12}
        placeholder=""
        style={{ ...fieldInput, resize: "vertical", minHeight: 220, padding: 14, display: "block" }}
      />

      {tag ? (
        <div style={{ fontSize: 12, color: "#605e5c", padding: "6px 14px 12px" }}>
          The tag <strong>[{tag}]</strong> is kept on the subject so replies stay threaded.
        </div>
      ) : null}
    </div>
  );
}
