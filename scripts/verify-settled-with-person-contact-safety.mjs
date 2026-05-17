#!/usr/bin/env node
import fs from "fs";
import path from "path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) {
    throw new Error(`${label} missing required text: ${needle}`);
  }
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) {
    throw new Error(`${label} contains forbidden text: ${needle}`);
  }
}

function mustExist(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
}

function mustNotExist(relativePath) {
  if (fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Forbidden obsolete file still exists: ${relativePath}`);
  }
}

function main() {
  const localContactSearchRoutePath = "app/api/reference-data/contact-search/route.ts";
  const directMatterPage = read("app/matter/[id]/page.tsx");
  const masterPage = read("app/matters/page.tsx");
  const packageJson = read("package.json");

  mustExist(localContactSearchRoutePath);
  mustNotExist("app/api/clio/contacts/search/route.ts");

  const localContactSearchRoute = read(localContactSearchRoutePath);

  mustContain("local contact search route", localContactSearchRoute, "source: \"local-reference-data\"");
  mustContain("local contact search route", localContactSearchRoute, "clioRead: false");
  mustContain("local contact search route", localContactSearchRoute, "clioWrite: false");
  mustContain("local contact search route", localContactSearchRoute, "ReferenceEntity/local Barsh Matters data");
  mustContain("local contact search route", localContactSearchRoute, "prisma.referenceEntity.findMany");
  mustContain("local contact search route", localContactSearchRoute, "displayName");
  mustContain("local contact search route", localContactSearchRoute, "normalizedName");
  mustContain("local contact search route", localContactSearchRoute, "normalizedAlias");
  mustContain("local contact search route", localContactSearchRoute, "referenceEntityId");
  mustContain("local contact search route", localContactSearchRoute, "type: contactType");

  mustNotContain("local contact search route", localContactSearchRoute, "getValidClioAccessToken");
  mustNotContain("local contact search route", localContactSearchRoute, "clioFetch");
  mustNotContain("local contact search route", localContactSearchRoute, "CLIO_API_BASE");
  mustNotContain("local contact search route", localContactSearchRoute, "method: \"PATCH\"");
  mustNotContain("local contact search route", localContactSearchRoute, "method: \"POST\"");
  mustNotContain("local contact search route", localContactSearchRoute, "method: \"DELETE\"");

  mustContain("direct matter page", directMatterPage, "/api/reference-data/contact-search");
  mustContain("master lawsuit page", masterPage, "/api/reference-data/contact-search");
  mustContain("master lawsuit page", masterPage, "Search Local Contact");

  mustNotContain("direct matter page", directMatterPage, "/api/clio/contacts/search");
  mustNotContain("master lawsuit page", masterPage, "/api/clio/contacts/search");

  mustContain("package.json", packageJson, "verify:settled-with-person-contact-safety");

  console.log("Settled-with local contact search safety verifier passed.");
}

try {
  main();
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
}
