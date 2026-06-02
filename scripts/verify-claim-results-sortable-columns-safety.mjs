import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");

let failed = false;

function requireText(label, haystack, needle) {
  if (!haystack.includes(needle)) {
    console.error(`FAIL: missing ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const tableAnchor = page.indexOf('{sortableClaimResultsHeader("Matter", "matter")}');
const tableEnd = page.indexOf('</table>', tableAnchor);
const tableBlock =
  tableAnchor >= 0 && tableEnd > tableAnchor ? page.slice(tableAnchor, tableEnd) : "";

requireText("sort key type exists", page, "type ClaimResultsSortKey =");
requireText("sort state type exists", page, "type ClaimResultsSortState =");
requireText("sort value helper exists", page, "function matterRowSortValue(row: MatterRow, key: ClaimResultsSortKey)");
requireText("sort row helper exists", page, "function sortMatterRows(rows: MatterRow[], sort: ClaimResultsSortState)");
requireText("claim sort state exists", page, "const [claimResultsSort, setClaimResultsSort] = useState<ClaimResultsSortState>(null);");
requireText("sortedRows memo exists", page, "const sortedRows = useMemo(() => sortMatterRows(rows, claimResultsSort), [rows, claimResultsSort]);");
requireText("sort toggle exists", page, "function toggleClaimResultsSort(key: ClaimResultsSortKey)");
requireText("sort indicator exists", page, "function claimResultsSortIndicator(key: ClaimResultsSortKey): string");
requireText("sortable header renderer exists", page, "function sortableClaimResultsHeader(");
requireText("sort button style exists", page, "const claimResultsSortButtonStyle: React.CSSProperties =");
requireText("table renders sorted rows", page, "{sortedRows.map((row) => (");

[
  ['Matter', 'matter'],
  ['Patient', 'patient'],
  ['Provider', 'provider'],
  ['Insurer', 'insurer'],
  ['Claim', 'claim'],
  ['DOS', 'dos'],
  ['Denial Reason', 'denialReason'],
  ['Master Lawsuit', 'masterLawsuit'],
  ['Claim Amount', 'claimAmount'],
  ['Balance', 'balance'],
  ['Status', 'status'],
].forEach(([label, key]) => {
  requireText(`${label} sortable header`, tableBlock, `sortableClaimResultsHeader("${label}", "${key}`);
});

if (failed) process.exit(1);

console.log("PASS: claim-filtered results table columns are sortable.");
