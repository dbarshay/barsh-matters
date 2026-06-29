import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, token) { page.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }
function lacks(label, token) { !page.includes(token) ? pass(label) : fail(`${label} should not contain ${token}`); }

has("two-row header marker present", 'data-barsh-matter-header-two-row="true"');
has("header uses two rows", 'gridTemplateRows: "auto auto"');
has("utility row marker present", 'data-barsh-matter-header-utility-row="true"');
has("utility row is first row", "gridRow: 1");
has("left logo marker present", 'data-barsh-matter-left-logo="true"');
has("left logo constrained to 74", "width: 74");
has("right logo hidden marker present", 'data-barsh-matter-header-right-logo-hidden="true"');
has("right logo hidden display", 'display: "none"');
lacks("right visible logo marker removed", 'data-barsh-matter-right-logo="true"');

const containedImgTags = [...page.matchAll(/<img\b[\s\S]*?\/>/g)].map((m) => m[0]).filter((tag) => tag.includes("data-barsh-header-logo-containment"));
if (containedImgTags.length >= 1) pass("at least one contained header logo remains");
else fail("no contained header logo remains");
for (const tag of containedImgTags) {
  const styleCount = (tag.match(/\bstyle=/g) || []).length;
  if (styleCount === 1) pass("contained logo has exactly one style prop");
  else fail(`contained logo has ${styleCount} style props`);
}

console.log("RESULT: direct matter two-row header verifier");
if (failed) process.exit(1);
