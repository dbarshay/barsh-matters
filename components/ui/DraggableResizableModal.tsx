"use client";

// A large, draggable, resizable modal window (Outlook-style). Drag by the header; resize from the
// bottom-right corner. The body is a flex column that fills the window, so a child can set height:100%
// and get its own internal scrolling (e.g. the email inbox's three panes).

import React, { useCallback, useEffect, useRef, useState } from "react";

const MIN_W = 760;
const MIN_H = 480;

export default function DraggableResizableModal({
  title,
  onClose,
  initialWidth = 1180,
  initialHeight = 760,
  headerBg = "#00346e",
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  initialWidth?: number;
  initialHeight?: number;
  headerBg?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const clampSize = (w: number, h: number) => ({
    w: Math.max(MIN_W, Math.min(w, typeof window !== "undefined" ? window.innerWidth - 24 : w)),
    h: Math.max(MIN_H, Math.min(h, typeof window !== "undefined" ? window.innerHeight - 24 : h)),
  });

  const [size, setSize] = useState(() => clampSize(initialWidth, initialHeight));
  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 80, y: 60 };
    const s = clampSize(initialWidth, initialHeight);
    return { x: Math.max(12, (window.innerWidth - s.w) / 2), y: Math.max(12, (window.innerHeight - s.h) / 2) };
  });

  const drag = useRef<{ mode: "move" | "resize"; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.mode === "move") {
      const maxX = window.innerWidth - 40;
      const maxY = window.innerHeight - 40;
      setPos({ x: Math.min(Math.max(-d.origW + 120, d.origX + dx), maxX), y: Math.min(Math.max(0, d.origY + dy), maxY) });
    } else {
      setSize(clampSize(d.origW + dx, d.origH + dy));
    }
  }, []);

  const stop = useCallback(() => {
    drag.current = null;
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stop);
    };
  }, [onMouseMove, stop]);

  function startMove(e: React.MouseEvent) {
    drag.current = { mode: "move", startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, origW: size.w, origH: size.h };
    document.body.style.userSelect = "none";
  }
  function startResize(e: React.MouseEvent) {
    e.stopPropagation();
    drag.current = { mode: "resize", startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, origW: size.w, origH: size.h };
    document.body.style.userSelect = "none";
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15, 23, 42, 0.45)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: pos.x,
          top: pos.y,
          width: size.w,
          height: size.h,
          display: "flex",
          flexDirection: "column",
          border: "1px solid #cbd5e1",
          borderRadius: 14,
          background: "#ffffff",
          boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)",
          overflow: "hidden",
        }}
      >
        <div
          onMouseDown={startMove}
          style={{
            display: "grid",
            gridTemplateColumns: "90px minmax(0, 1fr) 90px",
            alignItems: "center",
            gap: 14,
            padding: "14px 20px",
            background: headerBg,
            cursor: "move",
            flex: "0 0 auto",
            userSelect: "none",
          }}
        >
          <div aria-hidden="true" />
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 950, color: "#ffffff", textAlign: "center" }}>{title}</h2>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ border: "none", background: "transparent", color: "#ffffff", fontSize: 22, fontWeight: 900, lineHeight: 1, cursor: "pointer", padding: "0 4px" }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {children}
        </div>

        {footer ? <div style={{ flex: "0 0 auto" }}>{footer}</div> : null}

        {/* Resize handle (bottom-right) */}
        <div
          onMouseDown={startResize}
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 18,
            height: 18,
            cursor: "nwse-resize",
            background: "linear-gradient(135deg, transparent 50%, #94a3b8 50%, #94a3b8 60%, transparent 60%, transparent 72%, #94a3b8 72%, #94a3b8 82%, transparent 82%)",
          }}
        />
      </div>
    </div>
  );
}
