"use client";

// Firm-wide Emails button for the header. Shows the logged-in user's own unread matter-email count
// (server derives the mailbox from the session), and opens the Outlook-style inbox scoped to every
// matter/lawsuit in the user's mailbox — so a user sees new mail without being inside a specific matter.

import React, { useCallback, useEffect, useState } from "react";
import DraggableResizableModal from "@/components/ui/DraggableResizableModal";
import MatterEmailInbox from "@/components/email/MatterEmailInbox";

const actionStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 30,
  padding: "7px 10px",
  border: "1px solid rgba(255, 255, 255, 0.35)",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.08)",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

export default function GlobalEmailInboxButton() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/graph/matter-email/unread-count?scope=all", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (typeof j?.unread === "number") setUnread(j.unread);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open your matter email inbox (all matters)."
        style={actionStyle}
        data-barsh-header-emails-button="true"
      >
        <span aria-hidden="true">✉️</span>
        <span>Emails</span>
        {unread > 0 && (
          <span
            data-barsh-header-emails-unread-badge="true"
            title={`${unread} unread incoming email${unread === 1 ? "" : "s"}`}
            style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 999, background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px", border: "2px solid #00346e" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <DraggableResizableModal title="Emails" onClose={() => { setOpen(false); void refresh(); }} initialWidth={1200} initialHeight={780}>
          <MatterEmailInbox scope="all" onChanged={() => { void refresh(); }} />
        </DraggableResizableModal>
      )}
    </>
  );
}
