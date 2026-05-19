import { clioFetch } from "@/lib/clio";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export type GraphDraftMaildropResolution = {
  clioMaildropEmail: string;
  clioMaildropLabel: string;
  formattedCc: string;
  source: "clio-maildrop-resolve-helper";
} | null;

function normalizeDisplayNumber(value: unknown): string {
  const raw = clean(value).toUpperCase();
  if (!raw) return "";
  if (/^BRL\d+$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `BRL${raw}`;
  return raw;
}

function maildropResultFromMatter(matter: any): GraphDraftMaildropResolution {
  const displayNumber = clean(matter?.display_number) || clean(matter?.displayNumber) || "";
  const maildropEmail = clean(matter?.maildrop_address);

  if (!maildropEmail) return null;

  const maildropLabel = `MailDrop- ${displayNumber || "Matter"}`;

  return {
    clioMaildropEmail: maildropEmail,
    clioMaildropLabel: maildropLabel,
    formattedCc: `${maildropLabel} <${maildropEmail}>`,
    source: "clio-maildrop-resolve-helper",
  };
}

async function readMatterMaildropByClioId(matterId: number): Promise<GraphDraftMaildropResolution> {
  const fields = "id,display_number,description,maildrop_address";
  const res = await clioFetch(`/matters/${matterId}.json?fields=${encodeURIComponent(fields)}`);
  const json = await res.json().catch(() => null);

  if (!res.ok) return null;

  return maildropResultFromMatter(json?.data || json);
}

async function readMatterMaildropByDisplayNumber(displayNumber: string): Promise<GraphDraftMaildropResolution> {
  const fields = "id,display_number,description,maildrop_address";
  const params = new URLSearchParams();
  params.set("query", displayNumber);
  params.set("fields", fields);

  const res = await clioFetch(`/matters.json?${params.toString()}`);
  const json = await res.json().catch(() => null);

  if (!res.ok) return null;

  const rows = Array.isArray(json?.data) ? json.data : [];
  const exact = rows.find((row: any) => clean(row?.display_number).toUpperCase() === displayNumber.toUpperCase());
  const chosen = exact || rows[0];

  return maildropResultFromMatter(chosen);
}

export async function resolveMaildropForGraphDraftMatterId(matterId: unknown): Promise<GraphDraftMaildropResolution> {
  const raw = clean(matterId);
  const numericMatterId =
    typeof matterId === "number"
      ? matterId
      : raw && /^\d+$/.test(raw)
        ? Number(raw)
        : NaN;

  if (Number.isFinite(numericMatterId) && numericMatterId > 0) {
    const byClioId = await readMatterMaildropByClioId(Math.trunc(numericMatterId));
    if (byClioId) return byClioId;
  }

  const displayNumber = normalizeDisplayNumber(matterId);
  if (displayNumber) {
    const byDisplayNumber = await readMatterMaildropByDisplayNumber(displayNumber);
    if (byDisplayNumber) return byDisplayNumber;
  }

  return null;
}
