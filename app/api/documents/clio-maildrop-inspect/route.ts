import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function deprecatedMaildropInspectionResponse() {
  return NextResponse.json(
    {
      ok: false,
      action: "clio-maildrop-inspection",
      deprecated: true,
      reason:
        "Clio MailDrop inspection is deprecated because Barsh Matters no longer creates or depends on Clio matter shells. Clio is storage only under the Barsh Matters Master Repository.",
      clioRead: false,
      clioWrite: false,
      clioRecordsChanged: false,
      storageModel: "single-master-repository",
    },
    { status: 410 }
  );
}

export async function GET() {
  return deprecatedMaildropInspectionResponse();
}

export async function POST() {
  return deprecatedMaildropInspectionResponse();
}
