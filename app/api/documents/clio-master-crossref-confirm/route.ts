import { NextRequest, NextResponse } from "next/server";
import { clioFetch } from "@/lib/clio";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function loadPreview(req: NextRequest, masterLawsuitId: string) {
  const previewUrl = new URL("/api/documents/clio-master-crossref-preview", req.nextUrl.origin);
  previewUrl.searchParams.set("masterLawsuitId", masterLawsuitId);

  const res = await fetch(previewUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Could not load Clio cross-reference preview.");
  }

  return json;
}

async function writeCrossrefTarget(target: any) {
  const matterId = Number(target?.matterId);
  if (!Number.isFinite(matterId) || matterId <= 0) {
    throw new Error("Invalid target matter id.");
  }

  const plannedFields = Array.isArray(target?.plannedFields) ? target.plannedFields : [];
  const customFieldValues = plannedFields.map((field: any) => {
    const existingId = clean(field.existingCustomFieldValueId);
    const nextValue = clean(field.nextValue);

    if (!existingId) {
      throw new Error(
        `${target?.displayNumber || matterId}: ${field.fieldLabel || "Custom field"} is missing an existing custom field value id.`
      );
    }

    return {
      id: existingId,
      value: nextValue,
      custom_field: { id: Number(field.fieldId) },
    };
  });

  if (!customFieldValues.length) {
    throw new Error(`${target?.displayNumber || matterId}: no planned custom field values to write.`);
  }

  const fields = "id,display_number,description,custom_field_values{id,value,custom_field}";

  const res = await clioFetch(`/api/v4/matters/${encodeURIComponent(String(matterId))}.json?fields=${encodeURIComponent(fields)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        custom_field_values: customFieldValues,
      },
    }),
  });

  const bodyText = await res.text();
  let json: any = {};

  try {
    json = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    json = { raw: bodyText };
  }

  if (!res.ok) {
    throw new Error(
      `Failed to write Clio cross-reference fields to ${target?.displayNumber || matterId}: status ${res.status}; body ${bodyText || "(empty)"}`
    );
  }

  return {
    matterId,
    displayNumber: clean(json?.data?.display_number) || clean(target?.displayNumber),
    description: clean(json?.data?.description) || clean(target?.description),
    writtenFields: customFieldValues.map((field: any) => ({
      existingCustomFieldValueId: field.id,
      fieldId: field.custom_field.id,
      value: field.value,
    })),
    raw: json,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json().catch(() => ({})));
    const masterLawsuitId = clean(body.masterLawsuitId) || "2026.05.00001";
    const typedConfirmation = clean(body.typedConfirmation);
    const requiredConfirmation = `WRITE CLIO CROSSREF ${masterLawsuitId}`;

    if (typedConfirmation !== requiredConfirmation) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-master-crossref-confirm",
          requiresTypedConfirmation: true,
          requiredConfirmation,
          receivedConfirmation: typedConfirmation || null,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          error: `Type exactly: ${requiredConfirmation}`,
        },
        { status: 400 }
      );
    }

    const preview = await loadPreview(req, masterLawsuitId);

    if (!preview.readyForConfirm) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-master-crossref-confirm",
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          readyForConfirm: false,
          blockingWarnings: preview.blockingWarnings || [],
          targetBlockingReasons: preview.targetBlockingReasons || [],
          error: "Clio cross-reference writeback is blocked because preview is not ready for confirm.",
        },
        { status: 409 }
      );
    }

    const targets = Array.isArray(preview.targets) ? preview.targets : [];
    const results = [];

    for (const target of targets) {
      results.push(await writeCrossrefTarget(target));
    }

    return NextResponse.json({
      ok: true,
      action: "clio-master-crossref-confirm",
      clioRecordsChanged: true,
      databaseRecordsChanged: false,
      documentsUploaded: false,
      documentsDownloaded: false,
      masterLawsuitId,
      typedConfirmation,
      targetCount: targets.length,
      results,
      writtenValues: preview.resolvedValues,
      note:
        "Wrote only Clio cross-reference custom fields for child and master Clio matters.  No Barsh Matters database records, documents, email, print, or print queue records were changed.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "clio-master-crossref-confirm",
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        error: error?.message || "Clio master cross-reference confirm failed.",
      },
      { status: 500 }
    );
  }
}
