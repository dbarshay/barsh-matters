// Single source of truth for Barsh Matters brand colors.
//
// There is ONE navy for interactive UI (buttons, banners, primary actions). Do not introduce other
// blues/indigos (#2563eb / #1d4ed8 / #4f46e5 etc. were unified into this value). New code should reference
// BRAND_NAVY rather than hardcoding the hex, so the palette can never drift again. To change the
// app-wide navy, update BRAND_NAVY here and find/replace the literal "#00346e".

export const BRAND_NAVY = "#00346e"; // primary navy — buttons, banners, headings, black text; matches the BRL + BM logos
export const BRAND_NAVY_MUTED = "#385a83"; // muted system blue — secondary / muted text (softened BRAND_NAVY). Derived + kept in sync by scripts/set-system-blue.py
export const BRAND_NAVY_DARK = "#14213d"; // darker navy for header chrome (BRL logo bar) — provisional until the BRL logo hex is sampled
export const BRAND_GOLD = "#bf9b4f"; // accent gold (Barsh Matters mark) — active states / highlights only

export const BARSH_BRAND = {
  navy: BRAND_NAVY,
  navyMuted: BRAND_NAVY_MUTED,
  navyDark: BRAND_NAVY_DARK,
  gold: BRAND_GOLD,
} as const;
