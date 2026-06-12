import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const failures = [];

for (const token of [
  'const [directActionGroup, setDirectActionGroup] = useState<"payments" | "documents" | null>(null);',
  'const [directPaymentsPanelOpen, setDirectPaymentsPanelOpen] = useState(false);',
  'data-barsh-direct-actions-outer-section="true"',
  'data-barsh-direct-actions-section-heading="true"',
  'data-barsh-direct-action-area="true"',
  'data-barsh-direct-action-tab-row="true"',
  'data-barsh-direct-action-panel="true"',
  'transform: "none"',
  'boxShadow: "none"',
  'verticalAlign: "top"',
  'margin: 0',
  'WebkitAppearance: "none"',
  'appearance: "none"',
  'maxWidth: 132',
  'gridColumn: "1 / 2"',
  'data-barsh-direct-payment-warning-under-post="true"',
  'gridTemplateColumns: "132px 132px"',
  'lineHeight: 1',
  'justifyContent: "center"',
  'alignItems: "center"',
  'display: "inline-flex"',
  'height: 36',
  'minWidth: 132',
  'width: 132',
  'width: "fit-content"',
  'flex: "0 0 auto"',
  'data-barsh-direct-action-tab={key}',
  '{ key: "payments", label: "Payments", fill: "#16a34a", soft: "#f0fdf4", text: "#166534" }',
  '{ key: "documents", label: "Documents", fill: "#8b5e3c", soft: "#f8efe7", text: "#7c4a22" }',
  'directActionGroup === "payments"',
  'directActionGroup === "documents"',
  'Post Payment',
  'View Payments',
  'View Documents',
  'View Emails',
  'Generate Documents',
  'data-barsh-direct-view-payments-button="true"',
  'data-barsh-direct-view-documents-button="true"',
  'data-barsh-direct-view-emails-button="true"',
  'data-barsh-direct-generate-documents-button="true"',
  'onClick={() => setDirectPaymentsPanelOpen((open) => !open)}',
  '{directPaymentsPanelOpen && (',
  'className="barsh-direct-payment-receipts"',
  'color: "#1e3a8a"',
  'marginBottom: 8',
]) {
  if (!page.includes(token)) failures.push(`missing direct matter master-style Actions token: ${token}`);
}

for (const token of [
  'setPaymentApplyResult(null);',
  'setPaymentFormOpen((open) => !open);',
  'onClick={() => void openMatterViewDocumentsPopup()}',
  'setActiveWorkspaceTab("email_threads");',
  'void loadMatterEmailThreadPreview();',
  'onClick={launchMatterDocumentGenerationDialog}',
]) {
  if (!page.includes(token)) failures.push(`direct matter Actions handler missing token: ${token}`);
}

const areaStart = page.indexOf('data-barsh-direct-action-area="true"');
const areaEnd = page.indexOf('<div style={{ textAlign: "center", marginBottom: 12 }}>', areaStart);
const area = areaStart >= 0 && areaEnd > areaStart ? page.slice(areaStart, areaEnd) : "";

for (const forbidden of [
  'Close Matter',
  'Start Lawsuit',
  'Document Activity',
  'Payment Actions',
  'Matter Actions',
  'document.querySelector(".barsh-direct-payment-receipts")?.scrollIntoView',
  'barsh-direct-apply-payment-button',
]) {
  if (area.includes(forbidden)) failures.push(`old/non-master-style direct action still appears in Actions box: ${forbidden}`);
}

if (failures.length) {
  console.error("FAIL: direct matter Actions box style safety");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: direct matter Actions box style safety");
