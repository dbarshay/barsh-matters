"use client";

import React from "react";
import GlobalEmailInboxButton from "@/app/components/GlobalEmailInboxButton";

type BarshHeaderActionsProps = {
  onAdministratorClick?: () => void;
};

const actionRowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 6,
  whiteSpace: "nowrap",
  flexWrap: "nowrap",
};

const baseActionStyle: React.CSSProperties = {
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
  textDecoration: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const signOutActionStyle: React.CSSProperties = {
  ...baseActionStyle,
  border: "1px solid #dc2626",
  background: "#dc2626",
  color: "#ffffff",
};

export default function BarshHeaderActions({ onAdministratorClick }: BarshHeaderActionsProps) {
  async function signOutAdministrator() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      window.location.href = "/login?from=/admin";
    }
  }

  const administratorContent = (
    <>
      <span aria-hidden="true">🔐</span>
      <span>Administrator</span>
    </>
  );

  return (
    <nav aria-label="Barsh Matters header actions" style={actionRowStyle}>
      <GlobalEmailInboxButton />

      <a href="/lawsuits" title="Open the top-level Create Lawsuits workflow." style={baseActionStyle}>
        <span>Create Lawsuits</span>
      </a>

      <a href="/print-queue" title="Open Daily Print Queue." style={baseActionStyle}>
        <span aria-hidden="true">🖨️</span>
        <span>Print Queue</span>
      </a>

      <a
        href="/admin/documents/upload"
        title="Upload a document to a matter (OCR-assisted, filed to Clio)."
        style={baseActionStyle}
        data-barsh-header-upload-docs-link="true"
      >
        <span aria-hidden="true">📤</span>
        <span>Upload Docs</span>
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

      <button
        type="button"
        onClick={() => void signOutAdministrator()}
        title="Sign out of Administrator session."
        style={signOutActionStyle}
        data-barsh-header-signout-button="true"
      >
        <span>Sign Out</span>
      </button>
    </nav>
  );
}
