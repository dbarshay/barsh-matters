import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const failures = [];

function must(condition, message) {
  if (!condition) failures.push(message);
}

must(page.includes("Administrator Admin Cards"), "missing Administrator Admin Cards section");
must(page.includes('data-barsh-admin-users-admin-cards-full-width="true"'), "missing full-width admin cards anchor");
must(page.includes('gridColumn: "1 / -1"'), "admin cards section does not span the edit grid");
must(page.includes('width: "100%"'), "admin cards section missing width 100%");
must(page.includes('maxWidth: "none"'), "admin cards section missing maxWidth none");
must(page.includes('gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"') || page.includes('gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))"'), "admin cards grid is not full-width responsive");
must(!page.includes('writingMode: "vertical-rl"'), "Save User button still uses vertical writing mode");
must(!page.includes('textOrientation: "mixed"'), "Save User button still uses vertical text orientation");
must(!page.includes('maxWidth: 1220'), "Admin Users page regressed to maxWidth 1220");

if (failures.length) {
  console.error("FAILURES=" + failures.length);
  for (const failure of failures) console.error("FAIL=" + failure);
  process.exit(1);
}

console.log("PASS: Admin Users admin-card section is full-width");
