"use client";

import { FormEvent, useState } from "react";

const GLOBAL_QUICK_NAV_OFFSET_PX = 24;
const GLOBAL_QUICK_NAV_RAISE_PX = -8;

function cleanInput(value: string): string {
  return String(value || "").trim();
}

function normalizeBrl(value: string): string {
  const raw = cleanInput(value).toUpperCase();
  if (/^\d{5,}$/.test(raw)) return `BRL${raw}`;
  if (/^BRL\d+$/i.test(raw)) return raw.toUpperCase();
  return raw;
}

function looksLikeMasterLawsuitId(value: string): boolean {
  return /^\d{4}\.\d{2}\.\d{5}$/.test(cleanInput(value));
}

export default function BarshHeaderQuickNav() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function openTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const raw = cleanInput(query);
    if (!raw) {
      window.location.href = "/";
      return;
    }

    setStatus("");
    setLoading(true);

    try {
      if (looksLikeMasterLawsuitId(raw)) {
        window.location.href = `/matters?master=${encodeURIComponent(raw)}`;
        return;
      }

      const displayNumber = normalizeBrl(raw);

      if (/^BRL\d+$/i.test(displayNumber)) {
        const response = await fetch(
          `/api/claim-index/by-matter?displayNumber=${encodeURIComponent(displayNumber)}`,
          { cache: "no-store" }
        );

        const json = await response.json();
        const resolvedMatter =
          json?.matters?.[0] ||
          json?.matter ||
          json?.overlay ||
          json?.row ||
          json;
        const resolvedDisplayNumber =
          resolvedMatter?.displayNumber ||
          resolvedMatter?.display_number ||
          json?.displayNumber ||
          json?.display_number ||
          displayNumber;
        const matterId = resolvedMatter?.id || json?.matterId || json?.id;

        if (!response.ok || !json?.ok || (!resolvedDisplayNumber && !matterId)) {
          setStatus(`No matter found for ${displayNumber}.`);
          return;
        }

        window.location.href = `/matter/${encodeURIComponent(resolvedDisplayNumber || matterId)}`;
        return;
      }

      setStatus("Enter a BRL number or lawsuit number.");
    } catch (error: any) {
      setStatus(error?.message || "Could not open that number.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={openTarget}
      style={{
          marginLeft: GLOBAL_QUICK_NAV_OFFSET_PX,
          transform: `translateY(${GLOBAL_QUICK_NAV_RAISE_PX}px)`,
        display: "grid",
        gridTemplateColumns: "minmax(170px, 230px) auto auto",
        alignItems: "center",
        gap: 6,
        padding: "7px 9px",
        border: "1px solid #cbd5e1",
        borderRadius: 999,
        background: "#ffffff",
        boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
      }}
      title="Open a BRL matter or master lawsuit number."
    >
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setStatus("");
        }}
        placeholder="BRL or Lawsuit #"
        style={{
          minWidth: 0,
          height: 30,
          border: "1px solid #e2e8f0",
          borderRadius: 999,
          padding: "0 10px",
          color: "#00346e",
          fontSize: 12,
          fontWeight: 800,
          outline: "none",
          background: "#f8fafc",
        }}
      />

      <button
        type="submit"
        disabled={loading}
        style={{
          height: 30,
          border: loading ? "1px solid #bfdbfe" : "1px solid #00346e",
          borderRadius: 999,
          background: loading ? "#bfdbfe" : "#00346e",
          color: "#ffffff",
          fontSize: 12,
          fontWeight: 900,
          padding: "0 12px",
          cursor: loading ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {loading ? "Opening..." : "Open"}
      </button>

      <a
        href="/"
        title="Return to Barsh Matters landing page"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: 30,
          border: "1px solid #cbd5e1",
          borderRadius: 999,
          background: "#f8fafc",
          color: "#385a83",
          fontSize: 12,
          fontWeight: 900,
          padding: "0 12px",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Home
      </a>

      {status && (
        <div
          style={{
            gridColumn: "1 / -1",
            color: "#991b1b",
            fontSize: 11,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          {status}
        </div>
      )}
    </form>
  );
}
