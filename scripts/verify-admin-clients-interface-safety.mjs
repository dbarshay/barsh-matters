import fs from "fs";

const checks = [
  {
    file: "app/admin/page.tsx",
    tests: [
      ['href: "/admin/clients"', "Admin Home links to Clients"],
      ['label: "Clients"', "Admin Home has Clients card label"],
    ],
  },
  {
    file: "app/admin/clients/page.tsx",
    tests: [
      ["/api/admin/clients", "Clients page loads local admin clients API"],
      ["encodeURIComponent(row.id)", "Clients table links client names to detail pages"],
    ],
  },
  {
    file: "app/admin/clients/[id]/page.tsx",
    tests: [
      ["Client Info", "Client detail page includes Client Info"],
      ["Invoicing / Remittance", "Client detail page includes invoicing/remittance"],
      ["Child Matters", "Client detail page includes child matters"],
      ["Payment Receipt Rows", "Client detail page includes receipt rows"],
      ["Export CSV", "Client detail page includes CSV export"],
      ["child-matter based", "Client detail page states child-matter reporting basis"],
    ],
  },
  {
    file: "app/api/admin/clients/route.ts",
    tests: [
      ['type: "provider_client"', "Clients API is scoped to provider_client"],
      ["ReferenceEntity/ReferenceAlias", "Clients API declares local reference source of truth"],
      ["does not call Clio", "Clients API safety copy blocks Clio"],
    ],
  },
  {
    file: "app/api/admin/clients/[id]/route.ts",
    tests: [
      ["provider_client", "Client detail API is scoped to provider_client"],
      ["claimIndex.findMany", "Client detail API reads ClaimIndex child matters"],
      ["matterPaymentReceipt.findMany", "Client detail API reads MatterPaymentReceipt child ledger"],
      ["does not call Clio", "Client detail API safety copy blocks Clio"],
      ["child-ledger", "Client detail API describes child-ledger source"],
    ],
  },
];

let failures = 0;

for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(`FAIL missing ${check.file}`);
    failures++;
    continue;
  }
  const text = fs.readFileSync(check.file, "utf8");
  for (const [needle, label] of check.tests) {
    if (!text.includes(needle)) {
      console.error(`FAIL ${label}: missing ${needle} in ${check.file}`);
      failures++;
    } else {
      console.log(`PASS ${label}`);
    }
  }
}

const forbidden = [
  ["app/api/admin/clients/route.ts", "clio"],
  ["app/api/admin/clients/[id]/route.ts", "clio"],
];

for (const [file, needle] of forbidden) {
  const text = fs.readFileSync(file, "utf8").toLowerCase();
  const occurrences = [...text.matchAll(new RegExp(needle, "g"))].length;
  // Safety copy may mention Clio; imports/calls should not exist.
  if (/from\s+["'].*clio|clioClient|fetchClio|updateClio|postToClio/i.test(fs.readFileSync(file, "utf8"))) {
    console.error(`FAIL ${file} appears to import/call Clio`);
    failures++;
  } else {
    console.log(`PASS ${file} has no Clio import/client call (${occurrences} safety-copy mention(s) allowed)`);
  }
}

if (failures) {
  console.error(`FAILURES=${failures}`);
  process.exit(1);
}

console.log("PASS admin clients interface safety verifier");
