import fs from "node:fs";

const pagePath = "app/matters/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");
const pkg = fs.readFileSync("package.json", "utf8");

let failures = 0;
function check(label, ok) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    failures += 1;
    console.error(`FAIL: ${label}`);
  }
}

check("settlement popup position state exists", page.includes("masterSettlementPopupPosition"));
check("settlement popup dragging state exists", page.includes("masterSettlementPopupDragging"));
check("settlement popup drag begin handler exists", page.includes("beginMasterSettlementPopupDrag"));
check("settlement popup reset handler exists", page.includes("resetMasterSettlementPopupPosition"));
check("draggable shell marker exists", page.includes("data-barsh-draggable-settlement-popup-shell"));
check("draggable header marker exists", page.includes("data-barsh-draggable-settlement-popup-header"));
check("pointer drag events exist", page.includes("pointermove") && page.includes("pointerup"));
check("popup can resize", page.includes('resize: "both"'));
check("popup has bounded width/height", page.includes('maxWidth: "98vw"') && page.includes("minHeight"));
check("current drag copy exists", page.includes("Drag to move this settlement popup"));
check("package script registered", pkg.includes("verify:settlement-popup-draggable-safety"));
check("old close-preview aria marker absent", !page.includes('aria-label="Close settlement preview popup"'));

if (failures) {
  console.error(`FAIL: settlement popup draggable safety failed (${failures})`);
  process.exit(1);
}
console.log("PASS: settlement popup draggable safety passed for current draggable popup contract.");
