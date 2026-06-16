import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function fail(message) { console.error(`FAIL: ${message}`); process.exit(1); }
function pass(message) { console.log(`PASS: ${message}`); }
function mustContain(label, text, needle) { if (!text.includes(needle)) fail(`${label} missing ${needle}`); pass(label); }
function mustNotContain(label, text, needle) { if (text.includes(needle)) fail(`${label} contains forbidden ${needle}`); pass(label); }

const page = read("app/admin/clients/[id]/page.tsx");
const hubStart = page.indexOf("<h2 style={providerHubSectionTitleStyle}>Provider Workflow Hub</h2>");
const hubEnd = page.indexOf("</div>\n        </div>\n      </section>", hubStart);
if (hubStart < 0 || hubEnd < 0) fail("Provider Workflow Hub block not found");
const hub = page.slice(hubStart, hubEnd);

mustContain("hub remittance preview button marker", hub, 'data-barsh-provider-remittance-preview-button="true"');
mustContain("hub remittance toggles inline panel", hub, 'setActiveWorkflowPanel(activeWorkflowPanel === "remittance" ? "" : "remittance")');
mustContain("hub remittance active style", hub, 'activeWorkflowPanel === "remittance" ? "#1d4ed8"');
mustNotContain("hub remittance must not navigate directly", hub, 'href={`/admin/clients/${encodeURIComponent(id)}/invoice`}');
mustContain("inline remittance panel remains", page, 'activeWorkflowPanel === "remittance"');
mustContain("inline remittance placeholder is user-facing", page, 'placeholder="Collection"');
mustContain("full invoice workflow link preserved", page, 'data-barsh-open-full-invoice-workflow-link="true"');
mustContain("full invoice workflow href preserved", page, 'href={`/admin/clients/${encodeURIComponent(id)}/invoice`}');
mustContain("full invoice workflow label", page, "Open Full Invoice Workflow");

console.log("PASS: provider hub remittance preview button safety");
