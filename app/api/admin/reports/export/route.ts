/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic report rows. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateReports, reportOwnerId } from "@/lib/reports/reportsAuth";
import { runReport, type ReportConfig } from "@/lib/reports/runReport";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmtCell(v: any, type: string): string {
  if (v === null || v === undefined) return "";
  if (type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? (Math.round(n * 100) / 100).toLocaleString("en-US") : String(v);
  }
  return String(v);
}

function safeName(v: string): string {
  return (v || "report").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 60);
}

function buildXlsx(title: string, result: any): Buffer {
  const cols = result.columns as { key: string; label: string; type: string }[];
  const header = cols.map((c) => c.label);
  const body = result.rows.map((r: any) => cols.map((c) => fmtCell(r[c.key], c.type)));
  const aoa: any[][] = [[title], header, ...body];
  if (result.grandTotals) {
    let totalRow: string[] = cols.map((c) => (result.grandTotals[c.key] !== undefined ? fmtCell(result.grandTotals[c.key], "number") : ""));
    if (totalRow.every((x) => x === "")) totalRow = ["Totals", ...totalRow.slice(1)];
    aoa.push(totalRow);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function buildPdf(title: string, result: any): Promise<Uint8Array> {
  const cols = (result.columns as { key: string; label: string; type: string }[]).slice(0, 12);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageW = 792, pageH = 612; // landscape letter
  const margin = 28;
  const usableW = pageW - margin * 2;
  const colW = usableW / Math.max(cols.length, 1);
  const rowH = 15;
  const fontSize = 7.5;
  const navy = rgb(0, 0.204, 0.431);

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;
  const clip = (s: string, w: number) => {
    let out = s;
    while (out.length && font.widthOfTextAtSize(out, fontSize) > w - 4) out = out.slice(0, -1);
    return out.length < s.length ? out.slice(0, -1) + "…" : out;
  };
  const drawHeader = () => {
    page.drawText(title, { x: margin, y, size: 12, font: bold, color: navy });
    y -= 20;
    cols.forEach((c, i) => page.drawText(clip(c.label, colW), { x: margin + i * colW + 2, y, size: fontSize, font: bold, color: navy }));
    y -= rowH;
  };
  drawHeader();

  const drawRow = (values: string[], isTotal = false) => {
    if (y < margin + rowH) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
      drawHeader();
    }
    cols.forEach((c, i) => page.drawText(clip(values[i] || "", colW), { x: margin + i * colW + 2, y, size: fontSize, font: isTotal ? bold : font, color: rgb(0.1, 0.1, 0.1) }));
    y -= rowH;
  };

  for (const r of result.rows as any[]) drawRow(cols.map((c) => fmtCell(r[c.key], c.type)));
  if (result.grandTotals) {
    let totals: string[] = cols.map((c) => (result.grandTotals[c.key] !== undefined ? fmtCell(result.grandTotals[c.key], "number") : ""));
    if (totals.every((x) => x === "")) totals = ["Totals", ...totals.slice(1)];
    drawRow(totals, true);
  }
  return doc.save();
}

export async function POST(req: NextRequest) {
  const gate = gateReports(req, "POST");
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const format = body?.format === "pdf" ? "pdf" : "xlsx";
  const title = String(body?.title || "Report").slice(0, 80);

  let config: ReportConfig | null = null;
  if (body?.savedReportId) {
    const r = await prisma.savedReport.findUnique({ where: { id: String(body.savedReportId) } });
    if (!r) return NextResponse.json({ ok: false, error: "Saved report not found." }, { status: 404 });
    const me = reportOwnerId(gate.identity);
    if (!(r.isShared || (r.ownerId || "") === me)) return NextResponse.json({ ok: false, error: "Not visible to you." }, { status: 403 });
    config = { ...((r.config as any) || {}) };
  } else if (body?.config && typeof body.config === "object") {
    config = { ...body.config };
  }
  if (!config) return NextResponse.json({ ok: false, error: "No report config provided." }, { status: 400 });

  try {
    const result = await runReport(config);
    if (format === "pdf") {
      const bytes = await buildPdf(title, result);
      return new NextResponse(bytes as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName(title)}.pdf"`,
        },
      });
    }
    const buf = buildXlsx(title, result);
    return new NextResponse(buf as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName(title)}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Export failed." }, { status: 500 });
  }
}
