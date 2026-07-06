import { assertGraphDraftEnvironmentReady, graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { listOpenReport } from "@/lib/import/cariskManagementReport";

// Compose + send the weekly Carisk Management Report (open "Saved Incomplete" bills) as an email via
// Microsoft Graph. Recipient comes from `CARISK_REPORT_RECIPIENT` (comma-separated ok). Read-only over
// the DB except the send itself; safe to call from a cron/scheduled endpoint.

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
const money = (n: number | null | undefined) => (n == null ? "—" : `$${Number(n).toFixed(2)}`);
const dos = (a?: string | null, b?: string | null) => (a && b && a !== b ? `${a} – ${b}` : a || b || "—");

export function reportRecipients(): string[] {
  return String(process.env.CARISK_REPORT_RECIPIENT || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function buildReportHtml(): Promise<{ rows: number; subject: string; html: string; text: string }> {
  const items = await listOpenReport();
  const when = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const subject = `Carisk Management Report — ${items.length} open Saved-Incomplete bill(s) — ${when}`;

  const header = ["CIC #", "Patient", "Provider", "Carrier", "DOS", "Charges", "Status date", "Rejection detail", "First seen", "Last seen"];
  const rowsHtml = items
    .map((r: any) => `<tr>${[
      esc(r.cicNumber), esc(r.patientName), esc(r.providerName), esc(r.carrierName),
      esc(dos(r.dosStart, r.dosEnd)), money(r.claimAmount), esc(r.statusDate || "—"),
      esc((r.rejectionDetail || "").slice(0, 300)),
      esc(new Date(r.firstSeen).toLocaleDateString()), esc(new Date(r.lastSeen).toLocaleDateString()),
    ].map((c) => `<td style="border:1px solid #cbd5e1;padding:4px 8px;font-size:12px;vertical-align:top">${c}</td>`).join("")}</tr>`)
    .join("");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#00346e">
      <h2 style="margin:0 0 4px">Carisk Management Report</h2>
      <div style="color:#385a83;margin-bottom:12px">${items.length} open Saved-Incomplete bill(s) as of ${esc(when)}. These bills were rejected by the insurer as incomplete and have not yet arrived as a Carrier Submission (which would create a matter).</div>
      ${items.length === 0 ? "<div>No open items — nothing to report.</div>" : `
      <table style="border-collapse:collapse;width:100%">
        <thead><tr>${header.map((h) => `<th style="border:1px solid #cbd5e1;padding:4px 8px;background:#eaf1fb;text-align:left;font-size:12px">${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`}
    </div>`;

  const text = items.length === 0
    ? "Carisk Management Report: no open items."
    : `Carisk Management Report (${items.length} open):\n` + items.map((r: any) => `- ${r.cicNumber} · ${r.patientName || ""} · ${r.carrierName || ""} · ${dos(r.dosStart, r.dosEnd)} · ${money(r.claimAmount)}`).join("\n");

  return { rows: items.length, subject, html, text };
}

/** Send the report via Graph. Returns a result object; never throws. */
export async function sendReportEmail(): Promise<{ ok: boolean; rows?: number; sentTo?: string[]; error?: string }> {
  const recipients = reportRecipients();
  if (!recipients.length) return { ok: false, error: "No CARISK_REPORT_RECIPIENT configured." };

  const env = assertGraphDraftEnvironmentReady();
  if (!env.ok) return { ok: false, error: env.error };

  const { rows, subject, html } = await buildReportHtml();
  const send = await graphFetchJson({
    url: `${graphApiBase()}/users/${encodeURIComponent(env.mailboxUserId)}/sendMail`,
    method: "POST",
    body: {
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    },
  });
  if (!send.ok) return { ok: false, rows, error: send.error };
  return { ok: true, rows, sentTo: recipients };
}
