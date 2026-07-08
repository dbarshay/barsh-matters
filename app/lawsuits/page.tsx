"use client";

import React, { useEffect, useMemo, useState } from "react";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeader from "@/app/components/BarshHeader";
import OldFileNumberField from "@/components/OldFileNumberField";
import * as XLSX from "xlsx";

type Matter = any;
type ClaimGroup = any;

function matterId(m: Matter) {
  return String(m.matterId ?? m.matter_id ?? m.id ?? "");
}

function displayNumber(m: Matter) {
  return m.displayNumber ?? m.display_number ?? m.matterNumber ?? m.matter_number ?? matterId(m);
}

function val(m: Matter, ...keys: string[]) {
  for (const k of keys) {
    if (m?.[k] !== undefined && m?.[k] !== null && m?.[k] !== "") return m[k];
  }
  return "";
}

function raw(m: Matter) {
  const r = m?.raw_json ?? m?.rawJson;
  if (!r) return null;
  if (typeof r === "object") return r;
  if (typeof r === "string") {
    try {
      return JSON.parse(r);
    } catch {
      return null;
    }
  }
  return null;
}

function insurerName(m: Matter) {
  const r = raw(m);

  return (
    val(
      m,
      "insurerName",
      "insurer_name",
      "insuranceCompanyName",
      "insurance_company_name",
      "insuranceCompany",
      "insurance_company"
    ) ||
    m?.insurance_company?.name ||
    m?.insuranceCompany?.name ||
    m?.insurer?.name ||
    r?.insurance_company?.name ||
    r?.insuranceCompany?.name ||
    r?.insurer?.name ||
    r?.custom_field_values?.find?.((cf: any) =>
      String(cf?.custom_field?.name ?? cf?.name ?? "")
        .toLowerCase()
        .includes("insurance")
    )?.value ||
    ""
  );
}

function adversaryAttorneyName(m: Matter) {
  return (
    val(m, "adversaryAttorney", "adversary_attorney") ||
    val(m, "adversaryAttorneyName", "adversary_attorney_name") ||
    "—"
  );
}


