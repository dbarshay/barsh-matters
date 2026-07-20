"use client";

import React, { useEffect, useRef, useState } from "react";

// Single source of truth for the standard Barsh Matters popup modal.
//
// Standard look (previously duplicated inline across pages):
//   - dark translucent backdrop, modal centered
//   - navy (#00346e) header bar with a centered title, NO top-right close glyph
//   - white rounded card body
//   - footer with an explicit Close/Cancel button and an optional primary action button
//
// Behavior:
//   - Draggable by its header bar
//   - Resizable from the bottom-right corner (native CSS resize)
//   - Esc fires the close/cancel action; Enter fires the primary action (onSubmit)
//     — Enter is ignored while focus is in a <textarea> or contentEditable so multi-line
//     entry still works.

type BarshModalProps = {
  open?: boolean;
  title: React.ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  closeLabel?: string;
  /** Replace the default footer entirely (Enter still calls onSubmit if provided). */
  footer?: React.ReactNode;
  /** Hide the default footer (e.g. read-only popups). */
  hideFooter?: boolean;
  initialWidth?: number;
  initialHeight?: number;
  closeOnBackdrop?: boolean;
  /** data-* hook for tests / standardization checks. */
  dataModalId?: string;
  children: React.ReactNode;
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "rgba(15, 23, 42, 0.45)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "12px 16px",
  background: "#00346e",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 800,
  textAlign: "center",
  cursor: "move",
  userSelect: "none",
  flexShrink: 0,
};

const bodyStyle: React.CSSProperties = {
  padding: 18,
  overflow: "auto",
  flex: "1 1 auto",
  minHeight: 0,
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  padding: "12px 16px",
  borderTop: "1px solid #e5e7eb",
  flexShrink: 0,
};

// Close / Cancel = red (uniform across all standard modals).
const closeButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid #dc2626",
  background: "#dc2626",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

// Standard Barsh Matters blue primary button (white lettering).
const submitButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid #00346e",
  background: "#00346e",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

export default function BarshModal({
  open = true,
  title,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
  closeLabel = "Close",
  footer,
  hideFooter,
  initialWidth = 560,
  initialHeight,
  closeOnBackdrop = false,
  dataModalId,
  children,
}: BarshModalProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ clientX: number; clientY: number; baseX: number; baseY: number } | null>(null);

  // Esc closes; Enter submits (unless typing in a textarea / contentEditable / IME compose).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Enter" && !event.shiftKey && onSubmit && !submitDisabled) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "TEXTAREA" || target?.isContentEditable || (event as any).isComposing) return;
        event.preventDefault();
        onSubmit();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onSubmit, submitDisabled]);

  // Drag by the header.
  useEffect(() => {
    if (!dragging) return;
    function onMove(event: PointerEvent) {
      const start = dragStart.current;
      if (!start) return;
      setPos({ x: start.baseX + (event.clientX - start.clientX), y: start.baseY + (event.clientY - start.clientY) });
    }
    function onUp() {
      setDragging(false);
      dragStart.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  if (!open) return null;

  const cardStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: initialWidth,
    height: initialHeight,
    maxWidth: "95vw",
    maxHeight: "90vh",
    minWidth: 320,
    minHeight: 160,
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.35)",
    overflow: "hidden",
    resize: "both",
    transform: `translate(${pos.x}px, ${pos.y}px)`,
  };

  return (
    <div
      style={backdropStyle}
      data-barsh-modal-backdrop="true"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div style={cardStyle} data-barsh-standard-modal="true" data-barsh-modal-id={dataModalId} role="dialog" aria-modal="true">
        <div
          style={headerStyle}
          data-barsh-modal-header="true"
          onPointerDown={(event) => {
            dragStart.current = { clientX: event.clientX, clientY: event.clientY, baseX: pos.x, baseY: pos.y };
            setDragging(true);
          }}
        >
          {title}
        </div>

        <div style={bodyStyle}>{children}</div>

        {!hideFooter && (
          <div style={footerStyle}>
            {footer ?? (
              <>
                <button type="button" style={closeButtonStyle} onClick={onClose} data-barsh-modal-close="true">
                  {closeLabel}
                </button>
                {submitLabel && onSubmit && (
                  <button
                    type="button"
                    style={{ ...submitButtonStyle, opacity: submitDisabled ? 0.5 : 1, cursor: submitDisabled ? "not-allowed" : "pointer" }}
                    onClick={onSubmit}
                    disabled={submitDisabled}
                    data-barsh-modal-submit="true"
                  >
                    {submitLabel}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
