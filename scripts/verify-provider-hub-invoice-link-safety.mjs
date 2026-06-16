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

mustContain("hub invoice workflow link marker", hub, 'data-barsh-provider-invoice-workflow-link="true"');
mustContain("hub invoice workflow href", hub, 'href={`/admin/clients/${encodeURIComponent(id)}/invoice`}');
mustContain("hub invoice label", hub, "Invoicing / Remittance");
mustContain("hub individual matters preserved", hub, "Individual Matters");
mustContain("hub lawsuit matters preserved", hub, "Lawsuit Matters");
mustContain("hub attorney fee report preserved", hub, "Attorney Fee Report");
mustNotContain("hub must not use remittance preview button marker", hub, 'data-barsh-provider-remittance-preview-button="true"');
mustNotContain("hub must not toggle remittance panel", hub, 'activeWorkflowPanel === "remittance"');
mustNotContain("page must not retain obsolete inline remittance panel", page, 'activeWorkflowPanel === "remittance" &&');
mustNotContain("page must not retain obsolete preview title", page, "Invoicing / Remittance Preview");
mustNotContain("page must not retain obsolete placeholder-only filter", page, 'placeholder="Collection"');
mustNotContain("page must not retain full workflow link inside removed panel", page, "Open Full Invoice Workflow");

console.log("PASS: provider hub invoice link safety");
