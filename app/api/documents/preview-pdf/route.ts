import { NextRequest, NextResponse } from "next/server";
import { convertWorkingDocxDriveItemToPdf } from "@/lib/documents/graphWorkingDocuments";

export const runtime = "nodejs";

const PDF_CONTENT_TYPE = "application/pdf";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function pdfFilename(value: unknown): string {
  const raw = clean(value) || "Barsh-Matters-Preview.pdf";
  const withoutDocx = raw.toLowerCase().endsWith(".docx") ? raw.slice(0, -5) : raw;
  const withPdf = withoutDocx.toLowerCase().endsWith(".pdf") ? withoutDocx : `${withoutDocx}.pdf`;

  return withPdf
    .replace(/[\/\\:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const workingDocumentDriveItemId = clean(
      body?.workingDocumentDriveItemId ||
        body?.workingDriveItemId ||
        body?.driveItemId
    );

    if (!workingDocumentDriveItemId) {
      return NextResponse.json(
        {
          ok: false,
          action: "preview-pdf",
          error: "Preview PDF requires a workingDocumentDriveItemId.",
          safety: {
            previewOnly: true,
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
            finalizationRecordCreated: false,
            printQueueChanged: false,
          },
        },
        { status: 400 }
      );
    }

    const conversion = await convertWorkingDocxDriveItemToPdf({
      driveItemId: workingDocumentDriveItemId,
    });

    const filename = pdfFilename(body?.filename || body?.workingDocumentName || "Barsh-Matters-Preview.pdf");
    const pdfBody = new Uint8Array(conversion.pdfBuffer);

    return new NextResponse(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": conversion.pdfContentType || PDF_CONTENT_TYPE,
        "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
        "X-Barsh-Matters-Action": "preview-pdf",
        "X-Barsh-Matters-Preview-Only": "true",
        "X-Barsh-Matters-Source-Drive-Item-Id": conversion.sourceDriveItemId,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "preview-pdf",
        error: err?.message || "Preview PDF conversion failed.",
        safety: {
          previewOnly: true,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          finalizationRecordCreated: false,
          printQueueChanged: false,
        },
      },
      { status: 500 }
    );
  }
}
