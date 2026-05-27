import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value || "").trim();
}

function jsonObject(value: unknown): any {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as any;
}

function escapeHtml(value: unknown): string {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return clean(value) || "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function dateOnly(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US");
}

function rowHtml(label: string, value: unknown) {
  return `
    <div class="row">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value) || "—"}</div>
    </div>
  `;
}

export async function GET(req: NextRequest) {
  try {
    const finalizationId = Number(req.nextUrl.searchParams.get("finalizationId") || "");

    if (!Number.isFinite(finalizationId) || finalizationId <= 0) {
      return new NextResponse("Missing valid finalizationId.", { status: 400 });
    }

    const finalization = await prisma.documentFinalization.findUnique({
      where: { id: Math.floor(finalizationId) },
    });

    if (!finalization) {
      return new NextResponse(`No DocumentFinalization record exists with id ${finalizationId}.`, { status: 404 });
    }

    if (finalization.status !== "local-settlement-finalized-placeholder") {
      return new NextResponse("Only local settlement finalized-document placeholder records may be printed by this route.", { status: 400 });
    }

    const packet = jsonObject(finalization.packetSummarySnapshot);
    const selected = jsonObject(packet.selectedDocument);
    const settlement = jsonObject(packet.settlementRecord);
    const generated = jsonObject(packet.generatedDocument || selected.generatedDocument);

    const title =
      clean(selected.templateLabel || selected.label || selected.key) ||
      "Settlement Document";

    const filename =
      clean(selected.filename || generated.filename) ||
      `${title}.docx`;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      background: #f8fafc;
    }
    .toolbar {
      position: sticky;
      top: 0;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 12px 0 22px;
      background: #f8fafc;
    }
    button {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 10px 14px;
      font-weight: 800;
      background: #ffffff;
      cursor: pointer;
    }
    button.primary {
      border-color: #4f46e5;
      background: #4f46e5;
      color: #ffffff;
    }
    .page {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      padding: 36px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.10);
    }
    h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin-top: 8px;
      color: #475569;
      line-height: 1.45;
    }
    .section {
      margin-top: 26px;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
    }
    .section h2 {
      margin: 0 0 12px;
      font-size: 16px;
      color: #0f172a;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 18px;
    }
    .row {
      break-inside: avoid;
    }
    .label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      margin-bottom: 3px;
    }
    .value {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      line-height: 1.35;
    }
    .notice {
      margin-top: 26px;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #1e3a8a;
      border-radius: 14px;
      padding: 14px;
      font-size: 13px;
      line-height: 1.45;
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .toolbar {
        display: none;
      }
      .page {
        max-width: none;
        border: none;
        border-radius: 0;
        box-shadow: none;
        padding: 24px;
      }
      .notice {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.close()">Close</button>
    <button type="button" class="primary" onclick="window.print()">Print</button>
  </div>

  <main class="page">
    <h1>${escapeHtml(title)}</h1>
    <div class="subtitle">
      Printable local Barsh Matters settlement document generated from DocumentFinalization ID ${escapeHtml(finalization.id)}.
    </div>

    <section class="section">
      <h2>Document</h2>
      <div class="grid">
        ${rowHtml("Filename", filename)}
        ${rowHtml("Master Lawsuit", finalization.masterLawsuitId)}
        ${rowHtml("Finalization Status", finalization.status)}
        ${rowHtml("Finalized At", dateOnly(finalization.finalizedAt))}
      </div>
    </section>

    <section class="section">
      <h2>Settlement</h2>
      <div class="grid">
        ${rowHtml("Settlement Record ID", settlement.id)}
        ${rowHtml("Status", settlement.status)}
        ${rowHtml("Settled With", settlement.settledWith)}
        ${rowHtml("Settlement Date", dateOnly(settlement.settlementDate))}
        ${rowHtml("Payment Expected Date", dateOnly(settlement.paymentExpectedDate))}
        ${rowHtml("Gross Settlement", money(settlement.grossSettlementAmount))}
        ${rowHtml("Provider Net Total", money(settlement.providerNetTotal))}
        ${rowHtml("Row Count", settlement.rowCount)}
      </div>
    </section>

    <div class="notice">
      This print view is local-first and reads the Barsh Matters DocumentFinalization record.  It does not create a PDF, upload to Clio, create an Outlook draft, or send email.
    </div>
  </main>

  <script>
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 250);
    });
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return new NextResponse(error?.message || "Local settlement print view failed.", { status: 500 });
  }
}
