import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function deprecatedMaildropResponse() {
  return NextResponse.json(
    {
      ok: false,
      action: "clio-maildrop-resolve",
      deprecated: true,
      reason:
        "Clio MailDrop is deprecated because Barsh Matters no longer creates or depends on individual/master Clio matter shells. Clio is storage only under the Barsh Matters Master Repository.",
      maildropEmail: "",
      maildropLabel: "",
      clioRead: false,
      clioWrite: false,
      clioRecordsChanged: false,
      storageModel: "single-master-repository",
      nextStep:
        "Use Barsh Matters local email/draft workflow and document finalization/storage under the master repository.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return deprecatedMaildropResponse();
}

export async function POST() {
  return deprecatedMaildropResponse();
}
