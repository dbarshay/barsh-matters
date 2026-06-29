const fs = require("fs");
const path = "app/admin/users/page.tsx";
let src = fs.readFileSync(path, "utf8");
const original = src;

function replaceOne(label, pattern, replacement) {
  const next = src.replace(pattern, replacement);
  if (next === src) {
    throw new Error(`Patch failed: ${label}`);
  }
  src = next;
}

function insertAfterOnce(label, needle, insertion) {
  if (src.includes(insertion.trim())) return;
  const index = src.indexOf(needle);
  if (index < 0) throw new Error(`Patch failed: ${label}`);
  src = src.slice(0, index + needle.length) + insertion + src.slice(index + needle.length);
}

function insertBeforeOnce(label, needle, insertion) {
  if (src.includes(insertion.trim())) return;
  const index = src.indexOf(needle);
  if (index < 0) throw new Error(`Patch failed: ${label}`);
  src = src.slice(0, index) + insertion + src.slice(index);
}

// Full-width admin layout instead of narrow centered wrapper.
src = src.replace(
  /style=\{\{\s*maxWidth:\s*1220,\s*margin:\s*"0 auto",\s*display:\s*"grid",\s*gap:\s*18\s*\}\}/,
  'style={{ width: "100%", maxWidth: "none", margin: 0, display: "grid", gap: 18 }}'
);

// Header explanation: where signer profiles live.
insertAfterOnce(
  "admin users h1 signer profile explainer",
  '<h1 style={{ margin: 0, fontSize: 30 }}>Users & Roles</h1>',
  `
          <p data-barsh-admin-users-signer-profile-location-note="true" style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>
            Signer profiles are managed on each Admin User. Use <strong>Edit / Signer Profile</strong> to manage signer eligibility, signature name, email, phone extension, and fax. These fields drive signer.* document-generation tokens.
          </p>`
);

// Add a dedicated signer-profile visibility panel before the user table.
insertBeforeOnce(
  "signer profile management panel",
  '<section data-barsh-admin-users-table="true"',
  `<section data-barsh-admin-users-signer-profile-visibility-panel="true" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 18, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Signer Profiles</h2>
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.45 }}>
                Each signer profile is stored directly on the Admin User record. A signer is usable for template generation only when eligible, active, unlocked, and complete.
              </p>
            </div>
            <span data-barsh-admin-users-signer-profile-token-note="true" style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 999, padding: "7px 10px", fontWeight: 950, fontSize: 12 }}>
              Required for signer.* tokens
            </span>
          </div>
          <div data-barsh-admin-users-signer-profile-required-fields="true" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f8fafc" }}><strong>Eligibility</strong><p style={{ margin: "6px 0 0", color: "#475569" }}>Signer Eligible must be enabled.</p></div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f8fafc" }}><strong>Signature Name</strong><p style={{ margin: "6px 0 0", color: "#475569" }}>This is the typed signature/name used by generated documents.</p></div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f8fafc" }}><strong>Contact Fields</strong><p style={{ margin: "6px 0 0", color: "#475569" }}>Email, extension, and fax resolve signer contact tokens.</p></div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f8fafc" }}><strong>No Wet Signature</strong><p style={{ margin: "6px 0 0", color: "#475569" }}>Wet signature upload/storage remains intentionally disabled.</p></div>
          </div>
        </section>
        `
);

// Make table itself show signer profile information if current header shape is present.
src = src.replace(
  /(<th[^>]*>\s*User Name\s*<\/th>)/,
  `$1<th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>Signer Profile</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>Signature Name</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>Signer Contact</th>`
);

// Update empty-state colSpan if present.
src = src.replace(/colSpan=\{5\}/g, "colSpan={8}");
src = src.replace(/colSpan="5"/g, 'colSpan="8"');

// Try to add signer cells after username in the mapped row. If the exact row differs, the visibility panel still anchors the UI, but fail loudly so we can inspect.
const rowPatterns = [
  /(<td[^>]*>\s*\{user\.username\s*\|\|\s*"—"\}\s*<\/td>)/,
  /(<td[^>]*>\s*\{user\.username\s*\|\|\s*"[-—]"\}\s*<\/td>)/,
  /(<td[^>]*>\s*\{String\(user\.username\s*\?\?\s*"[^"]*"\)\}\s*<\/td>)/
];

let rowPatched = false;
for (const pattern of rowPatterns) {
  const next = src.replace(pattern, `$1
                    <td data-barsh-admin-users-table-signer-profile-status="true" style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                      <div style={{ fontWeight: 950 }}>{user.signerEligible === false ? "Not Eligible" : user.signerProfileStatus || "Missing Fields"}</div>
                      {Array.isArray(user.signerMissingFields) && user.signerMissingFields.length > 0 ? (
                        <div style={{ color: "#991b1b", fontSize: 12, marginTop: 3 }}>Missing: {user.signerMissingFields.join(", ")}</div>
                      ) : null}
                    </td>
                    <td data-barsh-admin-users-table-signature-name="true" style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.signatureBlockName || "—"}</td>
                    <td data-barsh-admin-users-table-signer-contact="true" style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                      <div>{user.email || "—"}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>Ext: {user.phoneExtension || "—"} · Fax: {user.faxNumber || "—"}</div>
                    </td>`);
  if (next !== src) {
    src = next;
    rowPatched = true;
    break;
  }
}

if (!rowPatched) {
  console.log("WARN: Could not add signer columns to mapped row by exact username pattern; signer profile visibility panel and header note were still added.");
}

// Make the edit button label discoverable where exact simple button text exists.
src = src.replace(/>\s*Edit\s*<\/button>/g, ">Edit / Signer Profile</button>");
src = src.replace(/>\s*Edit User\s*<\/button>/g, ">Edit / Signer Profile</button>");

// Ensure create/edit signer eligibility labels are user-facing and clear.
src = src.replace(/Signer Eligible/g, "Signer Eligible");
src = src.replace(/Signature Block Name/g, "Signature Name");

if (src === original) throw new Error("No changes made.");
fs.writeFileSync(path, src);
