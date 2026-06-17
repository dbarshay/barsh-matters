#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

const registry = fs.readFileSync("lib/adminPermissions.ts", "utf8");
const proxy = fs.readFileSync("proxy.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];

const routeMatches = [...registry.matchAll(/\{ pattern: "([^"]+)", permission: "([^"]+)", accessType: "([^"]+)"(?:, method: "([^"]+)")?/g)].map((m) => ({ pattern: m[1], permission: m[2], accessType: m[3], method: m[4] || "ANY" }));
const mapped = new Set(routeMatches.map((r) => r.pattern));
const permissionDefs = new Set([...registry.matchAll(/\{ key: "([^"]+)"/g)].map((m) => m[1]));
const neverBlock = new Set([...registry.matchAll(/"(\/admin(?:\/permissions)?|\/api\/admin\/permissions(?:\/check)?)"/g)].map((m) => m[1]));

const pageFiles = execSync("find app/admin -maxdepth 5 -name page.tsx -print | sort", { encoding: "utf8" }).trim().split(/\n/).filter(Boolean).map((f) => "/" + f.replace(/^app\//, "").replace(/\/page\.tsx$/, "").replace(/\[([^\]]+)\]/g, ":$1"));
const apiFiles = execSync("find app/api/admin -maxdepth 6 -name route.ts -print | sort", { encoding: "utf8" }).trim().split(/\n/).filter(Boolean).map((f) => "/" + f.replace(/^app\//, "").replace(/\/route\.ts$/, "").replace(/\[([^\]]+)\]/g, ":$1"));
const authBootstrapExceptions = new Set(["/api/admin/authorize"]);

const missingPages = pageFiles.filter((p) => !mapped.has(p));
const missingApis = apiFiles.filter((p) => !mapped.has(p) && !authBootstrapExceptions.has(p));
const unexpectedExceptions = [...authBootstrapExceptions].filter((p) => !apiFiles.includes(p));
const missingDefs = routeMatches.filter((r) => !permissionDefs.has(r.permission));
const duplicateRoutes = routeMatches.filter((r, i, a) => a.findIndex((x) => x.pattern === r.pattern && x.method === r.method) !== i);

if (!proxy.includes("if (pathname === ADMIN_AUTHORIZE_PATH)")) failures.push("proxy missing explicit authorize bootstrap bypass");
if (!mapped.has("/api/admin/clients/:id/invoice/:invoiceId")) failures.push("missing invoice detail GET mapping");
if (!registry.includes("/api/admin/clients/:id/invoice/:invoiceId\", permission: \"admin.invoices.view\"")) failures.push("invoice detail mapping should use admin.invoices.view");
if (missingPages.length) failures.push("missing admin page mappings: " + JSON.stringify(missingPages));
if (missingApis.length) failures.push("missing admin API mappings excluding authorize bootstrap: " + JSON.stringify(missingApis));
if (unexpectedExceptions.length) failures.push("auth bootstrap exception no longer exists: " + JSON.stringify(unexpectedExceptions));
if (missingDefs.length) failures.push("missing permission definitions: " + JSON.stringify(missingDefs));
if (duplicateRoutes.length) failures.push("duplicate route mappings: " + JSON.stringify(duplicateRoutes));
for (const required of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) if (!neverBlock.has(required)) failures.push("required never-block safety route missing: " + required);
if (mapped.has("/api/admin/authorize")) failures.push("authorize bootstrap route should not be permission-mapped; proxy bypass handles it before auth");
if (pkg.scripts?.["verify:admin-permissions-matrix-coverage-safety"] !== "node scripts/verify-admin-permissions-matrix-coverage-safety.mjs") failures.push("package script missing");

console.log("RESULT: admin permissions matrix coverage safety verifier");
console.log("MISSING_PAGE_MAPPINGS=" + JSON.stringify(missingPages));
console.log("MISSING_API_MAPPINGS_EXCLUDING_AUTHORIZE=" + JSON.stringify(missingApis));
console.log("AUTH_BOOTSTRAP_EXCEPTIONS=" + JSON.stringify([...authBootstrapExceptions]));
if (failures.length) { console.log("FAILURES=" + failures.length); for (const f of failures) console.log("FAIL=" + f); process.exit(1); }
console.log("FAILURES=0");
console.log("PASS: all admin pages/APIs are permission-mapped except the explicit authorize bootstrap route, and invoice detail is mapped read-only.");
