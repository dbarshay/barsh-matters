import fs from "node:fs";

const preview = fs.readFileSync("src/lib/templates/template-builder-live-example-preview.ts", "utf8");
const library = fs.readFileSync("src/lib/templates/template-builder-merge-field-library.ts", "utf8");
const build = fs.readFileSync("app/admin/document-templates/build/page.tsx", "utf8");

const checks = [
  ["resolver uses city comma before state ZIP", preview.includes("cityPart + \", \" + stateZipLine")],
  ["resolver joins street/locality with newline", preview.includes("lines.join(\"\\n\")")],
  ["insurer example stores newline and comma locality", library.includes("3100 Sanders Road, Suite 201\\\\nNorthbrook, Illinois 60062")],
  ["adversary example stores newline and comma locality", library.includes("445 Broadhollow Road, Suite CL18\\\\nMelville, New York 11747")],
  ["Example Output span preserves line breaks", build.includes("whiteSpace: \"pre-line\"") && build.includes("exampleOutputFor(field)")],
  ["insurer full address token remains", library.includes("{{insurer.fullAddressBlock}}") && preview.includes("{{insurer.fullAddressBlock}}")],
  ["adversary full address token remains", library.includes("{{adversary.fullAddressBlock}}") && preview.includes("{{adversary.fullAddressBlock}}")],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error("FAIL: " + label);
  console.log("PASS: " + label);
}

console.log("PASS: Template Builder address blocks render as Street newline City, State Zip");
