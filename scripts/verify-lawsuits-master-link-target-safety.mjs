import fs from "node:fs";

const searchRoute = fs.readFileSync("app/api/claim-index/search-grouped/route.ts", "utf8");
const lawsuitsPage = fs.readFileSync("app/lawsuits/page.tsx", "utf8");

const failures = [];
function must(label, text, tokens) {
  const list = Array.isArray(tokens) ? tokens : [tokens];
  if (!list.some((token) => text.includes(token))) {
    failures.push(`${label}: missing one of ${list.join(" OR ")}`);
  }
}
function mustNot(label, text, token) {
  if (text.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

must("search route attaches master lawsuit id", searchRoute, "masterLawsuitId");
must("search route attaches master/display mapping", searchRoute, ["displayNumber", "display_number", "matterDisplayNumber", "masterDisplayNumber", "master_display_number"]);
must("lawsuits page has linked-field search helper", lawsuitsPage, "searchLinkedField");
must("lawsuits page has index number helper", lawsuitsPage, "indexNumber");
must("lawsuits page links/searches index number", lawsuitsPage, "indexAaaNumber");
must("lawsuits page supports direct master navigation/search", lawsuitsPage, ["/matters", "masterLawsuitId", "openMaster"]);
mustNot("lawsuits page must not call clioFetch", lawsuitsPage, "clioFetch(");

console.log("RESULT: verify lawsuits master link target safety");
console.log("EXPECTS_CLIO_MAPPING_ATTACHED_TO_LOCAL_SEARCH_ROWS=YES");
console.log("EXPECTS_SEARCH_OR_NAVIGATION_FOR_MASTER_AND_INDEX=YES");
console.log("FAILURES=" + failures.length);
for (const failure of failures) console.log("FAIL=" + failure);
if (failures.length) process.exit(1);
console.log("PASS: lawsuits master link target safety passed.");
