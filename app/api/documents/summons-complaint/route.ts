import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { BARSH_FIRM_CONTACT } from "@/lib/firmContact";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function formatMoney(value: unknown): string {
  return money(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatAmountMode(value: unknown): string {
  const mode = clean(value);

  if (mode === "balance_presuit") return "Balance Presuit";
  if (mode === "claim_amount") return "Claim Amount";
  if (mode === "custom") return "Custom Amount";

  return mode || "Unspecified";
}

function formatDate(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function formatDos(start: unknown, end: unknown): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e && s !== e) return `${s} - ${e}`;
  return s || e || "";
}

function safeFilePart(value: unknown, maxLength = 120): string {
  return clean(value)
    .replace(/[\/\\:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeDocxFilename(baseName: unknown): string {
  const base = safeFilePart(baseName, 150).replace(/\.+$/g, "");
  return `${base || "Summons and Complaint"}.docx`;
}

function paragraph(
  text: unknown,
  options?: {
    bold?: boolean;
    italics?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
  }
) {
  return new Paragraph({
    alignment: options?.align || AlignmentType.LEFT,
    children: [
      new TextRun({
        text: clean(text),
        bold: Boolean(options?.bold),
        italics: Boolean(options?.italics),
        size: options?.size ?? 22,
      }),
    ],
    spacing: {
      before: options?.before ?? 0,
      after: options?.after ?? 120,
    },
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, size: 26 })],
    spacing: { before: 220, after: 160 },
  });
}

function captionLine(text: unknown, options?: { bold?: boolean; size?: number }) {
  return new Paragraph({
    children: [
      new TextRun({
        text: clean(text),
        bold: Boolean(options?.bold),
        size: options?.size ?? 22,
      }),
    ],
    spacing: { after: 70 },
  });
}

function pleadingNumber(number: number, text: unknown) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${number}. `, size: 22 }),
      new TextRun({ text: clean(text), size: 22 }),
    ],
    spacing: { after: 120 },
  });
}

function tableCell(
  text: unknown,
  options?: {
    bold?: boolean;
    width?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    shade?: string;
  }
) {
  return new TableCell({
    width: options?.width
      ? { size: options.width, type: WidthType.PERCENTAGE }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: options?.shade ? { fill: options.shade } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
    },
    children: [
      new Paragraph({
        alignment: options?.align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text: clean(text) || "—",
            bold: Boolean(options?.bold),
            size: options?.size ?? 18,
          }),
        ],
      }),
    ],
    margins: {
      top: 80,
      bottom: 80,
      left: 90,
      right: 90,
    },
  });
}

function labelValue(label: string, value: unknown) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 21 }),
      new TextRun({ text: clean(value) || "—", size: 21 }),
    ],
    spacing: { after: 80 },
  });
}

function makeCaptionTable(args: {
  provider: string;
  patient: string;
  insurer: string;
  indexAaaNumber: string;
}) {
  const plaintiff = `${args.provider || "Provider"} a/a/o ${args.patient || "Patient"}`;
  const defendant = args.insurer || "Insurer";

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 62, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            children: [
              captionLine(plaintiff, { bold: true }),
              captionLine("Plaintiff,"),
              captionLine("-against-", { bold: true }),
              captionLine(defendant, { bold: true }),
              captionLine("Defendant."),
            ],
            margins: {
              top: 160,
              bottom: 160,
              left: 180,
              right: 180,
            },
          }),
          new TableCell({
            width: { size: 38, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            children: [
              captionLine("Index / AAA No.:", { bold: true }),
              captionLine(args.indexAaaNumber || "—"),
              paragraph("", { after: 120 }),
              captionLine("SUMMONS AND COMPLAINT", { bold: true }),
            ],
            margins: {
              top: 160,
              bottom: 160,
              left: 180,
              right: 180,
            },
          }),
        ],
      }),
    ],
  });
}

function makeBillReferenceTable(childMatters: any[]) {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        tableCell("Matter", { bold: true, shade: "E5E7EB", width: 13 }),
        tableCell("Patient", { bold: true, shade: "E5E7EB", width: 18 }),
        tableCell("DOS", { bold: true, shade: "E5E7EB", width: 18 }),
        tableCell("Claim Amount", { bold: true, shade: "E5E7EB", width: 17 }),
        tableCell("Balance Presuit", { bold: true, shade: "E5E7EB", width: 17 }),
        tableCell("Denial Reason", { bold: true, shade: "E5E7EB", width: 17 }),
      ],
    }),
  ];

  for (const child of childMatters) {
    rows.push(
      new TableRow({
        children: [
          tableCell(child.displayNumber || child.matterId || ""),
          tableCell(child.patientName || ""),
          tableCell(formatDos(child.dosStart, child.dosEnd)),
          tableCell(formatMoney(child.claimAmount), { align: AlignmentType.RIGHT }),
          tableCell(formatMoney(child.balancePresuit), { align: AlignmentType.RIGHT }),
          tableCell(child.denialReason || ""),
        ],
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows,
  });
}

async function loadPacket(req: NextRequest, masterLawsuitId: string) {
  const packetUrl = new URL("/api/documents/packet", req.nextUrl.origin);
  packetUrl.searchParams.set("masterLawsuitId", masterLawsuitId);

  const packetRes = await fetch(packetUrl, {
    method: "GET",
    cache: "no-store",
  });

  const packetJson = await packetRes.json();

  if (!packetRes.ok || !packetJson?.packet) {
    throw new Error(packetJson?.error || "Could not load document packet.");
  }

  return packetJson.packet;
}

export async function GET(req: NextRequest) {
  try {
    const masterLawsuitId = clean(req.nextUrl.searchParams.get("masterLawsuitId"));

    if (!masterLawsuitId) {
      return NextResponse.json(
        { ok: false, error: "Missing masterLawsuitId" },
        { status: 400 }
      );
    }

    const packet = await loadPacket(req, masterLawsuitId);
    const validation = packet.validation || {};

    if (!validation.canGenerate) {
      return NextResponse.json(
        {
          ok: false,
          error: "Document packet is not generation-ready.",
          validation,
        },
        { status: 422 }
      );
    }

    const metadata = packet.metadata || {};
    const masterMatter = packet.masterMatter || {};
    const childMatters = Array.isArray(packet.childMatters)
      ? packet.childMatters
      : [];
    const totals = packet.totals || {};

    const provider = metadata.provider?.value || "";
    const patient = metadata.patient?.value || "";
    const insurer = metadata.insurer?.value || "";
    const claimNumber = metadata.claimNumber?.value || "";
    const venue = metadata.venue?.value || "";
    const indexAaaNumber = metadata.indexAaaNumber?.value || "";
    const amountSought = metadata.amountSought?.amount ?? packet.lawsuit?.amountSought ?? 0;
    const amountSoughtMode = metadata.amountSought?.mode || packet.lawsuit?.amountSoughtMode || "";
    const masterDisplay = masterMatter.displayNumber || masterLawsuitId;
    const billCount = num(totals.billCount || childMatters.length);

    const plaintiff = `${provider || "Provider"} a/a/o ${patient || "Patient"}`;
    const defendant = insurer || "Insurer";
    const amountSoughtText = `${formatMoney(amountSought)} (${formatAmountMode(amountSoughtMode)})`;

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          children: [
            paragraph(venue || "Court / Venue", {
              bold: true,
              align: AlignmentType.CENTER,
              size: 24,
              after: 180,
            }),

            makeCaptionTable({
              provider,
              patient,
              insurer,
              indexAaaNumber,
            }),

            paragraph("DRAFT SCAFFOLD — FOR INTERNAL REVIEW ONLY", {
              bold: true,
              italics: true,
              align: AlignmentType.CENTER,
              size: 20,
              before: 160,
              after: 220,
            }),

            sectionHeading("SUMMONS"),

            paragraph(`To the above-named Defendant:`, { bold: true }),

            paragraph(
              "You are hereby summoned to answer the complaint in this action and to serve a copy of your answer, or, if the complaint is not served with this summons, to serve a notice of appearance, on the Plaintiff's attorney within the time permitted by applicable law."
            ),

            paragraph(
              "This document is a generated scaffold based on the document packet data and requires legal-language review before filing or service.",
              { italics: true }
            ),

            labelValue("Plaintiff", plaintiff),
            labelValue("Defendant", defendant),
            labelValue("Claim Number", claimNumber),
            labelValue("Master Lawsuit ID", packet.masterLawsuitId || masterLawsuitId),
            labelValue("Master Matter", masterDisplay),
            labelValue("Amount Sought", amountSoughtText),

            sectionHeading("COMPLAINT"),

            pleadingNumber(
              1,
              `Plaintiff ${plaintiff} is identified in the document packet as the provider/plaintiff for this matter.`
            ),
            pleadingNumber(
              2,
              `The patient/assignor identified in the document packet is ${patient || "—"}.`
            ),
            pleadingNumber(
              3,
              `Defendant ${defendant} is identified in the document packet as the insurer/defendant.`
            ),
            pleadingNumber(
              4,
              `The claim number identified in the document packet is ${claimNumber || "—"}.`
            ),
            pleadingNumber(
              5,
              `This action concerns ${billCount} bill matter${billCount === 1 ? "" : "s"} associated with Master Lawsuit ID ${packet.masterLawsuitId || masterLawsuitId}.`
            ),
            pleadingNumber(
              6,
              `The amount sought for this lawsuit is ${amountSoughtText}.`
            ),
            pleadingNumber(
              7,
              "The bill matters, dates of service, amounts, balances, and denial information are summarized in the bill schedule reference below."
            ),
            pleadingNumber(
              8,
              "Plaintiff demands judgment against Defendant for the amount sought, together with all applicable interest, attorneys' fees, costs, disbursements, and such other relief as may be permitted by law."
            ),

            paragraph("WHEREFORE, Plaintiff demands judgment as set forth above.", {
              bold: true,
              before: 180,
              after: 220,
            }),

            sectionHeading("BILL SCHEDULE REFERENCE"),
            makeBillReferenceTable(childMatters),

            paragraph("Attorney for Plaintiff", { before: 260 }),
            paragraph(BARSH_FIRM_CONTACT.signatureBlockName),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const body = new Uint8Array(buffer);

    const filename = safeDocxFilename(
      `${masterDisplay} - ${provider || "Provider"} aao ${patient || "Patient"} v ${insurer || "Insurer"} - Claim ${claimNumber || "No Claim"} - Summons and Complaint`
    );

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Summons and Complaint generation failed.",
      },
      { status: 500 }
    );
  }
}
