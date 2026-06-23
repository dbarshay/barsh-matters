import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildTemplateLayoutCompositionAdminReadinessPayload } from "../../../../../src/lib/templates/layout-composition-admin-readiness.mjs";

export const dynamic = "force-dynamic";

async function readFixtureInput() {
  const fixturePath = join(process.cwd(), "test/fixtures/templates/layout-composition-batch-validator-fixtures.json");
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

export async function GET() {
  const input = await readFixtureInput();
  const payload = buildTemplateLayoutCompositionAdminReadinessPayload(input);
  return NextResponse.json({
    ok: payload.ok,
    status: payload.status,
    generatedAt: new Date(0).toISOString(),
    source: {
      kind: "fixture",
      label: "locked Phase 5 batch fixture",
    },
    cards: payload.cards,
    sections: payload.sections,
    markdown: payload.markdown,
  });
}

export async function POST() {
  return NextResponse.json({ ok: false, error: "Method not allowed. This endpoint is read-only." }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ ok: false, error: "Method not allowed. This endpoint is read-only." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ ok: false, error: "Method not allowed. This endpoint is read-only." }, { status: 405 });
}
