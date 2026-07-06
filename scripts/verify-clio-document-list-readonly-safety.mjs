import fs from "node:fs";

const routePath = "app/api/documents/clio-matter-documents/route.ts";
const helperPath = "lib/clioDocumentUpload.ts";

const route = fs.readFileSync(routePath, "utf8");
const helper = fs.readFileSync(helperPath, "utf8");

const checks = [
  {
    label: "route exists and exports GET only",
    pass:
      route.includes("export async function GET") &&
      !route.includes("export async function POST") &&
      !route.includes("export async function PUT") &&
      !route.includes("export async function PATCH") &&
      !route.includes("export async function DELETE"),
  },
  {
    label: "route uses existing listClioMatterDocuments helper",
    pass:
      route.includes("listClioMatterDocuments") &&
      route.includes('from "@/lib/clioDocumentUpload"') &&
      helper.includes("export async function listClioMatterDocuments"),
  },
  {
    label: "route has explicit read-only safety flags",
    pass:
      route.includes("readOnly: true") &&
      route.includes("clioRecordsChanged: false") &&
      route.includes("databaseRecordsChanged: false") &&
      route.includes("documentsUploaded: false") &&
      route.includes("documentsDownloaded: false") &&
      route.includes("documentsGenerated: false") &&
      route.includes("emailSent: false") &&
      route.includes("printQueued: false"),
  },
  {
    label: "route does not call Clio upload/finalize helpers",
    pass:
      !route.includes("uploadBufferToClioMatterDocuments") &&
      !route.includes("finalize") &&
      !route.includes("put_url") &&
      !route.includes("put_headers"),
  },
  {
    label: "route does not use Prisma write methods",
    pass:
      !/prisma\.[\s\S]*\.(create|update|upsert|delete|deleteMany|updateMany|createMany)\s*\(/.test(route),
  },
  {
    label: "master lawsuit path requires explicit repository storage mapping",
    pass:
      route.includes("clioMasterMatterId") &&
      route.includes("No Barsh Matters repository storage target exists for this Lawsuit ID") &&
      route.includes("Refusing to list documents without an explicit repository context"),
  },
  {
    label: "route returns later retrieval metadata",
    pass:
      route.includes("clioDocumentId") &&
      route.includes("clioDocumentName") &&
      route.includes("latestDocumentVersion") &&
      route.includes("uuid") &&
      route.includes("filename") &&
      route.includes("contentType") &&
      route.includes("size") &&
      route.includes("fullyUploaded"),
  },
  {
    label: "route supports direct matter and master lawsuit query modes",
    pass:
      route.includes('url.searchParams.get("matterId")') &&
      route.includes('url.searchParams.get("masterLawsuitId")') &&
      route.includes('targetType: "direct-matter" | "master-lawsuit"'),
  },
  {
    label: "direct matter path resolves real Clio matter id by BRL display number",
    pass:
      route.includes("resolveClioMatterByDisplayNumber") &&
      route.includes("claim-index + clio-display-number-resolution") &&
      route.includes("clioResolution.clioMatterId") &&
      route.includes("localMatterId"),
  },
  {
    label: "direct matter path fails closed when BRL display number cannot resolve",
    pass:
      route.includes("Could not resolve real Clio matter id") &&
      route.includes("failClosed: true") &&
      route.includes("{ status: 409 }"),
  },
];

let failed = 0;

for (const check of checks) {
  if (check.pass) {
    console.log(`PASS: ${check.label}`);
  } else {
    failed += 1;
    console.log(`FAIL: ${check.label}`);
  }
}

if (failed) {
  console.error(`\nFAIL: ${failed} Clio document read-only safety check(s) failed.`);
  process.exit(1);
}

console.log("\nPASS: Clio document listing route is read-only and fail-closed for unmapped master lawsuits.");
