import fs from "fs";
import http from "http";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path,
        method: "GET",
        timeout: 10000,
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {}
          resolve({ status: res.statusCode, raw, json });
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error(`GET ${path} timed out`)));
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const searchGrouped = fs.readFileSync("app/api/claim-index/search-grouped/route.ts", "utf8");
  const home = fs.readFileSync("app/page.tsx", "utf8");
  const lawsuits = fs.readFileSync("app/lawsuits/page.tsx", "utf8");

  const forbiddenSearchGrouped = [
    "clioFetch",
    "getValidClioAccessToken",
    "ingestMattersFromClioBatch",
    "indexMatterInternal",
    "expandFromSeed",
    "clioQueryCache",
    "getClioMetrics",
    "resetClioMetrics",
    "CLIO_API_BASE",
    "directClioFallbackMatterIds",
    "searchClioMatterIdsByQuery",
    "Clio remains the source of truth",
  ];

  const searchGroupedHits = forbiddenSearchGrouped.filter((needle) => searchGrouped.includes(needle));
  assert(searchGroupedHits.length === 0, `search-grouped still has Clio operational markers: ${searchGroupedHits.join(", ")}`);
  assert(searchGrouped.includes('source: "claim-index-local-only"'), "search-grouped must report local-only source.");
  assert(searchGrouped.includes("noClioHydration: true"), "search-grouped must report noClioHydration=true.");

  assert(!home.includes('/api/advanced-search/hydrate'), "Home page still calls blocked advanced-search hydrate route.");
  assert(home.includes('/api/advanced-search/candidates?limit='), "Home fallback should use local advanced-search candidates.");

  assert(!lawsuits.includes('/api/aggregation/from-search'), "Lawsuits page still calls legacy aggregation/from-search.");
  assert(lawsuits.includes('/api/lawsuits/local-generation-preview'), "Lawsuits page must call local generation preview.");
  assert(lawsuits.includes('/api/lawsuits/local-generation-create'), "Lawsuits page must call local generation create.");

  const grouped = await get("/api/claim-index/search-grouped?claim=123456");
  assert(grouped.status === 200, `search-grouped expected 200, got ${grouped.status}: ${grouped.raw.slice(0, 500)}`);
  assert(grouped.json?.ok === true, "search-grouped expected ok=true.");
  assert(grouped.json?.source === "claim-index-local-only", "search-grouped expected local-only source.");
  assert(grouped.json?.noClioRead === true, "search-grouped expected noClioRead=true.");
  assert(grouped.json?.noClioWrite === true, "search-grouped expected noClioWrite=true.");
  assert(grouped.json?.noClioHydration === true, "search-grouped expected noClioHydration=true.");
  assert(Number(grouped.json?.count) === 10, `search-grouped expected claim 123456 count 10 before actual create, got ${grouped.json?.count}`);

  console.log("RESULT: local search and lawsuits routing safety");
  console.log("LOCAL_SEARCH_ROUTING_STATUS=0");
  console.log("SEARCH_GROUPED_LOCAL_ONLY=true");
  console.log("SEARCH_GROUPED_COUNT_123456=" + grouped.json.count);
  console.log("HOME_ADVANCED_HYDRATE_REMOVED=true");
  console.log("LAWSUITS_FROM_SEARCH_REMOVED=true");
  console.log("LAWSUITS_LOCAL_PREVIEW_CREATE_WIRED=true");
  console.log("WRITES_CLIO=false");
}

main().catch((error) => {
  console.error("RESULT: local search and lawsuits routing safety");
  console.error("LOCAL_SEARCH_ROUTING_STATUS=1");
  console.error("ERROR=" + (error?.message || String(error)));
  process.exit(1);
});
