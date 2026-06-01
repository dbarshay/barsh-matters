import fs from "node:fs";

const page = fs.readFileSync("app/admin/ticklers/page.tsx", "utf8");
const failures = [];

function mustInclude(label, needle) {
  if (!page.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, needle) {
  if (page.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

mustInclude("Link import already available", 'import Link from "next/link";');
mustInclude("matter href helper", "function ticklerMatterHref");
mustInclude("master href helper", "function ticklerMasterHref");
mustInclude("master lawsuit route", "/matters?master=");
mustInclude("direct matter route", "/matter/");
mustInclude("Matter result uses Link", "<Link href={ticklerMatterHref(tickler)}");
mustInclude("Master Lawsuit result uses Link", "<Link href={ticklerMasterHref(tickler)}");
mustInclude("link styling", "const linkStyle =");
mustInclude("master-level settlement links to master", "caseMatter === caseMaster");

mustNotInclude("raw matter-only td without link", '<td style={{ padding: "10px 8px" }}>{(tickler as any).caseData?.matter || tickler.displayNumber || tickler.matterId || "—"}</td>');
mustNotInclude("raw master-only td without link", '<td style={{ padding: "10px 8px" }}>{(tickler as any).caseData?.masterLawsuit || tickler.masterLawsuitId || "—"}</td>');

if (failures.length) {
  console.error("FAIL: admin tickler result links verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: admin tickler result Matter and Master Lawsuit values are hyperlinked to the appropriate page.");
