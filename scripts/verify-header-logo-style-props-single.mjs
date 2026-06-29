import fs from "fs";

const pagePath = "app/matter/[id]/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }

const imgTags = [...page.matchAll(/<img\b[\s\S]*?\/>/g)].map((m) => m[0]);
const containedTags = imgTags.filter((tag) => tag.includes("data-barsh-header-logo-containment"));

if (containedTags.length >= 2) pass("header containment tags are present");
else fail(`expected at least 2 header containment tags, found ${containedTags.length}`);

for (const tag of containedTags) {
  const src = (tag.match(/src="([^"]+)"/) || [])[1] || "unknown";
  const styleCount = (tag.match(/\bstyle=/g) || []).length;
  if (styleCount === 1) pass(`${src} has exactly one style prop`);
  else fail(`${src} has ${styleCount} style props`);
  if (tag.includes("maxWidth: 126") && tag.includes("maxHeight: 86") && tag.includes('objectFit: "contain"')) {
    pass(`${src} has logo containment sizing`);
  } else {
    fail(`${src} missing logo containment sizing`);
  }
}

console.log("RESULT: header logo style prop verifier");
if (failed) process.exit(1);
