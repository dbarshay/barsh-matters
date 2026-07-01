#!/usr/bin/env python3
"""
Change the Barsh Matters system navy everywhere in ONE command — code AND logos.

Usage:
    python3 scripts/set-system-blue.py "#RRGGBB"

What it does:
  1. Reads the current system navy from BRAND_NAVY in lib/brand.ts.
  2. Replaces that hex (and its "r, g, b" rgb() form) with the new value across
     app/, lib/, src/, and scripts/ — and updates BRAND_NAVY.
  3. Re-tints the brand logo PNGs in public/ from the old navy to the new one,
     preserving the gold accents, white lettering, and transparency.

The navy is the single source of truth: this is why "change the system blue" is
one operation instead of a piecemeal hunt.
"""
import os
import re
import sys

try:
    from PIL import Image
except Exception:
    Image = None

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def rgb(h):
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def main():
    if len(sys.argv) != 2 or not HEX.match(sys.argv[1]):
        sys.exit('Usage: python3 scripts/set-system-blue.py "#RRGGBB"')
    new = sys.argv[1].lower()

    brand = open("lib/brand.ts", encoding="utf-8").read()
    m = re.search(r'BRAND_NAVY\s*=\s*"(#[0-9a-fA-F]{6})"', brand)
    if not m:
        sys.exit("Could not find BRAND_NAVY in lib/brand.ts")
    cur = m.group(1).lower()
    if cur == new:
        print(f"System blue already {new}; re-tinting logos only.")
    cr, cg, cb = rgb(cur)
    nr, ng, nb = rgb(new)
    cur_rgb = re.compile(rf"{cr},\s*{cg},\s*{cb}")

    # 1 + 2: code replace (scoped to source dirs; leaves docs/ historical snapshots alone)
    exts = (".ts", ".tsx", ".mjs", ".cjs", ".js", ".css", ".md")
    changed = 0
    for base in ("app", "lib", "src", "scripts"):
        for root, _, files in os.walk(base):
            if any(s in root for s in (".next", "node_modules", ".git")):
                continue
            for fn in files:
                if not fn.endswith(exts) or fn.endswith(".bak"):
                    continue
                p = os.path.join(root, fn)
                try:
                    t = open(p, encoding="utf-8").read()
                except Exception:
                    continue
                n = t.replace(cur, new).replace(cur.upper(), new)
                n = cur_rgb.sub(f"{nr}, {ng}, {nb}", n)
                if n != t:
                    open(p, "w", encoding="utf-8").write(n)
                    changed += 1
    print(f"code files updated: {changed} ({cur} -> {new})")

    # 3: re-tint logo PNGs (navy pixels -> new; keep gold/white/alpha)
    if Image is None:
        print("Pillow not available — skipped logo re-tint.")
        return
    logos = [
        "public/brl-logo-navy.png",
        "public/brl-logo.png",
        "public/barsh-matters-logo-navy-transparent.png",
        "public/barsh-matters-cropped-transparent.png",
    ]

    def lum(r, g, b):
        return 0.299 * r + 0.587 * g + 0.114 * b

    for fp in logos:
        if not os.path.exists(fp):
            continue
        im = Image.open(fp).convert("RGBA")
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if r > g > b and (r - b) > 28 and r > 110:  # keep gold
                    continue
                L = lum(r, g, b)
                if L < 150:  # navy / dark -> new
                    px[x, y] = (nr, ng, nb, a)
                elif L < 236:  # anti-aliased edge -> blend toward white
                    t = (236 - L) / (236 - 150)
                    px[x, y] = (
                        round(nr * t + 255 * (1 - t)),
                        round(ng * t + 255 * (1 - t)),
                        round(nb * t + 255 * (1 - t)),
                        a,
                    )
        im.save(fp)
        print("re-tinted", fp)
    print(f"Done. System blue is now {new}.")


if __name__ == "__main__":
    main()
