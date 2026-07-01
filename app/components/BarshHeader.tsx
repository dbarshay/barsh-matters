"use client";

import React from "react";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import BarshHeaderActions from "@/app/components/BarshHeaderActions";

// Single source of truth for the standard Barsh Matters page header.
//
// Layout is a flex row with three clusters:
//   - left (anchored):   BRL logo + quick-nav search
//   - center (flexible): page-specific content (e.g. file number / matter info)
//   - right (anchored):  header actions tucked next to the Barsh Matters logo (links home)
//
// Flexbox (justify-content: space-between) keeps the three clusters in their own space, so
// the center content can never overlap the left/right clusters. The header is sticky: it
// stays pinned to the top of the viewport while page content scrolls underneath it.
//
// Pass `center` for page-specific middle content, and `onAdministratorClick` when a page
// wants to intercept the Administrator action (otherwise it navigates to /admin).

type BarshHeaderProps = {
  center?: React.ReactNode;
  onAdministratorClick?: () => void;
};

const headerStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1000,
  isolation: "isolate",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 24,
  minHeight: 124,
  padding: "6px 8px 8px",
  marginBottom: 6,
  // Opaque background + shadow so scrolled content passes cleanly underneath.
  background: "#f8fafc",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.10)",
};

const leftWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  flexShrink: 0,
};

// Absolutely centered against the header's true horizontal center, so the file-number /
// matter info sits dead-center regardless of the (uneven) left vs right cluster widths.
// The header is position: sticky (a positioned element), so this is centered relative to it.
const centerSlotStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: 0,
  bottom: 0,
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// Right cluster: actions sit immediately to the left of the Barsh Matters logo.
const rightWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  gap: 8,
  flexShrink: 0,
};

const brlLogoStyle: React.CSSProperties = {
  width: 190,
  height: 126,
  objectFit: "contain",
  display: "block",
};

const bmLogoLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  textDecoration: "none",
  flexShrink: 0,
};

// The source image (428x326) is taller than a 292-wide box, so `contain` only fills ~173px
// of width and pins it right, leaving a big empty transparent gap on the left. Sizing the box
// to the visible logo width removes that gap so the actions sit right against the visible logo.
const bmLogoStyle: React.CSSProperties = {
  width: 174,
  height: 132,
  minWidth: 174,
  objectFit: "contain",
  objectPosition: "center",
  display: "block",
  flexShrink: 0,
};

export default function BarshHeader({ center, onAdministratorClick }: BarshHeaderProps) {
  return (
    <section style={headerStyle} data-barsh-standard-header="true">
      <div style={leftWrapStyle}>
        <img src="/brl-logo-navy.png" alt="Barshay, Rizzo & Lopez, PLLC" style={brlLogoStyle} />
        <div style={{ paddingTop: 8 }}>
          <BarshHeaderQuickNav />
        </div>
      </div>

      <div style={centerSlotStyle} data-barsh-standard-header-center="true">
        {center}
      </div>

      <div style={rightWrapStyle}>
        <div style={{ display: "flex", alignItems: "center", paddingTop: 4 }}>
          <BarshHeaderActions onAdministratorClick={onAdministratorClick} />
        </div>

        <a href="/" style={bmLogoLinkStyle} title="Return to Barsh Matters entry screen">
          <img src="/barsh-matters-logo-navy-transparent.png" alt="Barsh Matters" style={bmLogoStyle} />
        </a>
      </div>
    </section>
  );
}
