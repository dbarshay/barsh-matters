import fs from "fs";

const file = "app/matter/[id]/page.tsx";
const text = fs.readFileSync(file, "utf8");

let failed = false;

function requireText(label, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL: missing ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function forbidText(label, needle) {
  if (text.includes(needle)) {
    console.error(`FAIL: forbidden ${label}`);
    failed = true;
  } else {
    console.log(`PASS: forbidden ${label} absent`);
  }
}

requireText("resolvedNumericMatterId helper", "function resolvedNumericMatterId()");
requireText("DOS direct-field save uses resolved numeric id", 'matterId: resolvedNumericMatterId(),\n          field: "dos",');
requireText("picklist direct-field body uses resolved numeric id", "const body: any = {\n        matterId: resolvedNumericMatterId(),\n        field,\n      };");
requireText("direct-field route is still used", 'fetch("/api/matters/update-direct-field"');

forbidText("old DOS route-param matterId save", 'matterId,\n          field: "dos",');
forbidText("old picklist route-param matterId save", "const body: any = {\n        matterId,\n        field,\n      };");

if (failed) process.exit(1);

console.log("PASS: direct matter direct-field saves use resolved numeric matter id.");