function moneyValue(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(v: unknown) {
  return moneyValue(v).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function getRows(g: ClaimGroup): Matter[] {
  return g.matters ?? g.rows ?? g.items ?? [];
}

function getClaimNumber(g: ClaimGroup) {
  return g.claimNumber ?? g.claim_number ?? g.claimNumberNormalized ?? g.claim_number_normalized ?? "(no claim number)";
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeExportCell(value: unknown): string {
  return String(value ?? "").trim();
}

const standardCaseExportHeaders = [
  "Due",
  "Type",
  "Created",
  "Updated",
  "Matter",
  "Master Lawsuit",
  "Provider",
  "Patient",
  "Insurer",
  "Adversary Attorney",
  "Claim Number",
  "Date of Loss",
  "Court",
  "Index Number",
  "Date Filed",
  "Settled Date",
  "Settled With",
  "Denial Reason",
  "Status",
  "Closed Reason",
  "Closed Date",
];

function downloadWorkbookRows(headers: string[], rows: unknown[][], filename: string, sheetName: string) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

function pickAny(source: any, keys: string[]): string {
  for (const key of keys) {
    const value = source?.[key];
    const cleaned = safeExportCell(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function pickMeta(source: any, keys: string[]): string {
  const metadata = source?.metadata && typeof source.metadata === "object" ? source.metadata : {};
  for (const key of keys) {
    const value = metadata?.[key];
    const cleaned = safeExportCell(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function masterId(m: Matter) {
  return val(m, "masterLawsuitId", "master_lawsuit_id") || "";
}

function clioMasterMatterId(m: Matter) {
  return val(m, "clioMasterMatterId", "clio_master_matter_id") || "";
}

function clioMasterDisplayNumber(m: Matter) {
  return val(m, "clioMasterDisplayNumber", "clio_master_display_number") || "";
}

function masterTargetHref(m: Matter) {
  const localMatterId = String(matterId(m) || "").trim();
  const localMaster = String(masterId(m) || "").trim();

  if (localMatterId && localMaster) {
    return `/matter/${encodeURIComponent(localMatterId)}?masterLawsuitId=${encodeURIComponent(localMaster)}`;
  }

  return "";
}

function courtVenue(m: Matter) {
  return val(m, "courtVenue", "court_venue", "court", "venue", "venueSelection", "venueOther") || "—";
}

function indexNumber(m: Matter) {
  return val(m, "indexAaaNumber", "index_aaa_number", "lawsuit_index_aaa_number", "indexNumber") || "—";
}

function denialReason(m: Matter) {
  return val(m, "denialReason", "denial_reason") || "—";
}

function paymentAmount(m: Matter) {
  return moneyValue(val(m, "paymentVoluntary", "payment_voluntary", "paymentAmount", "payment_amount"));
}

type SortKey =
  | "matter"
  | "patient"
  | "provider"
  | "insurer"
  | "adversaryAttorney"
  | "claimAmount"
  | "payment"
  | "balance"
  | "denialReason"
  | "court"
  | "indexNumber"
  | "filingStatus"
  | "matterStatus";

type SortDirection = "asc" | "desc";

function hasDisplayValue(value: unknown) {
  const cleaned = String(value ?? "").trim();
  return cleaned !== "" && cleaned !== "—";
}

function matterStatus(m: Matter) {
  const closeReason = String(val(m, "closeReason", "close_reason", "closedReason") || "").trim();
  const status = String(val(m, "status", "matterStatus", "matter_status") || "").trim();
  const stage = String(val(m, "matter_stage_name", "matterStageName") || "").trim();

  if (closeReason) return "Closed";
  if (/closed/i.test(status)) return "Closed";
  if (/closed/i.test(stage)) return "Closed";

  return status || "Open";
}

function isClosedMatter(m: Matter) {
  return matterStatus(m).toLowerCase() === "closed";
}

function isSelectableMatter(m: Matter) {
  return Boolean(matterId(m)) && !masterId(m) && !isClosedMatter(m);
}

function matterStatusStyle(m: Matter): React.CSSProperties {
  return {
    color: isClosedMatter(m) ? "#dc2626" : "#15803d",
    fontWeight: 900,
  };
}

function lawsuitsSearchStateFromUrl() {
  if (typeof window === "undefined") {
    return {
      claim: "",
      patient: "",
      provider: "",
      insurer: "",
      adversaryAttorney: "",
      court: "",
      denialReason: "",
      indexAaaNumber: "",
      masterLawsuitId: "",
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    claim: params.get("claim") || "",
    patient: params.get("patient") || "",
    provider: params.get("provider") || "",
    insurer: params.get("insurer") || "",
    adversaryAttorney: params.get("adversaryAttorney") || "",
    court: params.get("court") || "",
    denialReason: params.get("denialReason") || "",
    indexAaaNumber: params.get("indexAaaNumber") || "",
    masterLawsuitId: params.get("masterLawsuitId") || "",
  };
}

function lawsuitsSearchStateHasAnyValue(state: {
  claim?: string;
  patient?: string;
  provider?: string;
  insurer?: string;
  adversaryAttorney?: string;
  court?: string;
  denialReason?: string;
  indexAaaNumber?: string;
  masterLawsuitId?: string;
}) {
  return Boolean(
    String(state.claim || "").trim() ||
    String(state.patient || "").trim() ||
    String(state.provider || "").trim() ||
    String(state.insurer || "").trim() ||
    String(state.adversaryAttorney || "").trim() ||
    String(state.court || "").trim() ||
    String(state.denialReason || "").trim() ||
    String(state.indexAaaNumber || "").trim() ||
    String(state.masterLawsuitId || "").trim()
  );
}

export default function LawsuitsPage() {
  const [claim, setClaim] = useState("");
  const [patient, setPatient] = useState("");
  const [provider, setProvider] = useState("");
  const [insurer, setInsurer] = useState("");
  const [providerReferenceOptions, setProviderReferenceOptions] = useState<any[]>([]);
  const [insurerReferenceOptions, setInsurerReferenceOptions] = useState<any[]>([]);
  const [courtReferenceOptions, setCourtReferenceOptions] = useState<any[]>([]);
  const [referenceOptionsLoading, setReferenceOptionsLoading] = useState(false);

  const [groups, setGroups] = useState<ClaimGroup[]>([]);
  const [selected, setSelected] = useState<Record<string, Matter>>({});
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [tableSort, setTableSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "matter",
    direction: "asc",
  });
  const [createPopupOpen, setCreatePopupOpen] = useState(false);
  const [createModalPosition, setCreateModalPosition] = useState({ x: 80, y: 70 });
  const [createModalDrag, setCreateModalDrag] = useState<null | {
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>(null);
  const [lawsuitCourt, setLawsuitCourt] = useState("");
  const [lawsuitAmountMode, setLawsuitAmountMode] = useState<"claim_amount" | "balance_presuit" | "custom">("balance_presuit");
  const [customLawsuitAmount, setCustomLawsuitAmount] = useState("");
  const [lawsuitPreview, setLawsuitPreview] = useState<any>(null);
  const [createSuccessNotice, setCreateSuccessNotice] = useState<null | {
    masterLawsuitId: string;
    href: string;
  }>(null);

  const selectedMatters = useMemo(() => Object.values(selected), [selected]);

  const selectedClaimTotal = selectedMatters.reduce(
    (sum, m) => sum + moneyValue(val(m, "claimAmount", "claim_amount")),
    0
  );

  const selectedPaymentTotal = selectedMatters.reduce(
    (sum, m) => sum + paymentAmount(m),
    0
  );

  const selectedBalanceTotal = selectedMatters.reduce(
    (sum, m) => sum + moneyValue(val(m, "balancePresuit", "balance_presuit", "balanceAmount", "balance_amount")),
    0
  );

  const selectedTotal = selectedBalanceTotal;

  useEffect(() => {
    let cancelled = false;

    async function loadReferenceOptions() {
      setReferenceOptionsLoading(true);
      try {
        const [providerResponse, insurerResponse, courtResponse] = await Promise.all([
          fetch("/api/reference-data/options?type=provider_client", { cache: "no-store" }),
          fetch("/api/reference-data/options?type=insurer_company", { cache: "no-store" }),
          fetch("/api/reference-data/options?type=court_venue", { cache: "no-store" }),
        ]);

        const [providerJson, insurerJson, courtJson] = await Promise.all([
          providerResponse.ok ? providerResponse.json() : Promise.resolve({ options: [] }),
          insurerResponse.ok ? insurerResponse.json() : Promise.resolve({ options: [] }),
          courtResponse.ok ? courtResponse.json() : Promise.resolve({ options: [] }),
        ]);

        if (cancelled) return;

        setProviderReferenceOptions(Array.isArray(providerJson?.options) ? providerJson.options : []);
        setInsurerReferenceOptions(Array.isArray(insurerJson?.options) ? insurerJson.options : []);
        setCourtReferenceOptions(Array.isArray(courtJson?.options) ? courtJson.options : []);
      } catch {
        if (!cancelled) {
          setProviderReferenceOptions([]);
          setInsurerReferenceOptions([]);
          setCourtReferenceOptions([]);
        }
      } finally {
        if (!cancelled) setReferenceOptionsLoading(false);
      }
    }

    loadReferenceOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!createModalDrag) return;

    const dragState = createModalDrag;

    function handleMouseMove(event: MouseEvent) {
      const nextX = dragState.initialX + event.clientX - dragState.startX;
      const nextY = dragState.initialY + event.clientY - dragState.startY;

      setCreateModalPosition({
        x: Math.max(12, Math.min(nextX, window.innerWidth - 320)),
        y: Math.max(12, Math.min(nextY, window.innerHeight - 160)),
      });
    }

    function handleMouseUp() {
      setCreateModalDrag(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [createModalDrag]);

  useEffect(() => {
    if (!createSuccessNotice) return;

    const timer = window.setTimeout(() => {
      setCreateSuccessNotice(null);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [createSuccessNotice]);

  async function search(
    overrides: Partial<{
      claim: string;
      patient: string;
      provider: string;
      insurer: string;
      adversaryAttorney: string;
      court: string;
      denialReason: string;
      indexAaaNumber: string;
      masterLawsuitId: string;
    }> = {},
    options: { updateUrl?: boolean; replaceUrl?: boolean } = {}
  ) {
    const hasOverride = (key: string) => Object.prototype.hasOwnProperty.call(overrides, key);

    const nextClaim = hasOverride("claim") ? String(overrides.claim ?? "") : claim;
    const nextPatient = hasOverride("patient") ? String(overrides.patient ?? "") : patient;
    const nextProvider = hasOverride("provider") ? String(overrides.provider ?? "") : provider;
    const nextInsurer = hasOverride("insurer") ? String(overrides.insurer ?? "") : insurer;
    const nextAdversaryAttorney = hasOverride("adversaryAttorney") ? String(overrides.adversaryAttorney ?? "") : "";
    const nextCourt = hasOverride("court") ? String(overrides.court ?? "") : "";
    const nextDenialReason = hasOverride("denialReason") ? String(overrides.denialReason ?? "") : "";
    const nextIndexAaaNumber = hasOverride("indexAaaNumber") ? String(overrides.indexAaaNumber ?? "") : "";
    const nextMasterLawsuitId = hasOverride("masterLawsuitId") ? String(overrides.masterLawsuitId ?? "") : "";

    if (hasOverride("claim")) setClaim(nextClaim);
    if (hasOverride("patient")) setPatient(nextPatient);
    if (hasOverride("provider")) setProvider(nextProvider);
    if (hasOverride("insurer")) setInsurer(nextInsurer);

    setLoading(true);
    setError("");
    setResult(null);
    setSearched(true);
    setSelected({});

    try {
      const params = new URLSearchParams();
      if (nextClaim.trim()) params.set("claim", nextClaim.trim());
      if (nextPatient.trim()) params.set("patient", nextPatient.trim());
      if (nextProvider.trim()) params.set("provider", nextProvider.trim());
      if (nextInsurer.trim()) params.set("insurer", nextInsurer.trim());
      if (nextAdversaryAttorney.trim()) params.set("adversaryAttorney", nextAdversaryAttorney.trim());
      if (nextCourt.trim()) params.set("court", nextCourt.trim());
      if (nextDenialReason.trim()) params.set("denialReason", nextDenialReason.trim());
      if (nextIndexAaaNumber.trim()) params.set("indexAaaNumber", nextIndexAaaNumber.trim());
      if (nextMasterLawsuitId.trim()) params.set("masterLawsuitId", nextMasterLawsuitId.trim());

      if (!params.toString()) {
        throw new Error("Enter at least one search parameter.");
      }

      const res = await fetch(`/api/claim-index/search-grouped?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Search failed.");

      const nextGroups = json.groups ?? json.claims ?? json.results ?? json.data ?? [];
      setGroups(Array.isArray(nextGroups) ? nextGroups : []);
      setSelected({});

      if (typeof window !== "undefined" && options.updateUrl !== false) {
        const nextUrl = params.toString() ? `/lawsuits?${params.toString()}` : "/lawsuits";
        const currentUrl = `${window.location.pathname}${window.location.search}`;

        if (nextUrl !== currentUrl) {
          if (options.replaceUrl) {
            window.history.replaceState({ barshMattersLawsuitsSearch: true }, "", nextUrl);
          } else {
            window.history.pushState({ barshMattersLawsuitsSearch: true }, "", nextUrl);
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || "Search failed.");
      setGroups([]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    function applySearchFromUrl() {
      const urlState = lawsuitsSearchStateFromUrl();

      setClaim(urlState.claim);
      setPatient(urlState.patient);
      setProvider(urlState.provider);
      setInsurer(urlState.insurer);

      if (lawsuitsSearchStateHasAnyValue(urlState)) {
        void search(urlState, { updateUrl: false });
        return;
      }

      setGroups([]);
      setSelected({});
      setResult(null);
      setSearched(false);
      setError("");
    }

    applySearchFromUrl();
    window.addEventListener("popstate", applySearchFromUrl);

    return () => {
      window.removeEventListener("popstate", applySearchFromUrl);
    };
  }, []);

  function searchLinkedField(
    field: "claim" | "patient" | "provider" | "insurer" | "adversaryAttorney" | "court" | "denialReason" | "masterLawsuitId",
    value: unknown
  ) {
    const cleaned = String(value ?? "").trim();
    if (!cleaned || cleaned === "—") return;

    const clearedVisibleFields = {
      claim: "",
      patient: "",
      provider: "",
      insurer: "",
    };

    if (field === "claim") {
      void search({ ...clearedVisibleFields, claim: cleaned });
      return;
    }

    if (field === "patient") {
      void search({ ...clearedVisibleFields, patient: cleaned });
      return;
    }

    if (field === "provider") {
      void search({ ...clearedVisibleFields, provider: cleaned });
      return;
    }

    if (field === "insurer") {
      void search({ ...clearedVisibleFields, insurer: cleaned });
      return;
    }

    if (field === "adversaryAttorney") {
      void search({ ...clearedVisibleFields, adversaryAttorney: cleaned });
      return;
    }

    if (field === "court") {
      void search({ ...clearedVisibleFields, court: cleaned });
      return;
    }

    if (field === "denialReason") {
      void search({ ...clearedVisibleFields, denialReason: cleaned });
      return;
    }

    if (field === "masterLawsuitId") {
      void search({ ...clearedVisibleFields, masterLawsuitId: cleaned });
    }
  }

  function exportSearchResultsXlsx() {
    const rows = groups.flatMap((group) =>
      getRows(group).map((matter) => [
        "",
        "",
        pickAny(matter, ["createdAt", "created_at", "openedAt", "opened_at"]),
        pickAny(matter, ["updatedAt", "updated_at", "indexed_at"]),
        displayNumber(matter),
        safeExportCell(masterId(matter)),
        safeExportCell(val(matter, "client_name", "clientName", "provider_name", "providerName")),
        safeExportCell(val(matter, "patientName", "patient_name")),
        safeExportCell(insurerName(matter)),
        safeExportCell(adversaryAttorneyName(matter)),
        safeExportCell(getClaimNumber(group)),
        pickAny(matter, ["dateOfLoss", "date_of_loss"]),
        pickAny(matter, ["court", "courtVenue", "court_venue"]),
        pickAny(matter, ["indexAaaNumber", "index_aaa_number", "indexNumber"]),
        pickAny(matter, ["dateFiled", "date_filed", "filedDate", "filed_at"]),
        pickAny(matter, ["settledDate", "settlementDate", "settlement_date"]),
        pickAny(matter, ["settledWith", "settled_with"]),
        pickAny(matter, ["denialReason", "denial_reason"]),
        pickAny(matter, ["status", "matter_stage_name"]),
        pickAny(matter, ["closeReason", "close_reason", "closedReason"]),
        pickAny(matter, ["closedDate", "closed_date", "closedAt"]),
      ])
    );

    if (!rows.length) return;

    downloadWorkbookRows(
      standardCaseExportHeaders,
      rows,
      `barsh-matters-lawsuit-search-results-${timestampForFilename()}.xlsx`,
      "Search Results"
    );
  }

  function toggleMatter(m: Matter) {
    const id = matterId(m);
    if (!id || !isSelectableMatter(m)) return;

    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = m;
      return next;
    });
  }

  function toggleAllEligible(rows: Matter[]) {
    const eligible = rows.filter((m) => isSelectableMatter(m));
    const allSelected = eligible.length > 0 && eligible.every((m) => selected[matterId(m)]);

    setSelected((prev) => {
      const next = { ...prev };

      if (allSelected) {
        eligible.forEach((m) => {
          delete next[matterId(m)];
        });
      } else {
        eligible.forEach((m) => {
          next[matterId(m)] = m;
        });
      }

      return next;
    });
  }

  function lawsuitAmountForMode() {
    if (lawsuitAmountMode === "claim_amount") {
      return selectedMatters.reduce((sum, m) => sum + moneyValue(val(m, "claimAmount", "claim_amount")), 0);
    }

    if (lawsuitAmountMode === "custom") {
      return moneyValue(customLawsuitAmount);
    }

    return selectedMatters.reduce(
      (sum, m) => sum + moneyValue(val(m, "balancePresuit", "balance_presuit", "balanceAmount", "balance_amount")),
      0
    );
  }

  function lawsuitAmountLabel() {
    if (lawsuitAmountMode === "claim_amount") return "Billed Amount";
    if (lawsuitAmountMode === "custom") return "Other";
    return "Balance";
  }

  function validateCreateLawsuitInputs() {
    if (!lawsuitCourt.trim()) return "Court / Venue is required before creating a lawsuit.";

    if (lawsuitAmountMode === "custom" && lawsuitAmountForMode() <= 0) {
      return "A valid Lawsuit Amount is required when Other is selected.";
    }

    if (lawsuitAmountForMode() <= 0) {
      return "A valid Lawsuit Amount is required before creating a lawsuit.";
    }

    return "";
  }

  function openCreateLawsuitPopup() {
    if (!selectedMatters.length) return;
    setError("");
    setResult(null);
    setCreateSuccessNotice(null);
    setLawsuitPreview(null);
    setLawsuitCourt("");
    setLawsuitAmountMode("balance_presuit");
    setCustomLawsuitAmount("");
    setCreatePopupOpen(true);
  }

  async function previewSelectedLawsuit() {
    if (!selectedMatters.length) return;
    const validationError = validateCreateLawsuitInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setRunning(true);
    setError("");
    setLawsuitPreview(null);

    try {
      const matterIds = selectedMatters.map((m) => Number(matterId(m)));

      const previewRes = await fetch("/api/lawsuits/local-generation-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          matterIds,
          amountSoughtMode: lawsuitAmountMode,
          customAmountSought: lawsuitAmountMode === "custom" ? lawsuitAmountForMode() : null,
          venue: lawsuitCourt.trim(),
          venueSelection: lawsuitCourt.trim(),
        }),
      });

      const previewJson = await previewRes.json();
      if (!previewRes.ok || !previewJson?.ok) {
        throw new Error(previewJson?.error || "Local lawsuit generation preview failed.");
      }

      setLawsuitPreview(previewJson);

      if (!previewJson.canCreate) {
        throw new Error(previewJson.blockingReason || "Selected matters cannot be used to create a new local lawsuit.");
      }
    } catch (e: any) {
      setError(e?.message || "Local lawsuit generation preview failed.");
    } finally {
      setRunning(false);
    }
  }

  async function confirmCreateLawsuit() {
    if (!selectedMatters.length) return;
    const validationError = validateCreateLawsuitInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setRunning(true);
    setError("");
    setResult(null);

    try {
      const matterIds = selectedMatters.map((m) => Number(matterId(m)));

      const createRes = await fetch("/api/lawsuits/local-generation-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          confirm: "create-local-lawsuit",
          matterIds,
          amountSoughtMode: lawsuitAmountMode,
          customAmountSought: lawsuitAmountMode === "custom" ? lawsuitAmountForMode() : null,
          venue: lawsuitCourt.trim(),
          venueSelection: lawsuitCourt.trim(),
          notes: "Created from Lawsuits page local-first generation workflow.",
        }),
      });

      const createJson = await createRes.json();
      if (!createRes.ok || !createJson?.ok) {
        throw new Error(createJson?.error || "Local lawsuit generation failed.");
      }

      const createdMasterLawsuitId = String(
        createJson?.masterLawsuitId ||
          createJson?.lawsuit?.masterLawsuitId ||
          createJson?.lawsuit?.master_lawsuit_id ||
          ""
      ).trim();

      setResult({
        ...createJson,
        preview: lawsuitPreview,
      });

      if (createdMasterLawsuitId) {
        setCreateSuccessNotice({
          masterLawsuitId: createdMasterLawsuitId,
          href: `/matters?master=${encodeURIComponent(createdMasterLawsuitId)}`,
        });
      }

      setCreatePopupOpen(false);
      setLawsuitPreview(null);

      const urlSearchState = lawsuitsSearchStateFromUrl();
      await search(
        lawsuitsSearchStateHasAnyValue(urlSearchState)
          ? urlSearchState
          : { claim, patient, provider, insurer },
        { replaceUrl: true }
      );
    } catch (e: any) {
      setError(e?.message || "Local lawsuit generation failed.");
    } finally {
      setRunning(false);
    }
  }

  function sortValue(m: Matter, key: SortKey) {
    if (key === "matter") return displayNumber(m);
    if (key === "patient") return val(m, "patientName", "patient_name");
    if (key === "provider") return val(m, "client_name", "clientName", "provider_name", "providerName");
    if (key === "insurer") return insurerName(m);
    if (key === "adversaryAttorney") return adversaryAttorneyName(m);
    if (key === "claimAmount") return moneyValue(val(m, "claimAmount", "claim_amount"));
    if (key === "payment") return paymentAmount(m);
    if (key === "balance") return moneyValue(val(m, "balancePresuit", "balance_presuit", "balanceAmount", "balance_amount"));
    if (key === "denialReason") return denialReason(m);
    if (key === "court") return courtVenue(m);
    if (key === "indexNumber") return indexNumber(m);
    if (key === "filingStatus") return masterId(m) || "Not Filed";
    if (key === "matterStatus") return matterStatus(m);
    return "";
  }

  function compareRows(a: Matter, b: Matter) {
    const av = sortValue(a, tableSort.key);
    const bv = sortValue(b, tableSort.key);

    const direction = tableSort.direction === "asc" ? 1 : -1;

    if (typeof av === "number" || typeof bv === "number") {
      return (Number(av || 0) - Number(bv || 0)) * direction;
    }

    const primary = String(av || "").localeCompare(String(bv || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });

    if (primary !== 0) return primary * direction;
    return displayNumber(a).localeCompare(displayNumber(b), undefined, { numeric: true, sensitivity: "base" });
  }

  function toggleSort(key: SortKey) {
    setTableSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }

  function sortLabel(key: SortKey) {
    if (tableSort.key !== key) return "";
    return tableSort.direction === "asc" ? " ▲" : " ▼";
  }

  function sortableHeader(label: string, key: SortKey, style: React.CSSProperties = th) {
    return (
      <button type="button" onClick={() => toggleSort(key)} style={sortHeaderButton}>
        {label}
        {sortLabel(key)}
      </button>
    );
  }

  return (
    <main style={{ padding: 16, width: "100%", maxWidth: "none", margin: 0 }}>
      <BarshHeader />


<div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, margin: "0 0 4px 0" }}>Lawsuit Aggregation</h1>
          <div style={{ color: "#385a83", fontSize: 13 }}>
            Search, aggregate, and manage lawsuit matter groups.
          </div>
        </div>

      </div>

      <form
        style={searchGrid}
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading && !running) {
            void search();
          }
        }}
      >
        <input placeholder="Claim number" value={claim} onChange={(e) => setClaim(e.target.value)} style={input} />
        <input placeholder="Patient" value={patient} onChange={(e) => setPatient(e.target.value)} style={input} />
        <input
          placeholder={referenceOptionsLoading ? "Provider · loading..." : "Provider"}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          list="barsh-lawsuit-provider-reference-options"
          style={input}
        />
        <input
          placeholder={referenceOptionsLoading ? "Insurer · loading..." : "Insurer"}
          value={insurer}
          onChange={(e) => setInsurer(e.target.value)}
          list="barsh-lawsuit-insurer-reference-options"
          style={input}
        />
        <datalist id="barsh-lawsuit-provider-reference-options">
          {providerReferenceOptions.map((option, index) => {
            const value = String(option?.displayName || option?.name || option?.value || "").trim();
            if (!value) return null;
            return <option key={`lawsuit-provider-reference-${option.id || value}-${index}`} value={value} />;
          })}
        </datalist>
        <datalist id="barsh-lawsuit-insurer-reference-options">
          {insurerReferenceOptions.map((option, index) => {
            const value = String(option?.displayName || option?.name || option?.value || "").trim();
            if (!value) return null;
            return <option key={`lawsuit-insurer-reference-${option.id || value}-${index}`} value={value} />;
          })}
        </datalist>
        <button type="submit" disabled={loading || running} style={primaryBtn}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <div style={errorBox}>{error}</div>}

      {result && (
        <div style={successBox}>
          <strong>Result:</strong> {result.action ?? result.status ?? result.result ?? "completed"}
          {(result.masterLawsuitId ?? result.master_lawsuit_id) ? ` — ${result.masterLawsuitId ?? result.master_lawsuit_id}` : ""}
        </div>
      )}

      {groups.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            onClick={exportSearchResultsXlsx}
            style={{
              border: "1px solid #00346e",
              background: "#00346e",
              color: "#ffffff",
              borderRadius: 999,
              padding: "8px 12px",
              fontWeight: 900,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Export XLS
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
        <section>
          {!searched ? (
            <p>Enter a selector and search.</p>
          ) : loading ? (
            <p>Loading claim clusters...</p>
          ) : groups.length === 0 ? (
            <p>No claim clusters found.</p>
          ) : (
            groups.map((group, idx) => {
              const rows = [...getRows(group)].sort(compareRows);
              const groupMasterLawsuitId = rows.map((m) => masterId(m)).find(Boolean) || "";

              const eligibleRows = rows.filter((m) => isSelectableMatter(m));
              const allEligibleSelected =
                eligibleRows.length > 0 && eligibleRows.every((m) => selected[matterId(m)]);

              return (
                <div key={`${getClaimNumber(group)}-${idx}`} style={card}>
                  <div style={{ ...header, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <span>
                      Claim Number:{" "}
                      <button
                        type="button"
                        onClick={() => searchLinkedField("claim", getClaimNumber(group))}
                        style={fieldLinkButton}
                        title="Search this claim number"
                      >
                        {getClaimNumber(group)}
                      </button>
                    </span>
                    {groupMasterLawsuitId ? (
                      <OldFileNumberField masterLawsuitId={groupMasterLawsuitId} label="Old Lawsuit Number" />
                    ) : null}
                  </div>

                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={thCheck}>
                          <input
                            type="checkbox"
                            checked={allEligibleSelected}
                            disabled={eligibleRows.length === 0}
                            onChange={() => toggleAllEligible(rows)}
                            title="Select/deselect all eligible matters"
                          />
                        </th>
                        <th style={th}>{sortableHeader("Matter", "matter")}</th>
                        <th style={th}>{sortableHeader("Patient", "patient")}</th>
                        <th style={th}>{sortableHeader("Provider", "provider")}</th>
                        <th style={th}>{sortableHeader("Insurer", "insurer")}</th>
                        <th style={thRight}>{sortableHeader("Claim Amount", "claimAmount", thRight)}</th>
                        <th style={thRight}>{sortableHeader("Payment", "payment", thRight)}</th>
                        <th style={thRight}>{sortableHeader("Balance", "balance", thRight)}</th>
                        <th style={th}>{sortableHeader("Denial Reason", "denialReason")}</th>
                        <th style={th}>{sortableHeader("Court", "court")}</th>
                        <th style={th}>{sortableHeader("Adversary Attorney", "adversaryAttorney")}</th>
                        <th style={th}>{sortableHeader("Lawsuit ID", "filingStatus")}</th>
                        <th style={th}>{sortableHeader("Index Number", "indexNumber")}</th>
                        <th style={th}>{sortableHeader("Matter Status", "matterStatus")}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((m) => {
                        const id = matterId(m);
                        const checked = Boolean(selected[id]);
                        const hasMaster = !!masterId(m);
                        const closedMatter = isClosedMatter(m);
                        const selectable = isSelectableMatter(m);

                        return (
                          <tr
                            key={id}
                            style={{
                              background: checked ? "#fff7cc" : closedMatter ? "#f2f2f2" : "white",
                              opacity: closedMatter ? 0.55 : 1,
                            }}
                          >
                            <td style={tdCheck}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!selectable}
                                onChange={() => toggleMatter(m)}
                              />
                            </td>
                            <td style={td}>
                              <a href={`/matter/${id}`} style={fieldAnchor} title={`Open ${displayNumber(m)}`}>
                                {displayNumber(m)}
                              </a>
                            </td>
                            <td style={td}>
                              <button
                                type="button"
                                onClick={() => searchLinkedField("patient", val(m, "patientName", "patient_name"))}
                                style={fieldTextFilterLink}
                                title="Show all matters for this patient"
                              >
                                {val(m, "patientName", "patient_name") || "—"}
                              </button>
                            </td>
                            <td style={td}>
                              <button
                                type="button"
                                onClick={() => searchLinkedField("provider", val(m, "client_name", "clientName", "provider_name", "providerName"))}
                                style={fieldTextFilterLink}
                                title="Show all matters for this provider"
                              >
                                {val(m, "client_name", "clientName", "provider_name", "providerName") || "—"}
                              </button>
                            </td>
                            <td style={td}>
                              <button
                                type="button"
                                onClick={() => searchLinkedField("insurer", insurerName(m))}
                                style={fieldTextFilterLink}
                                title="Show all matters for this insurer"
                              >
                                {insurerName(m) || "—"}
                              </button>
                            </td>
                            <td style={tdRight}>{money(val(m, "claimAmount", "claim_amount"))}</td>
                            <td style={tdRight}>{money(paymentAmount(m))}</td>
                            <td style={tdRight}>{money(val(m, "balancePresuit", "balance_presuit", "balanceAmount", "balance_amount"))}</td>
                            <td style={td}>
                              <button
                                type="button"
                                onClick={() => searchLinkedField("denialReason", denialReason(m))}
                                title="Show all matters for this denial reason"
                                style={{
                                  border: 0,
                                  background: "transparent",
                                  color: "#00346e",
                                  cursor: "pointer",
                                  padding: 0,
                                  font: "inherit",
                                  fontWeight: 800,
                                  textAlign: "left",
                                }}
                              >
                                {denialReason(m)}
                              </button>
                            </td>
                            <td style={td}>
                              <button
                                type="button"
                                onClick={() => searchLinkedField("court", courtVenue(m))}
                                title="Show all matters for this court"
                                style={{
                                  border: 0,
                                  background: "transparent",
                                  color: "#00346e",
                                  cursor: "pointer",
                                  padding: 0,
                                  font: "inherit",
                                  fontWeight: 800,
                                  textAlign: "left",
                                }}
                              >
                                {courtVenue(m)}
                              </button>
                            </td>
                            <td style={td}>
                              <button
                                type="button"
                                onClick={() => searchLinkedField("adversaryAttorney", adversaryAttorneyName(m))}
                                style={fieldTextFilterLink}
                                title="Show all matters for this adversary attorney"
                              >
                                {adversaryAttorneyName(m) || "—"}
                              </button>
                            </td>
                            <td style={td}>
                              {hasMaster ? (
                                masterTargetHref(m) ? (
                                  <a
                                    href={masterTargetHref(m)}
                                    style={{ ...fieldAnchor, color: "#ca8a04" }}
                                    title={`Open master lawsuit ${masterId(m)}${clioMasterDisplayNumber(m) ? ` / ${clioMasterDisplayNumber(m)}` : ""}`}
                                  >
                                    {masterId(m)}
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => searchLinkedField("masterLawsuitId", masterId(m))}
                                    style={{ ...fieldLinkButton, color: "#ca8a04" }}
                                    title="Search this master lawsuit"
                                  >
                                    {masterId(m)}
                                  </button>
                                )
                              ) : (
                                "Not Filed"
                              )}
                            </td>
                            <td style={td}>{indexNumber(m)}</td>
                            <td style={td}>
                              <span style={matterStatusStyle(m)}>{matterStatus(m)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </section>

        <aside style={panel}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Selected Matters</h3>
          <p style={panelLine}><strong>Count:</strong> {selectedMatters.length}</p>
          <p style={panelLine}><strong>Total Claim Amount:</strong> {money(selectedClaimTotal)}</p>
          <p style={panelLine}><strong>Total Payments:</strong> {money(selectedPaymentTotal)}</p>
          <p style={panelLine}><strong>Total Balance:</strong> {money(selectedBalanceTotal)}</p>

          <button
            onClick={openCreateLawsuitPopup}
            disabled={!selectedMatters.length || running}
            style={{
              ...primaryBtn,
              width: "100%",
              opacity: !selectedMatters.length || running ? 0.45 : 1,
              cursor: !selectedMatters.length || running ? "not-allowed" : "pointer",
            }}
          >
            {running ? "Working..." : "Create Lawsuit"}
          </button>
        </aside>
      </div>

      {createSuccessNotice && (
        <div style={lawsuitCreatedNotice}>
          Lawsuit Created{" "}
          <a
            href={createSuccessNotice.href}
            style={lawsuitCreatedNoticeLink}
            onClick={() => setCreateSuccessNotice(null)}
            title={`Open master lawsuit ${createSuccessNotice.masterLawsuitId}`}
          >
            {createSuccessNotice.masterLawsuitId}
          </a>
          .
        </div>
      )}

      {createPopupOpen && (
        <div style={modalBackdrop}>
          <div
            style={{
              ...createModal,
              left: createModalPosition.x,
              top: createModalPosition.y,
            }}
          >
            <div
              style={modalDragHandle}
              onMouseDown={(event) => {
                setCreateModalDrag({
                  startX: event.clientX,
                  startY: event.clientY,
                  initialX: createModalPosition.x,
                  initialY: createModalPosition.y,
                });
              }}
              title="Drag to move popup"
            >
              <h2 style={modalTitle}>Create Lawsuit</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 520px)", gap: 12, marginBottom: 12 }}>
              <label style={inlineFieldLabel}>
                <span>Choose Court</span>
                <input
                  list="barsh-lawsuit-create-court-options"
                  value={lawsuitCourt}
                  onChange={(event) => setLawsuitCourt(event.target.value)}
                  placeholder="Select or enter court"
                  style={{ ...input, width: 360 }}
                />
              </label>
            </div>

            <div style={amountModePanel}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                Lawsuit Amount <span style={{ color: "#dc2626" }}>*</span>
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <label style={radioLabel}>
                  <input
                    type="radio"
                    checked={lawsuitAmountMode === "claim_amount"}
                    onChange={() => setLawsuitAmountMode("claim_amount")}
                  />
                  Billed Amount ({money(selectedMatters.reduce((sum, m) => sum + moneyValue(val(m, "claimAmount", "claim_amount")), 0))})
                </label>

                <label style={radioLabel}>
                  <input
                    type="radio"
                    checked={lawsuitAmountMode === "balance_presuit"}
                    onChange={() => setLawsuitAmountMode("balance_presuit")}
                  />
                  Balance ({money(selectedMatters.reduce((sum, m) => sum + moneyValue(val(m, "balancePresuit", "balance_presuit", "balanceAmount", "balance_amount")), 0))})
                </label>

                <label style={radioLabel}>
                  <input
                    type="radio"
                    checked={lawsuitAmountMode === "custom"}
                    onChange={() => setLawsuitAmountMode("custom")}
                  />
                  Other
                </label>

                {lawsuitAmountMode === "custom" && (
                  <input
                    value={customLawsuitAmount}
                    onChange={(event) => setCustomLawsuitAmount(event.target.value)}
                    placeholder="Enter lawsuit amount"
                    style={{ ...input, width: 180 }}
                  />
                )}
              </div>

              <div style={{ marginTop: 8, fontSize: 13, color: "#385a83" }}>
                Selected Lawsuit Amount: <strong>{money(lawsuitAmountForMode())}</strong> ({lawsuitAmountLabel()})
              </div>
            </div>

            <datalist id="barsh-lawsuit-create-court-options">
              {courtReferenceOptions.map((option, index) => {
                const value = String(option?.displayName || option?.name || option?.value || "").trim();
                if (!value) return null;
                return <option key={`lawsuit-create-court-${option.id || value}-${index}`} value={value} />;
              })}
            </datalist>

            <div style={{ marginBottom: 10, fontWeight: 900 }}>
              Selected Matters: {selectedMatters.length} · Selected Lawsuit Amount: {money(lawsuitAmountForMode())}
            </div>

            <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12 }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Matter</th>
                    <th style={th}>Patient</th>
                    <th style={th}>Provider</th>
                    <th style={th}>Insurer</th>
                    <th style={thRight}>Claim Amount</th>
                    <th style={thRight}>Payment</th>
                    <th style={thRight}>Balance</th>
                    <th style={th}>Denial Reason</th>
                    <th style={th}>Adversary Attorney</th>
                    <th style={th}>Lawsuit ID</th>
                    <th style={th}>Matter Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMatters.map((m) => (
                    <tr key={`create-review-${matterId(m)}`}>
                      <td style={td}>{displayNumber(m)}</td>
                      <td style={td}>{val(m, "patientName", "patient_name") || "—"}</td>
                      <td style={td}>{val(m, "client_name", "clientName", "provider_name", "providerName") || "—"}</td>
                      <td style={td}>{insurerName(m) || "—"}</td>
                      <td style={tdRight}>{money(val(m, "claimAmount", "claim_amount"))}</td>
                      <td style={tdRight}>{money(paymentAmount(m))}</td>
                      <td style={tdRight}>{money(val(m, "balancePresuit", "balance_presuit", "balanceAmount", "balance_amount"))}</td>
                      <td style={td}>{denialReason(m)}</td>
                      <td style={td}>{adversaryAttorneyName(m) || "—"}</td>
                      <td style={td}>{masterId(m) || "Not Filed"}</td>
                      <td style={td}><span style={matterStatusStyle(m)}>{matterStatus(m)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lawsuitPreview && (
              <div style={successBox}>
                <strong>Preview Ready:</strong> {lawsuitPreview.selectedMatterCount} matters · Lawsuit Amount {money(lawsuitPreview.amountSought)}
              </div>
            )}

            <div style={modalButtonRow}>
              <button
                type="button"
                onClick={() => {
                  setCreatePopupOpen(false);
                  setLawsuitPreview(null);
                }}
                disabled={running}
                style={secondaryBtn}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={previewSelectedLawsuit}
                disabled={running || !selectedMatters.length || Boolean(validateCreateLawsuitInputs())}
                style={{
                  ...secondaryBtn,
                  opacity: running || !selectedMatters.length || Boolean(validateCreateLawsuitInputs()) ? 0.45 : 1,
                  cursor: running || !selectedMatters.length || Boolean(validateCreateLawsuitInputs()) ? "not-allowed" : "pointer",
                }}
              >
                Preview Lawsuit
              </button>

              <button
                type="button"
                onClick={confirmCreateLawsuit}
                disabled={running || !selectedMatters.length || Boolean(validateCreateLawsuitInputs())}
                style={{
                  ...primaryBtn,
                  opacity: running || !selectedMatters.length || Boolean(validateCreateLawsuitInputs()) ? 0.45 : 1,
                  cursor: running || !selectedMatters.length || Boolean(validateCreateLawsuitInputs()) ? "not-allowed" : "pointer",
                }}
              >
                {running ? "Working..." : "Confirm Create Lawsuit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const searchGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr) 220px",
  gap: 8,
  marginBottom: 12,
};

const input: React.CSSProperties = {
  padding: 8,
  border: "1px solid #ccc",
  borderRadius: 6,
};

const card: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  marginBottom: 12,
  overflow: "hidden",
};

const header: React.CSSProperties = {
  padding: "8px 10px",
  background: "#fafafa",
  borderBottom: "1px solid #ddd",
  fontWeight: 700,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "7px 8px",
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const thCheck: React.CSSProperties = {
  ...th,
  width: 32,
  textAlign: "center",
};

const thRight: React.CSSProperties = {
  ...th,
  textAlign: "right",
};

const td: React.CSSProperties = {
  padding: "7px 8px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
};

const tdCheck: React.CSSProperties = {
  ...td,
  width: 32,
  textAlign: "center",
};

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const fieldAnchor: React.CSSProperties = {
  color: "#00346e",
  textDecoration: "underline",
  textUnderlineOffset: 2,
  fontWeight: 700,
};

const fieldTextFilterLink: React.CSSProperties = {
  border: 0,
  background: "transparent",
  padding: 0,
  margin: 0,
  color: "#00346e",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 700,
  textDecoration: "underline",
  whiteSpace: "nowrap",
};

const fieldLinkButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#00346e",
  padding: 0,
  margin: 0,
  font: "inherit",
  fontWeight: 700,
  textDecoration: "underline",
  textUnderlineOffset: 2,
  cursor: "pointer",
  textAlign: "left",
};

const sortHeaderButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "inherit",
  padding: 0,
  margin: 0,
  font: "inherit",
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "inherit",
  whiteSpace: "nowrap",
};

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 20000,
  background: "rgba(15, 23, 42, 0.32)",
};

const createModal: React.CSSProperties = {
  position: "absolute",
  width: "min(1180px, calc(100vw - 48px))",
  height: "min(760px, calc(100vh - 96px))",
  minWidth: 720,
  minHeight: 480,
  maxWidth: "calc(100vw - 24px)",
  maxHeight: "calc(100vh - 24px)",
  overflow: "auto",
  resize: "both",
  background: "#fff",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.32)",
  padding: 18,
};

const modalDragHandle: React.CSSProperties = {
  cursor: "move",
  userSelect: "none",
  margin: "-18px -18px 16px",
  padding: "14px 18px",
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  background: "#0f2a44",
  boxShadow: "0 8px 18px rgba(15, 42, 68, 0.28)",
};

const modalTitle: React.CSSProperties = {
  margin: 0,
  textAlign: "center",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 30,
  lineHeight: 1.2,
  fontWeight: 700,
  color: "#ffffff",
  letterSpacing: "0.02em",
};

const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 5,
  fontSize: 12,
  fontWeight: 900,
  color: "#385a83",
};

const inlineFieldLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  fontSize: 12,
  fontWeight: 900,
  color: "#385a83",
};

const amountModePanel: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
  background: "#f8fafc",
};

const radioLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
  color: "#385a83",
};

const modalButtonRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 10,
  marginTop: 14,
};

const secondaryBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  background: "#f8fafc",
  color: "#00346e",
  border: "1px solid #cbd5e1",
  cursor: "pointer",
};

const panel: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 12,
  height: "fit-content",
  position: "sticky",
  top: 16,
};

const panelLine: React.CSSProperties = {
  margin: "5px 0",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  background: "#111",
  color: "white",
  border: "none",
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  padding: 10,
  background: "#fee",
  border: "1px solid #f99",
  marginBottom: 12,
};

const successBox: React.CSSProperties = {
  padding: 10,
  background: "#eef9ee",
  border: "1px solid #9c9",
  marginBottom: 12,
};


const lawsuitCreatedNotice: React.CSSProperties = {
  position: "fixed",
  top: 86,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 10050,
  background: "#052e63",
  color: "white",
  border: "1px solid #00346e",
  borderRadius: 12,
  boxShadow: "0 18px 42px rgba(15, 23, 42, 0.28)",
  padding: "14px 22px",
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: "0.01em",
};

const lawsuitCreatedNoticeLink: React.CSSProperties = {
  color: "white",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  fontWeight: 950,
};
