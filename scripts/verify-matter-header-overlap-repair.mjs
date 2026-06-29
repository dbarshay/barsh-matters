import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, token) { page.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }

has("header grid marker present", 'data-barsh-matter-header-grid="true"');
has("header grid uses two columns", 'gridTemplateColumns: "minmax(0, 1fr) 132px"');
has("header grid clips overflow", 'overflow: "hidden"');
has("left header wrapper marker present", 'data-barsh-matter-header-left="true"');
has("left logo marker present", 'data-barsh-matter-left-logo="true"');
has("left logo shrinks", 'width: 82');
has("right logo link marker present", 'data-barsh-matter-header-right-logo-link="true"');
has("right logo marker present", 'data-barsh-matter-right-logo="true"');
has("right logo link constrained", 'width: 120');
has("right logo constrained", 'width: 108');
has("right logo object contained", 'objectFit: "contain"');

const containedImgTags = [...page.matchAll(/<img\b[\s\S]*?\/>/g)].map((m) => m[0]).filter((tag) => tag.includes("data-barsh-header-logo-containment"));
if (containedImgTags.length >= 2) pass("contained header logo tags remain");
else fail(`expected at least two contained header logo tags, found ${containedImgTags.length}`);
for (const tag of containedImgTags) {
  const styleCount = (tag.match(/\bstyle=/g) || []).length;
  if (styleCount === 1) pass("contained logo has one style prop");
  else fail(`contained logo has ${styleCount} style props`);
}

console.log("RESULT: matter header overlap repair verifier");
if (failed) process.exit(1);
