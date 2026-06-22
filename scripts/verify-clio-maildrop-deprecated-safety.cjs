const fs = require("fs");
const path = require("path");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const read = (p) => fs.existsSync(path.join(process.cwd(), p)) ? fs.readFileSync(path.join(process.cwd(), p), "utf8") : "";

const resolveRoute = read("app/api/documents/clio-maildrop-resolve/route.ts");
const inspectRoute = read("app/api/documents/clio-maildrop-inspect/route.ts");
const helper = read("lib/graph/maildropForDraft.ts");
const draft = read("lib/graph/draft.ts");
const delivery = read("lib/documents/delivery.ts");
const masterPage = read("app/matters/page.tsx");
const directPage = read("app/matter/[id]/page.tsx");

for (const [label, text] of [
  ["resolve route", resolveRoute],
  ["inspect route", inspectRoute],
]) {
  if (text.includes("deprecated: true")) pass(`${label} marks MailDrop deprecated`);
  else fail(`${label} does not mark MailDrop deprecated`);

  for (const forbidden of ["clioFetch(", "maildrop_address", "/api/v4/matters.json", "No mapped Clio master matter"]) {
    if (!text.includes(forbidden)) pass(`${label} excludes ${forbidden}`);
    else fail(`${label} still contains ${forbidden}`);
  }
}

if (!helper.includes("clioFetch(")) pass("maildropForDraft no longer calls Clio");
else fail("maildropForDraft still calls Clio");

if (helper.includes("return null")) pass("maildropForDraft returns null/deprecated resolution");
else fail("maildropForDraft does not return null");

if (draft.includes("readyForGraphDraftCreate: to.length > 0 && !maildropInBcc")) pass("Graph draft creation no longer requires MailDrop Cc");
else fail("Graph draft creation still appears to require MailDrop Cc");

if (!delivery.includes("formatEmailRecipient(context.clioMaildropLabel, context.clioMaildropEmail) ||")) pass("document delivery no longer auto-adds Clio MailDrop");
else fail("document delivery still auto-adds Clio MailDrop");

if (!masterPage.includes("/api/documents/clio-maildrop-resolve?source=master_lawsuit")) pass("master page no longer calls MailDrop resolver");
else fail("master page still calls MailDrop resolver");

if (!directPage.includes("/api/documents/clio-maildrop-resolve?source=direct_matter")) pass("direct page no longer calls MailDrop resolver");
else fail("direct page still calls MailDrop resolver");

console.log("RESULT: Clio MailDrop deprecation safety verifier");
if (failed) process.exit(1);
