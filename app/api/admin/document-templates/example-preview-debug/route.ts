import { NextRequest, NextResponse } from "next/server";
import { resolveTemplateBuilderExamplePreview } from "@/src/lib/templates/template-builder-live-example-preview";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const matter = request.nextUrl.searchParams.get("matter")?.trim() || "2026.06.00011";
  const result = await resolveTemplateBuilderExamplePreview(matter);
  return NextResponse.json({
    matter,
    resolvedKeys: Object.keys(result.resolved || {}).filter((key) => result.resolved[key]),
    diagnostics: result.diagnostics,
    resolved: result.resolved
  });
}
