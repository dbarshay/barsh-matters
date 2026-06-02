#!/usr/bin/env node

import fs from "node:fs";

const routePath = "app/api/lawsuits/local-generation-create/route.ts";
const route = fs.readFileSync(routePath, "utf8");

const failures = [];

function mustContain(label, needle) {
  if (!route.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, needle) {
  if (route.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

mustContain("imports clioFetch for explicit Clio document shell creation", 'import { clioFetch } from "@/lib/clio";');
mustContain("builds Clio master description from local master ID", "MASTER LAWSUIT - ${masterLawsuitId}");
mustContain("creates Clio matter through Clio matters endpoint", "clioFetch(`/api/v4/matters.json?fields=");
mustContain("uses child Clio matter client", "findClientFromChildClioMatters(selectedRows)");
mustContain("stores Clio matter id on local Lawsuit row", "clioMasterMatterId: createdClioMatter.matterId");
mustContain("stores Clio display number on local Lawsuit row", "clioMasterDisplayNumber: createdClioMatter.displayNumber");
mustContain("stores mapping source", 'clioMasterMappingSource: "barsh-matters-create-lawsuit-confirm"');
mustContain("returns created Clio matter in response", "createdClioMatter: {");
mustContain("response acknowledges Clio write", "writesClio: true");
mustContain("response acknowledges Clio master creation", "createsClioMasterMatter: true");
mustContain("document upload remains false", "uploadsDocuments: false");
mustContain("email remains false", "sendsEmail: false");
mustContain("print queue remains false", "queuesPrintJobs: false");
mustContain("Index AAA remains blank on creation", "indexAaaNumber: null");

mustNotContain("must not call separate clio-master confirm route", "/api/documents/clio-master-matter-confirm");
mustNotContain("must not prefill index number", "indexAaaNumber: selectedRows");
mustNotContain("must not use master lawsuit id as Clio display number", "clioMasterDisplayNumber: masterLawsuitId");

console.log("RESULT: verify Create Lawsuit Clio shell contract");
console.log("FILE=" + routePath);
console.log("EXPECTS_LOCAL_LAWSUIT_CREATE=YES");
console.log("EXPECTS_CHILD_CLAIMINDEX_LINK=YES");
console.log("EXPECTS_CLIO_MASTER_DOCUMENT_SHELL=YES");
console.log("EXPECTS_CLIO_ASSIGNED_BRL_MAPPING=YES");
console.log("EXPECTS_NO_DOCUMENT_DELIVERY_SIDE_EFFECTS=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
