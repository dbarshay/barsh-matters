// Migration watchdog. Run from cron every ~15 min. It ONLY reads the ledger (Postgres) and checks whether
// the extract process is alive — it never touches Atlas, so it cannot disturb the refresh-token chain.
//
// It alerts when the sweep STALLS: either `done` has not increased for ALERT_MINUTES, or the extract process
// is gone while cases remain pending. Alerts fire once per stall (with a cooldown) via a webhook you provide.
//
//   node watchdog.mjs
//
// Env (put in .env next to this file, or export before running):
//   MIGRATION_DATABASE_URL   the dedicated ledger DB (already set for the migration)
//   ALERT_MINUTES            stall threshold in minutes (default 60)
//   --- email via Azure Communication Services (preferred; no third party) ---
//   ACS_CONNECTION_STRING    from the ACS resource ("Keys" blade). Azure blocks VM port 25, so this API
//                            path is the sanctioned way to send mail from an Azure VM.
//   ACS_SENDER_ADDRESS       e.g. DoNotReply@<guid>.azurecomm.net (the managed domain's MailFrom address)
//   ALERT_EMAIL              where to send the alert (your inbox)
//   --- optional fallback ---
//   WATCHDOG_WEBHOOK_URL     if set and email isn't configured, POST the alert here instead
//
// Requires the ACS email SDK once:  npm i @azure/communication-email
//
// Cron (every 15 min), added by the deploy line below:
//   */15 * * * * cd /home/azureuser/atlas-migration && /usr/bin/node watchdog.mjs >> watchdog.log 2>&1

import { Pool } from "pg";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";

// --- load .env (same minimal parser the pipeline uses) ---
const env = {};
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const get = (k, d) => process.env[k] ?? env[k] ?? d;

const DB = get("MIGRATION_DATABASE_URL");
const WEBHOOK = get("WATCHDOG_WEBHOOK_URL");
const ACS_CONN = get("ACS_CONNECTION_STRING");
const ACS_SENDER = get("ACS_SENDER_ADDRESS");
const ALERT_EMAIL = get("ALERT_EMAIL");
const ALERT_MINUTES = Number(get("ALERT_MINUTES", 60));
const STATE_FILE = "watchdog-state.json";
const now = Date.now();
const stamp = new Date().toISOString();

if (!DB) {
  console.error(`[${stamp}] no MIGRATION_DATABASE_URL — cannot check ledger`);
  process.exit(1);
}

const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, "utf8"))
  : { lastDone: -1, lastProgressTs: now, alerted: false };

async function sendEmail(subject, detail) {
  // Uses Azure Communication Services Email (the SDK signs the request; no port-25 needed).
  const { EmailClient } = await import("@azure/communication-email");
  const client = new EmailClient(ACS_CONN);
  const poller = await client.beginSend({
    senderAddress: ACS_SENDER,
    content: { subject: `Atlas migration watchdog: ${subject}`, plainText: detail },
    recipients: { to: [{ address: ALERT_EMAIL }] },
  });
  await poller.pollUntilDone();
}

async function fire(subject, detail) {
  console.error(`[${stamp}] ALERT: ${subject} — ${detail}`);
  const body = `${subject}\n\n${detail}\n\n(sent ${stamp})`;

  if (ACS_CONN && ACS_SENDER && ALERT_EMAIL) {
    try {
      await sendEmail(subject, body);
      console.error(`[${stamp}] alert emailed to ${ALERT_EMAIL} via Azure Communication Services`);
      return;
    } catch (e) {
      console.error(`[${stamp}] ACS email failed: ${e?.message || e} — falling back`);
    }
  }
  if (WEBHOOK) {
    try {
      const text = `⚠️ Atlas migration watchdog: ${body}`;
      await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, content: text, subject, detail, at: stamp }),
      });
      console.error(`[${stamp}] alert delivered to webhook`);
      return;
    } catch (e) {
      console.error(`[${stamp}] webhook POST failed: ${e?.message || e}`);
    }
  }
  console.error(`[${stamp}] (no delivery channel configured — alert logged only)`);
}

const pool = new Pool({ connectionString: DB });
try {
  const r = await pool.query("SELECT count(*)::int done FROM legacy_case WHERE status='done'");
  const p = await pool.query("SELECT count(*)::int pending FROM legacy_case WHERE status IN ('pending','listed','error')");
  const done = r.rows[0].done;
  const pending = p.rows[0].pending;

  // Is the extract process alive?
  let running = false;
  try {
    execSync("pgrep -f 'tsx extract.ts --run' >/dev/null 2>&1");
    running = true;
  } catch {
    running = false;
  }

  const progressed = done > state.lastDone;
  if (progressed) {
    // Healthy — reset the clock and the alert latch.
    writeFileSync(STATE_FILE, JSON.stringify({ lastDone: done, lastProgressTs: now, alerted: false }));
    console.log(`[${stamp}] ok — done=${done}, pending=${pending}, running=${running}`);
  } else {
    const stalledMin = Math.round((now - state.lastProgressTs) / 60000);
    const processDown = !running && pending > 0;
    const stalledLong = stalledMin >= ALERT_MINUTES;

    if ((processDown || stalledLong) && !state.alerted) {
      const why = processDown
        ? `extract process is NOT running and ${pending.toLocaleString()} cases are still pending`
        : `no progress for ${stalledMin} min (done stuck at ${done.toLocaleString()})`;
      await fire("sweep stalled", `${why}. SSH in: ssh azureuser@20.83.169.218, then tmux attach -t migrate.`);
      writeFileSync(STATE_FILE, JSON.stringify({ ...state, alerted: true }));
    } else {
      console.log(`[${stamp}] no progress (${stalledMin}min), running=${running}, alerted=${state.alerted}`);
    }
  }
} catch (e) {
  console.error(`[${stamp}] watchdog DB error: ${e?.message || e}`);
} finally {
  await pool.end().catch(() => {});
}
