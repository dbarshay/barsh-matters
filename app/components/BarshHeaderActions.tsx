"use client";

import React from "react";

type BarshHeaderActionsProps = {
  onAdministratorClick?: () => void;
};

const actionRowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  whiteSpace: "nowrap",
  flexWrap: "wrap",
  transform: "translateX(48px)",
};

const baseActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 30,
  padding: "7px 11px",
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#f8fafc",
  color: "#475569",
  fontSize: 12,
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

export default function BarshHeaderActions({ onAdministratorClick }: BarshHeaderActionsProps) {
  const administratorContent = (
    <>
      <span aria-hidden="true">🔐</span>
      <span>Administrator</span>
    </>
  );

  return (
    <nav aria-label="Barsh Matters header actions" style={actionRowStyle}>
      <a href="/lawsuits" title="Open the top-level Create Lawsuits workflow." style={baseActionStyle}>
        <span>Create Lawsuits</span>
      </a>

      <a href="/print-queue" title="Open Daily Print Queue." style={baseActionStyle}>
        <span aria-hidden="true">🖨️</span>
        <span>Print Queue</span>
      </a>

      <a href="/court-calendar" title="Open Court Calendar." style={baseActionStyle} data-barsh-court-calendar-header-link="true">
        <span>Court Calendar</span>
      </a>

      <a
        href="/admin"
        onClick={onAdministratorClick}
        title="Open Administrator Home."
        style={baseActionStyle}
        data-barsh-header-administrator-link="true"
      >
        {administratorContent}
      </a>
    </nav>
  );
}
