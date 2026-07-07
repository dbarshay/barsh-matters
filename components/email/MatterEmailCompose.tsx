"use client";

// Reusable Outlook-style compose-and-send panel for native matter/lawsuit email (Phase A) via Graph.
// Sends through POST /api/graph/matter-email/send (flag-gated + operator-confirmed server-side).
// Keeps the [BRL_…] subject tag so replies stay threaded to the matter/lawsuit.

import React, { useState } from "react";
import { bmConfirm } from "@/app/components/BmDialogHost";
import FolderTree, { type FiledDoc } from "@/components/documents/FolderTree";

const OUTLOOK_BLUE = "#0078d4";
const OUTLOOK_BLUE_HOVER = "#106ebe";

type PickedAttachment = { id: string; label: string };

export default function MatterEmailCompose({
  matterId,
  masterLawsuitId,
  displayNumber,
  onSent,
  replyToGraphMessageId,
  initialTo,
  initialCc,
  initialSubject,
}: {
  matterId?: number | null;
  masterLawsuitId?: string | null;
  displayNumber?: string | null;
  onSent?: () => void;
  replyToGraphMessageId?: string | null;
  initialTo?: string | null;
  initialCc?: string | null;
  initialSubject?: string | null;
}) {
  const tag = (displayNumber || "").trim();
  const isReply = Boolean(replyToGraphMessageId);
  const [to, setTo] = useState(initialTo || "");
  const [cc, setCc] = useState(initialCc || "");
  const [subject, setSubject] = useState(initialSubject || (tag ? `[${tag}] ` : ""));
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Phase C — filed-document attachments picked from the matter/lawsuit document tree.
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);

  function toggleAttachment(doc: FiledDoc) {
    setAttachments((prev) =>
      prev.some((a) => a.id === doc.id)
        ? prev.filter((a) => a.id !== doc.id)
        : [...prev, { id: doc.id, label: doc.titleLabel || doc.fileName || "Document" }],
    );
  }
  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function send() {
    if (!to.trim()) { setMsg({ kind: "err", text: "Enter at least one recipient." }); return; }
    if (!subject.trim()) { setMsg({ kind: "err", text: "Enter a subject." }); return; }
    const ok = await bmConfirm({
      title: "Send email",
      message: `Send this email to ${to.trim()}${cc.trim() ? ` (cc ${cc.trim()})` : ""} from the firm mailbox?${attachments.length ? ` ${attachments.length} document${attachments.length === 1 ? "" : "s"} attached.` : ""}${tag ? ` It will be filed to ${tag}.` : ""}`,
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
          attachmentFiledDocumentIds: attachments.map((a) => a.id),
          confirmSend: true,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        const attNote = j.attachedCount ? ` with ${j.attachedCount} attachment${j.attachedCount === 1 ? "" : "s"}` : "";
        setMsg({ kind: "ok", text: `Sent to ${(j.sentTo || []).join(", ")}${attNote}.` });
        setTo(""); setCc(""); setSubject(tag ? `[${tag}] ` : ""); setBody(""); setAttachments([]);
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
        <button
          type="button"
          onClick={() => setAttachOpen(true)}
          disabled={sending}
          title="Attach documents filed to this matter/lawsuit"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#fff", color: OUTLOOK_BLUE, border: `1px solid ${OUTLOOK_BLUE}`,
            borderRadius: 2, padding: "6px 12px", fontWeight: 600, fontSize: 13,
            cursor: sending ? "default" : "pointer",
          }}
          data-barsh-email-attach-button="true"
        >
          <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>📎</span>
          Attach{attachments.length ? ` (${attachments.length})` : ""}
        </button>
        {isReply && <span style={{ fontSize: 12, color: "#605e5c", fontWeight: 600 }}>Reply (threaded)</span>}
        {msg && <span style={{ fontSize: 13, color: msg.kind === "ok" ? "#107c10" : "#a4262c" }}>{msg.text}</span>}
      </div>

      {/* Attached documents (chips) */}
      {attachments.length > 0 && (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 12px", borderBottom: "1px solid #edebe9", background: "#f3f9fd" }}
          data-barsh-email-attachment-chips="true"
        >
          {attachments.map((a) => (
            <span
              key={a.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#fff", border: "1px solid #cfe4f6", color: "#004578",
                borderRadius: 4, padding: "3px 6px 3px 9px", fontSize: 12, fontWeight: 600, maxWidth: 260,
              }}
            >
              <span aria-hidden>📄</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</span>
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                title="Remove attachment"
                style={{ border: "none", background: "transparent", color: "#a4262c", cursor: "pointer", fontSize: 14, fontWeight: 900, lineHeight: 1, padding: "0 2px" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

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

      {/* Attach-documents dialog: the matter/lawsuit document tree with a checkmark on each file. */}
      {attachOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 3000,
            background: "rgba(15,23,42,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
          data-barsh-email-attach-dialog="true"
        >
          <div
            style={{
              width: "min(680px, 96vw)", maxHeight: "86vh", display: "flex", flexDirection: "column",
              background: "#fff", borderRadius: 8, overflow: "hidden",
              boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #edebe9", background: "#faf9f8" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#00346e" }}>Attach documents to this email?</div>
              <div style={{ fontSize: 13, color: "#605e5c", marginTop: 2 }}>
                Click the checkmark next to each document you want to attach.
                {tag ? <> Showing documents filed to <strong>{tag}</strong>.</> : null}
              </div>
            </div>

            <div style={{ padding: "12px 18px", overflowY: "auto", flex: 1 }}>
              <FolderTree
                matterId={matterId ?? 0}
                matterDisplayNumber={tag || null}
                masterLawsuitId={masterLawsuitId ?? null}
                level={masterLawsuitId ? "lawsuit" : "matter"}
                selectable
                selectedIds={attachments.map((a) => a.id)}
                onToggleSelect={toggleAttachment}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderTop: "1px solid #edebe9", background: "#faf9f8" }}>
              <span style={{ fontSize: 13, color: "#605e5c", fontWeight: 600 }}>
                {attachments.length} selected
              </span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setAttachOpen(false)}
                style={{ border: "1px solid #cdd6e0", background: "#fff", color: "#26364a", borderRadius: 4, padding: "7px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
