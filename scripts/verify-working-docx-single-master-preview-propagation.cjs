const fs = require("fs");

const file = "app/api/documents/working-docx/route.ts";
const src = fs.readFileSync(file, "utf8");

const checks = [
  {
    name: "loadFinalizePreview accepts useSingleMasterClioStorage param",
    pass: /useSingleMasterClioStorage\?: boolean;/.test(src),
  },
  {
    name: "master finalize preview gets singleMasterClioStorage=1 when requested",
    pass: /params\.useSingleMasterClioStorage[\s\S]*previewUrl\.searchParams\.set\("singleMasterClioStorage", "1"\)/.test(src),
  },
  {
    name: "POST passes request single-master flag into loadFinalizePreview",
    pass: /useSingleMasterClioStorage:\s*singleMasterDirectStorage/.test(src),
  },
  {
    name: "direct finalize preview still receives singleMasterDirectStorage=1",
    pass: /direct-finalize-preview[\s\S]*singleMasterDirectStorage[\s\S]*previewUrl\.searchParams\.set\("singleMasterDirectStorage", "1"\)/.test(src),
  },
];

let ok = true;
for (const check of checks) {
  if (check.pass) {
    console.log(`PASS: ${check.name}`);
  } else {
    ok = false;
    console.error(`FAIL: ${check.name}`);
  }
}

if (!ok) process.exit(1);
console.log("RESULT: working DOCX single-master preview propagation verifier");
