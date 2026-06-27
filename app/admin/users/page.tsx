
/*
Password Reset Phase 16 one-time modal contract:
- When /api/admin/users/password-reset apply returns temporaryPassword and temporaryPasswordOneTimeDisplay, show a standard Barsh Matters modal.
- Modal title: Temporary Password.
- Modal warns the password is shown once.
- Modal includes Copy Temporary Password button using navigator.clipboard.writeText.
- Modal includes Done button that clears client-side one-time password state.
- Password reset route behavior is not changed in this phase.
*/

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars -- Existing Admin Users page predates strict lint cleanup; Phase 12 preserves behavior while adding signer-profile UI route contracts/helpers. */

/*
Signer Profile Phase 12 UI wiring contract:
- Create-user UI must include firstName, lastName, displayName, username, email, phoneExtension, faxNumber, signatureBlockName, locked, inactive, twoFactorPhone, twoFactorDisabled, and twoFactorPendingSetup in the payload sent to /api/admin/users/create.
- Edit-user signer/contact/status UI must use PATCH /api/admin/users/signer-profile with preview/apply behavior.
- The signer-profile edit route is separate from lockout, password reset, failed-login clear, role assignment, and permission override routes.
- The Users admin table should show derived signer status Complete/Missing Fields and 2FA status Enabled/Disabled/Missing Phone/Pending Setup.
- This UI phase must not wire production document-generation signer validation.
*/


/*
Signer Profile Phase 1 UI contract:
- create/edit fields: firstName, lastName, displayName, username, email, phoneExtension, faxNumber, signatureBlockName, locked, inactive, twoFactorPhone, twoFactorDisabled
- table indicators: signer profile Complete/Missing Fields, Locked, Inactive, Failed-login locked, 2FA Enabled/Disabled/Missing Phone/Pending Setup
- row actions: Reset Password, Unlock Login, Clear Failed-Login Lockout
- reset temporary password must display once in the standard Barsh Matters modal with copy button and one-time warning
- edit form should show specific missing signer fields
*/

"use client";

import { useEffect, useMemo, useState } from "react";

const cardStyle = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 18,
} as const;

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  background: "#ffffff",
  color: "#0f172a",
} as const;

const primaryButtonStyle = {
  border: "1px solid #1e3a8a",
  background: "#1e3a8a",
  color: "#ffffff",
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 950,
  cursor: "pointer",
} as const;

const secondaryButtonStyle = {
  border: "1px solid #64748b",
  background: "#f8fafc",
  color: "#334155",
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 950,
  cursor: "pointer",
} as const;

function cleanEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}



const ADMIN_USERS_PHASE12_SIGNER_PROFILE_UPDATE_ROUTE = "/api/admin/users/signer-profile";
const ADMIN_USERS_PHASE12_CREATE_ROUTE = "/api/admin/users/create";

const ADMIN_USERS_PHASE12_SIGNER_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "displayName",
  "username",
  "email",
  "phoneExtension",
  "faxNumber",
  "signatureBlockName",
  "locked",
  "inactive",
  "twoFactorPhone",
  "twoFactorDisabled",
  "twoFactorPendingSetup",
] as const;

function adminUsersPhase12SignerProfilePayload(form: Record<string, unknown>, actorEmail: string, userId?: string) {
  return {
    actorEmail,
    userId,
    firstName: form.firstName ?? "",
    lastName: form.lastName ?? "",
    displayName: form.displayName ?? "",
    username: form.username ?? "",
    email: form.email ?? "",
    phoneExtension: form.phoneExtension ?? "",
    faxNumber: form.faxNumber ?? "",
    signatureBlockName: form.signatureBlockName ?? "",
    locked: form.locked === true,
    inactive: form.inactive === true,
    twoFactorPhone: form.twoFactorPhone ?? "",
    twoFactorDisabled: form.twoFactorDisabled === true,
    twoFactorPendingSetup: form.twoFactorPendingSetup === true,
  };
}

function adminUsersPhase12SignerProfileStatusLabel(user: {
  displayName?: unknown;
  email?: unknown;
  phoneExtension?: unknown;
  faxNumber?: unknown;
  signatureBlockName?: unknown;
}) {
  const missing = ADMIN_USERS_PHASE12_SIGNER_PROFILE_FIELDS
    .filter((field) => ["displayName", "email", "phoneExtension", "faxNumber", "signatureBlockName"].includes(field))
    .filter((field) => String(user[field as keyof typeof user] ?? "").trim().length === 0);
  return missing.length === 0 ? "Complete" : "Missing Fields";
}

function adminUsersPhase12TwoFactorStatusLabel(user: {
  twoFactorPhone?: unknown;
  twoFactorDisabled?: unknown;
  twoFactorPendingSetup?: unknown;
}) {
  if (user.twoFactorDisabled === true) return "Disabled";
  if (user.twoFactorPendingSetup === true) return "Pending Setup";
  if (String(user.twoFactorPhone ?? "").trim().length === 0) return "Missing Phone";
  return "Enabled";
}

function adminUsersPhaseV4CNormalizeGrantKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean))).sort();
}

function adminUsersPhaseV4CToggleGrantKey(keys: string[], key: string) {
  const cleanKey = String(key || "").trim();
  if (!cleanKey) return keys;
  const set = new Set(keys);
  if (set.has(cleanKey)) set.delete(cleanKey);
  else set.add(cleanKey);
  return Array.from(set).sort();
}

async function readAdminUsersJsonResponse(response: Response, label: string) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(label + " returned an empty response with status " + response.status + ".");
  }

  try {
    const parsed = JSON.parse(text);
    if (!response.ok) {
      const message = parsed && typeof parsed === "object" && "error" in parsed ? String((parsed as any).error) : text.slice(0, 240);
      throw new Error(label + " failed with status " + response.status + ": " + message);
    }
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(label + " returned non-JSON response with status " + response.status + ": " + text.slice(0, 240));
    }
    throw error;
  }
}

export default function AdminUsersPlanningPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhoneExtension, setCreatePhoneExtension] = useState("");
  const [createFaxNumber, setCreateFaxNumber] = useState("");
  const [createSignatureBlockName, setCreateSignatureBlockName] = useState("");
  const [createLocked, setCreateLocked] = useState(false);
  const [createInactive, setCreateInactive] = useState(false);
  const [createTwoFactorPhone, setCreateTwoFactorPhone] = useState("");
  const [createTwoFactorDisabled, setCreateTwoFactorDisabled] = useState(false);
  const [createTwoFactorPendingSetup, setCreateTwoFactorPendingSetup] = useState(false);
  const [createStatus, setCreateStatus] = useState("active");
  const [createNotes, setCreateNotes] = useState("");
  const [createActorEmail, setCreateActorEmail] = useState("dbarshay15@gmail.com");
  const [createBusy, setCreateBusy] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [createResult, setCreateResult] = useState<any>(null);
  const [assignTargetEmail, setAssignTargetEmail] = useState("");
  const [assignRoleKey, setAssignRoleKey] = useState("");
  const [assignActorEmail, setAssignActorEmail] = useState("dbarshay15@gmail.com");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMessage, setAssignMessage] = useState("");
  const [assignResult, setAssignResult] = useState<any>(null);
  const [removeTargetEmail, setRemoveTargetEmail] = useState("");
  const [removeRoleKey, setRemoveRoleKey] = useState("");
  const [removeActorEmail, setRemoveActorEmail] = useState("dbarshay15@gmail.com");
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeMessage, setRemoveMessage] = useState("");
  const [removeResult, setRemoveResult] = useState<any>(null);
  const [lockoutTargetEmail, setLockoutTargetEmail] = useState("");
  const [lockoutAction, setLockoutAction] = useState("lock");
  const [lockoutReason, setLockoutReason] = useState("");
  const [lockoutActorEmail, setLockoutActorEmail] = useState("dbarshay15@gmail.com");
  const [lockoutBusy, setLockoutBusy] = useState(false);
  const [lockoutMessage, setLockoutMessage] = useState("");
  const [lockoutResult, setLockoutResult] = useState<any>(null);
  const [passwordResetTargetEmail, setPasswordResetTargetEmail] = useState("");
  const [passwordResetTemporaryPassword, setPasswordResetTemporaryPassword] = useState("");
  const [passwordResetReason, setPasswordResetReason] = useState("");
  const [passwordResetActorEmail, setPasswordResetActorEmail] = useState("dbarshay15@gmail.com");
  const [passwordResetBusy, setPasswordResetBusy] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState("");
  const [passwordResetResult, setPasswordResetResult] = useState<any>(null);
  const [passwordResetOneTimePassword, setPasswordResetOneTimePassword] = useState("");
  const [passwordResetCopyMessage, setPasswordResetCopyMessage] = useState("");
  const [adminUsersAction, setAdminUsersAction] = useState<"none" | "create">("none");
  const [adminUsersRowBusy, setAdminUsersRowBusy] = useState(false);
  const [adminUsersRowMessage, setAdminUsersRowMessage] = useState("");
  const [editUser, setEditUser] = useState<any>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhoneExtension, setEditPhoneExtension] = useState("");
  const [editFaxNumber, setEditFaxNumber] = useState("");
  const [editSignatureBlockName, setEditSignatureBlockName] = useState("");
  const [editTwoFactorPhone, setEditTwoFactorPhone] = useState("");
  const [editTwoFactorDisabled, setEditTwoFactorDisabled] = useState(false);
  const [editTwoFactorPendingSetup, setEditTwoFactorPendingSetup] = useState(false);
  const [editLocked, setEditLocked] = useState(false);
  const [editInactive, setEditInactive] = useState(false);
  const [editRoleToAssign, setEditRoleToAssign] = useState("");
  const [editRoleToRemove, setEditRoleToRemove] = useState("");
  const [editAdminCardGrantKeys, setEditAdminCardGrantKeys] = useState<string[]>([]);
  const [editAdminCardGrantBusy, setEditAdminCardGrantBusy] = useState(false);
  const [editAdminCardGrantMessage, setEditAdminCardGrantMessage] = useState("");
  const [editAdminCardGrantResult, setEditAdminCardGrantResult] = useState<any>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editNeedsReauth, setEditNeedsReauth] = useState(false);
  const [twoFactorSetupUser, setTwoFactorSetupUser] = useState<any>(null);
  const [twoFactorSetupPhone, setTwoFactorSetupPhone] = useState("");
  const [twoFactorSetupMessage, setTwoFactorSetupMessage] = useState("");
  const [twoFactorSetupBusy, setTwoFactorSetupBusy] = useState(false);
  const [twoFactorSetupNeedsReauth, setTwoFactorSetupNeedsReauth] = useState(false);
  const [twoFactorVerifyUser, setTwoFactorVerifyUser] = useState<any>(null);
  const [twoFactorVerifyCode, setTwoFactorVerifyCode] = useState("");
  const [twoFactorVerifyMessage, setTwoFactorVerifyMessage] = useState("");
  const [twoFactorVerifyBusy, setTwoFactorVerifyBusy] = useState(false);
  const [twoFactorSetupChallengeCode, setTwoFactorSetupChallengeCode] = useState("");


  useEffect(() => {
    setEditAdminCardGrantKeys(adminUsersPhaseV4CNormalizeGrantKeys(editUser?.adminCardGrantKeys));
    setEditAdminCardGrantMessage("");
    setEditAdminCardGrantResult(null);
    setEditRoleToAssign("");
    setEditRoleToRemove("");
  }, [editUser?.id]);

  async function loadAdminUsersPlanning() {
    try {
      setError("");
      const response = await fetch("/api/admin/users/planning", { cache: "no-store" });
      const json = await readAdminUsersJsonResponse(response, "Admin users request");
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Admin users planning lookup failed.");
    }
  }

  useEffect(() => {
    void loadAdminUsersPlanning();
  }, []);

  const roles = Array.isArray(data?.roles) ? data.roles : [];
  const users = Array.isArray(data?.users) ? data.users : [];
  const dbUsers = Array.isArray(data?.databasePreview?.users) ? data.databasePreview.users : [];
  const dbRoles = Array.isArray(data?.databasePreview?.roles) ? data.databasePreview.roles : [];
  const enforcementLabel = useMemo(() => (data?.enforcementEnabled ? "Yes" : "No"), [data?.enforcementEnabled]);
  const activeDbUsers = dbUsers.filter((user: any) => user.status === "active");
  const activeDbRoles = dbRoles.filter((role: any) => role.status === "active");
  const finalRoleModel = data?.finalRoleModel || {};
  const finalRoleOptions = Array.isArray(finalRoleModel?.roles) ? finalRoleModel.roles : [];
  const finalAdminCardOptions = Array.isArray(finalRoleModel?.adminCards) ? finalRoleModel.adminCards : [];
  const finalActiveRoleOptions = finalRoleOptions.filter((role: any) => role && String(role?.status || "active").toLowerCase() === "active");
  const phaseV2RoleOptions = finalActiveRoleOptions.length ? finalActiveRoleOptions : activeDbRoles;
  const editUserRoleKeys = Array.isArray(editUser?.roleKeys) ? editUser.roleKeys.map((roleKey: any) => String(roleKey)) : [];
  const editUserIsAdministratorPlanning = editUserRoleKeys.includes("administrator") || editRoleToAssign === "administrator";
  const editUserIsOwnerPlanning = editUserRoleKeys.includes("owner_admin") || editRoleToAssign === "owner_admin";
  const phaseV2AdministratorCardPlanningVisible = Boolean(editUser && (editUserIsAdministratorPlanning || editUserIsOwnerPlanning));
  const phaseV2AdministratorCardPlanningMode = editUserIsOwnerPlanning ? "owner_all_cards" : editUserIsAdministratorPlanning ? "administrator_selected_cards" : "none";
  const ownerAdminActorEmail = String(
    activeDbUsers.find((user: any) => Array.isArray(user?.roleKeys) && user.roleKeys.includes("owner_admin") && user.status === "active")?.email ||
    activeDbUsers.find((user: any) => user?.bootstrapSafe === true && user.status === "active")?.email ||
    createActorEmail ||
    ""
  ).trim().toLowerCase();
  const previewReady = Boolean(createResult?.ok && createResult?.mode === "preview" && createResult?.wouldCreate?.email === cleanEmail(createEmail));
  const assignPreviewReady = Boolean(
    assignResult?.ok &&
      assignResult?.mode === "preview" &&
      assignResult?.wouldAssign?.email === cleanEmail(assignTargetEmail) &&
      assignResult?.wouldAssign?.roleKey === assignRoleKey
  );
  const selectedRemoveUser = dbUsers.find((user: any) => user.email === removeTargetEmail) || null;
  const selectedRemoveUserRoleKeys = Array.isArray(selectedRemoveUser?.roleKeys) ? selectedRemoveUser.roleKeys : [];
  const removePreviewReady = Boolean(
    removeResult?.ok &&
      removeResult?.mode === "preview" &&
      removeResult?.wouldRemove?.email === cleanEmail(removeTargetEmail) &&
      removeResult?.wouldRemove?.roleKey === removeRoleKey
  );

  const lockoutPreviewReady = Boolean(
    lockoutResult?.ok &&
      lockoutResult?.mode === "preview" &&
      lockoutResult?.wouldChange?.email === cleanEmail(lockoutTargetEmail) &&
      lockoutResult?.wouldChange?.lockoutAction === lockoutAction
  );

  const passwordResetPreviewReady = Boolean(
    passwordResetResult?.ok &&
      passwordResetResult?.mode === "preview" &&
      passwordResetResult?.wouldReset?.email === cleanEmail(passwordResetTargetEmail)
  );


  function formatAdminUserDate(value: unknown): string {
    if (!value) return "—";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  }

  function roleLabelForUser(user: any): string {
    return Array.isArray(user?.roleKeys) && user.roleKeys.length ? user.roleKeys.join(", ") : "None";
  }

  function adminRoleOptions(): any[] {
    return phaseV2RoleOptions;
  }

  function adminUsersPhaseV4FRoleLabel(roleKey: string): string {
    const cleanKey = String(roleKey || "").trim();
    const matched = finalRoleOptions.find((role: any) => String(role?.key || "") === cleanKey);
    if (matched?.label) return String(matched.label);
    if (cleanKey === "owner_admin") return "Owner";
    if (cleanKey === "administrator") return "Administrator";
    if (cleanKey === "full_user") return "Full User";
    if (cleanKey === "basic_user") return "Basic User";
    if (cleanKey === "view_only") return "View Only";
    return cleanKey || "—";
  }

  function adminUsersPhaseV4FRoleLabels(user: any): string[] {
    const roleKeys = Array.isArray(user?.roleKeys) ? user.roleKeys : [];
    return roleKeys.map((key: string) => adminUsersPhaseV4FRoleLabel(key)).filter(Boolean);
  }

  function adminUsersPhaseV4EGrantedAdminCardLabels(user: any): string[] {
    const keys = adminUsersPhaseV4CNormalizeGrantKeys(user?.adminCardGrantKeys);
    if (!Array.isArray(user?.roleKeys) || !user.roleKeys.includes("administrator") || keys.length === 0) return [];
    return keys.map((key) => {
      const card = finalAdminCardOptions.find((option: any) => option?.grantPermissionKey === key);
      return String(card?.label || key);
    }).sort((a, b) => a.localeCompare(b));
  }

  function adminUsersPhaseV4ERoleDisplay(user: any) {
    const roleLabels = adminUsersPhaseV4FRoleLabels(user);
    const grantedCards = adminUsersPhaseV4EGrantedAdminCardLabels(user);
    return (
      <div data-barsh-admin-users-phase-v4e-role-display="true" style={{ display: "grid", gap: 5 }}>
        <strong>{roleLabels.join(", ") || "—"}</strong>
        {grantedCards.length > 0 ? (
          <div data-barsh-admin-users-phase-v4e-admin-card-labels="true" style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {grantedCards.map((label) => (
              <span key={label} data-barsh-admin-users-phase-v4e-admin-card-label="true" style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 999, padding: "3px 7px", fontSize: 11, fontWeight: 850 }}>
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function roleOptionKey(role: any): string {
    return String(role?.key || role?.roleKey || "").trim();
  }

  function roleOptionLabel(role: any): string {
    const key = roleOptionKey(role);
    const name = String(role?.name || role?.label || "").trim();
    return name && name !== key ? `${name} (${key})` : key;
  }

  function editAssignableRoleOptions(): any[] {
    const currentRoleKeys = new Set(Array.isArray(editUser?.roleKeys) ? editUser.roleKeys.map((roleKey: any) => String(roleKey)) : []);
    return adminRoleOptions().filter((role: any) => {
      const key = roleOptionKey(role);
      return key && !currentRoleKeys.has(key);
    });
  }

  function editRemovableRoleOptions(): any[] {
    const currentRoleKeys = new Set(Array.isArray(editUser?.roleKeys) ? editUser.roleKeys.map((roleKey: any) => String(roleKey)) : []);
    return adminRoleOptions().filter((role: any) => {
      const key = roleOptionKey(role);
      return key && currentRoleKeys.has(key);
    });
  }

  function twoFactorSetupPendingForUser(user: any): boolean {
    return user?.twoFactorDisabled !== true && user?.twoFactorPendingSetup === true && Boolean(user?.twoFactorPhone || user?.twoFactorPhoneMasked);
  }

  function twoFactorEnforcedForUser(user: any): boolean {
    return user?.twoFactorDisabled !== true && user?.twoFactorPendingSetup !== true && Boolean(user?.twoFactorPhone || user?.twoFactorPhoneMasked || user?.twoFactorRequired);
  }

  function adminUsersWriteActorEmail(): string {
    const activeOwner = dbUsers.find((user: any) =>
      user?.status === "active" &&
      user?.locked !== true &&
      user?.inactive !== true &&
      Array.isArray(user?.roleKeys) &&
      user.roleKeys.includes("owner_admin") &&
      String(user?.email || "").trim()
    );
    return String(activeOwner?.email || createActorEmail || "").trim().toLowerCase();
  }

  function openCreateUserAction(): void {
    pushAdminUsersActionHistory("create-user");
    setAdminUsersAction("create");
    setCreateResult(null);
    setCreateMessage("");
  }

  function closeAdminUsersAction(): void {
    setAdminUsersAction("none");
  }

  function pushAdminUsersActionHistory(action: string): void {
    if (typeof window === "undefined") return;
    const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
    if (currentState?.barshAdminUsersAction === action) return;
    window.history.pushState({ ...currentState, barshAdminUsersAction: action }, "", window.location.href);
  }

  function closeAdminUsersTransientActionState(): void {
    setAdminUsersAction("none");
    setEditUser(null);
    setEditMessage("");
    setEditRoleToAssign("");
    setEditRoleToRemove("");
    setEditBusy(false);
    setPasswordResetOneTimePassword("");
    setPasswordResetCopyMessage("");
    setTwoFactorSetupUser(null);
    setTwoFactorSetupMessage("");
    setTwoFactorSetupBusy(false);
    setTwoFactorSetupNeedsReauth(false);
  }

  const adminUsersAuditHistoryReturnReloadKey = "barshAdminUsersAuditHistoryReturnReload";

  function markAdminUsersAuditHistoryNavigation(): void {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(adminUsersAuditHistoryReturnReloadKey, "1");
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("adminUsersLiveReturn", String(Date.now()));
    window.history.replaceState({ ...(window.history.state || {}), barshAdminUsersAuditHistoryReturn: true }, "", returnUrl.toString());
  }

  function consumeAdminUsersAuditHistoryReturnReload(): boolean {
    if (typeof window === "undefined") return false;
    const shouldReload = window.sessionStorage.getItem(adminUsersAuditHistoryReturnReloadKey) === "1";
    if (shouldReload) window.sessionStorage.removeItem(adminUsersAuditHistoryReturnReloadKey);
    return shouldReload;
  }

  useEffect(() => {
    const handleAdminUsersPopState = () => {
      closeAdminUsersTransientActionState();
    };
    window.addEventListener("popstate", handleAdminUsersPopState);
    return () => window.removeEventListener("popstate", handleAdminUsersPopState);
  }, []);

  useEffect(() => {
    const preventAdminUsersBackForwardCache = () => undefined;
    window.addEventListener("unload", preventAdminUsersBackForwardCache);
    return () => window.removeEventListener("unload", preventAdminUsersBackForwardCache);
  }, []);

  useEffect(() => {
    const reloadAdminUsersLivePage = () => {
      closeAdminUsersTransientActionState();
      if (consumeAdminUsersAuditHistoryReturnReload()) {
        window.location.reload();
        return;
      }
      void loadAdminUsersPlanning();
    };
    const handleAdminUsersPageShow = () => {
      reloadAdminUsersLivePage();
    };
    const handleAdminUsersVisibilityChange = () => {
      if (document.visibilityState === "visible") reloadAdminUsersLivePage();
    };
    window.addEventListener("pageshow", handleAdminUsersPageShow);
    document.addEventListener("visibilitychange", handleAdminUsersVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", handleAdminUsersPageShow);
      document.removeEventListener("visibilitychange", handleAdminUsersVisibilityChange);
    };
  }, []);

  async function postAdminUsersAction(path: string, body: Record<string, unknown>, label: string) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const json = await readAdminUsersJsonResponse(response, label);
    if (!response.ok || !json?.ok) throw new Error(json?.error || `${label} failed with HTTP ${response.status}.`);
    return json;
  }

  async function patchAdminUsersAction(path: string, body: Record<string, unknown>, label: string) {
    const response = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const json = await readAdminUsersJsonResponse(response, label);
    if (!response.ok || !json?.ok) throw new Error(json?.error || `${label} failed with HTTP ${response.status}.`);
    return json;
  }

  function isAdminUsersAuthExpiredError(error: any): boolean {
    const message = String(error?.message || "");
    return message.includes("status 401") || message.includes("Authenticated administrator session required");
  }

  function goToAdminUsersReauthentication(): void {
    if (typeof window === "undefined") return;
    const next = `${window.location.pathname}${window.location.search || ""}`;
    window.location.href = `/admin?next=${encodeURIComponent(next)}`;
  }

  function openEditAdminUserPanel(user: any): void {
    pushAdminUsersActionHistory("edit-user");
    setEditUser(user);
    setEditFirstName(String(user?.firstName || ""));
    setEditLastName(String(user?.lastName || ""));
    setEditDisplayName(String(user?.displayName || ""));
    setEditUsername(String(user?.username || ""));
    setEditEmail(String(user?.email || ""));
    setEditPhoneExtension(String(user?.phoneExtension || ""));
    setEditFaxNumber(String(user?.faxNumber || ""));
    setEditSignatureBlockName(String(user?.signatureBlockName || user?.displayName || ""));
    setEditTwoFactorPhone(String(user?.twoFactorPhone || ""));
    setEditTwoFactorDisabled(Boolean(user?.twoFactorDisabled));
    setEditTwoFactorPendingSetup(Boolean(user?.twoFactorPendingSetup));
    setEditLocked(Boolean(user?.locked));
    setEditInactive(Boolean(user?.inactive));
    setEditRoleToAssign("");
    setEditRoleToRemove("");
    setEditMessage("");
    setEditNeedsReauth(false);
    setAdminUsersRowMessage("");
  }

  function closeEditAdminUserPanel(): void {
    setEditUser(null);
    setEditMessage("");
    setEditNeedsReauth(false);
    setEditRoleToAssign("");
    setEditRoleToRemove("");
  }

  async function saveEditAdminUserPanel(): Promise<void> {
    if (!editUser) return;
    try {
      setEditBusy(true);
      setEditMessage(`Saving ${editEmail}...`);
      await patchAdminUsersAction("/api/admin/users/signer-profile", {
        apply: true,
        actorEmail: adminUsersWriteActorEmail(),
        userId: editUser.id,
        firstName: editFirstName,
        lastName: editLastName,
        displayName: editDisplayName,
        username: editUsername,
        email: editEmail,
        phoneExtension: editPhoneExtension,
        faxNumber: editFaxNumber,
        signatureBlockName: editSignatureBlockName,
        locked: editLocked,
        inactive: editInactive,
        twoFactorPhone: editTwoFactorPhone,
        twoFactorDisabled: editTwoFactorDisabled,
        twoFactorPendingSetup: editTwoFactorPendingSetup,
      }, "Save user");

      const assignedRole = editRoleToAssign.trim();
      const removedRole = editRoleToRemove.trim();

      if (assignedRole) {
        await postAdminUsersAction("/api/admin/users/assign-role", { apply: true, targetEmail: editEmail, roleKey: assignedRole, actorEmail: adminUsersWriteActorEmail() }, "Assign role from edit");
      }

      if (removedRole) {
        await postAdminUsersAction("/api/admin/users/remove-role", { apply: true, targetEmail: editEmail, roleKey: removedRole, actorEmail: adminUsersWriteActorEmail() }, "Remove role from edit");
      }

      setAdminUsersRowMessage(`Saved ${editEmail}${assignedRole ? `; assigned ${assignedRole}` : ""}${removedRole ? `; removed ${removedRole}` : ""}.`);
      closeEditAdminUserPanel();
      await loadAdminUsersPlanning();
    } catch (error: any) {
      if (isAdminUsersAuthExpiredError(error)) {
        setEditNeedsReauth(true);
        setEditMessage("Your administrator session expired. Re-authenticate, then return to this edit screen and save again.");
        setAdminUsersRowMessage("Save user blocked: administrator session expired.");
      } else {
        setEditMessage(error?.message || "Save user failed.");
        setAdminUsersRowMessage(error?.message || "Save user failed.");
      }
    } finally {
      setEditBusy(false);
    }
  }


  async function resetPasswordFromRow(user: any): Promise<void> {
    const reason = window.prompt(`Reason for resetting password for ${user.email}`, "Administrator password reset");
    if (!reason) return;
    try {
      setAdminUsersRowBusy(true);
      const json = await postAdminUsersAction("/api/admin/users/password-reset", { apply: true, targetEmail: user.email, reason, actorEmail: adminUsersWriteActorEmail() }, "Password reset");
      if (json?.temporaryPassword && json?.temporaryPasswordOneTimeDisplay) {
        pushAdminUsersActionHistory("password-reset-one-time");
        setPasswordResetOneTimePassword(String(json.temporaryPassword));
        setPasswordResetCopyMessage("");
      }
      setAdminUsersRowMessage(`Password reset for ${user.email}.`);
      await loadAdminUsersPlanning();
    } catch (error: any) {
      setAdminUsersRowMessage(error?.message || "Password reset failed.");
    } finally {
      setAdminUsersRowBusy(false);
    }
  }

  function openTwoFactorSetupPanel(user: any): void {
    setTwoFactorSetupUser(user);
    setTwoFactorSetupPhone(String(user?.twoFactorPhone || ""));
    setTwoFactorSetupMessage("");
    setTwoFactorSetupNeedsReauth(false);
    setAdminUsersRowMessage("");
  }

  function closeTwoFactorSetupPanel(): void {
    setTwoFactorSetupUser(null);
    setTwoFactorSetupPhone("");
    setTwoFactorSetupMessage("");
    setTwoFactorSetupBusy(false);
    setTwoFactorSetupNeedsReauth(false);
  }

  function openTwoFactorVerifyPanel(user: any) {
    setTwoFactorVerifyUser(user);
    setTwoFactorVerifyCode("");
    setTwoFactorVerifyMessage("");
    setTwoFactorSetupChallengeCode("");
  }

  function closeTwoFactorVerifyPanel() {
    setTwoFactorVerifyUser(null);
    setTwoFactorVerifyCode("");
    setTwoFactorVerifyMessage("");
    setTwoFactorSetupChallengeCode("");
    setTwoFactorVerifyBusy(false);
  }

  async function createTwoFactorSetupChallenge(): Promise<void> {
    if (!twoFactorVerifyUser?.email) return;
    setTwoFactorVerifyBusy(true);
    setTwoFactorVerifyMessage("Creating setup verification challenge...");
    setTwoFactorSetupChallengeCode("");
    try {
      const response = await fetch("/api/auth/2fa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: twoFactorVerifyUser.email, setupVerification: true }),
      });
      const json = await response.json().catch(() => ({ ok: false, error: "2FA challenge route did not return JSON." }));
      if (!response.ok || !json?.ok) {
        setTwoFactorVerifyMessage(json?.error || `2FA challenge failed with HTTP ${response.status}.`);
        return;
      }
      setTwoFactorSetupChallengeCode(String(json?.setupVerificationCode || ""));
      setTwoFactorVerifyMessage("Setup verification challenge created. Enter the code shown below.");
    } catch (error: any) {
      setTwoFactorVerifyMessage(error?.message || "2FA challenge failed.");
    } finally {
      setTwoFactorVerifyBusy(false);
    }
  }

  async function verifyTwoFactorSetupCode(): Promise<void> {
    if (!twoFactorVerifyUser?.email) return;
    if (!twoFactorVerifyCode.trim()) {
      setTwoFactorVerifyMessage("Enter the setup verification code.");
      return;
    }
    setTwoFactorVerifyBusy(true);
    setTwoFactorVerifyMessage("Verifying 2FA setup code...");
    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: twoFactorVerifyUser.email, code: twoFactorVerifyCode.trim(), setupVerification: true }),
      });
      const json = await response.json().catch(() => ({ ok: false, error: "2FA verify route did not return JSON." }));
      if (!response.ok || !json?.ok) {
        setTwoFactorVerifyMessage(json?.error || `2FA verify failed with HTTP ${response.status}.`);
        return;
      }
      setTwoFactorVerifyMessage("2FA setup verified. This user is now marked 2FA Enforced.");
      setAdminUsersRowMessage(`2FA setup verified for ${twoFactorVerifyUser.email}.`);
      await loadAdminUsersPlanning();
      closeTwoFactorVerifyPanel();
    } catch (error: any) {
      setTwoFactorVerifyMessage(error?.message || "2FA verification failed.");
    } finally {
      setTwoFactorVerifyBusy(false);
    }
  }

  async function startTwoFactorSetupFromPanel(): Promise<void> {
    if (!twoFactorSetupUser) return;
    const phone = twoFactorSetupPhone.trim();
    if (!phone) {
      setTwoFactorSetupMessage("2FA phone is required to start setup.");
      return;
    }

    try {
      setTwoFactorSetupBusy(true);
      setTwoFactorSetupMessage(`Starting 2FA setup for ${twoFactorSetupUser.email}...`);
      await patchAdminUsersAction("/api/admin/users/signer-profile", {
        apply: true,
        actorEmail: adminUsersWriteActorEmail(),
        userId: twoFactorSetupUser.id,
        firstName: twoFactorSetupUser.firstName || "",
        lastName: twoFactorSetupUser.lastName || "",
        displayName: twoFactorSetupUser.displayName || "",
        username: twoFactorSetupUser.username || "",
        email: twoFactorSetupUser.email,
        phoneExtension: twoFactorSetupUser.phoneExtension || "",
        faxNumber: twoFactorSetupUser.faxNumber || "",
        signatureBlockName: twoFactorSetupUser.signatureBlockName || twoFactorSetupUser.displayName || "",
        locked: Boolean(twoFactorSetupUser.locked),
        inactive: Boolean(twoFactorSetupUser.inactive),
        twoFactorPhone: phone,
        twoFactorDisabled: false,
        twoFactorPendingSetup: true,
      }, "Start 2FA setup");
      setAdminUsersRowMessage(`2FA setup started for ${twoFactorSetupUser.email}. Complete and verify setup before treating it as enforced.`);
      closeTwoFactorSetupPanel();
      await loadAdminUsersPlanning();
    } catch (error: any) {
      if (isAdminUsersAuthExpiredError(error)) {
        setTwoFactorSetupNeedsReauth(true);
        setTwoFactorSetupMessage("Your administrator session expired. Re-authenticate, then return and start 2FA setup again.");
        setAdminUsersRowMessage("2FA setup blocked: administrator session expired.");
      } else {
        setTwoFactorSetupMessage(error?.message || "2FA setup failed.");
        setAdminUsersRowMessage(error?.message || "2FA setup failed.");
      }
    } finally {
      setTwoFactorSetupBusy(false);
    }
  }


  async function lockUserFromRow(user: any): Promise<void> {
    const lockoutAction = user.status === "active" && !user.locked && !user.inactive ? "lock" : "unlock";
    const reason = window.prompt(`Reason to ${lockoutAction} ${user.email}`, `Administrator ${lockoutAction} action`);
    if (!reason) return;
    try {
      setAdminUsersRowBusy(true);
      await postAdminUsersAction("/api/admin/users/lockout", { apply: true, targetEmail: user.email, lockoutAction, reason, actorEmail: adminUsersWriteActorEmail() }, "Lock user");
      setAdminUsersRowMessage(`${lockoutAction === "lock" ? "Locked" : "Unlocked"} ${user.email}.`);
      await loadAdminUsersPlanning();
    } catch (error: any) {
      setAdminUsersRowMessage(error?.message || "Lock action failed.");
    } finally {
      setAdminUsersRowBusy(false);
    }
  }

  async function signOutUserFromRow(user: any): Promise<void> {
    if (!window.confirm(`Sign out ${user.email} and invalidate that session?`)) return;
    try {
      setAdminUsersRowBusy(true);
      await postAdminUsersAction("/api/auth/signout", { email: user.email, reason: "Administrator row sign out action" }, "Sign out user");
      setAdminUsersRowMessage(`Signed out ${user.email}.`);
      await loadAdminUsersPlanning();
    } catch (error: any) {
      setAdminUsersRowMessage(error?.message || "Sign out failed.");
    } finally {
      setAdminUsersRowBusy(false);
    }
  }

  async function assignRoleFromRow(user: any): Promise<void> {
    const roleKey = window.prompt(`Role to assign to ${user.email}`, "");
    if (!roleKey) return;
    try {
      setAdminUsersRowBusy(true);
      await postAdminUsersAction("/api/admin/users/assign-role", { apply: true, targetEmail: user.email, roleKey, actorEmail: adminUsersWriteActorEmail() }, "Assign role");
      setAdminUsersRowMessage(`Assigned ${roleKey} to ${user.email}.`);
      await loadAdminUsersPlanning();
    } catch (error: any) {
      setAdminUsersRowMessage(error?.message || "Assign role failed.");
    } finally {
      setAdminUsersRowBusy(false);
    }
  }

  async function removeRoleFromRow(user: any): Promise<void> {
    const currentRoles = roleLabelForUser(user);
    const roleKey = window.prompt(`Role to remove from ${user.email}`, currentRoles === "None" ? "" : currentRoles.split(",")[0].trim());
    if (!roleKey) return;
    try {
      setAdminUsersRowBusy(true);
      await postAdminUsersAction("/api/admin/users/remove-role", { apply: true, targetEmail: user.email, roleKey, actorEmail: adminUsersWriteActorEmail() }, "Remove role");
      setAdminUsersRowMessage(`Removed ${roleKey} from ${user.email}.`);
      await loadAdminUsersPlanning();
    } catch (error: any) {
      setAdminUsersRowMessage(error?.message || "Remove role failed.");
    } finally {
      setAdminUsersRowBusy(false);
    }
  }

  async function copyPasswordResetOneTimePassword() {
    if (!passwordResetOneTimePassword) return;
    try {
      await navigator.clipboard.writeText(passwordResetOneTimePassword);
      setPasswordResetCopyMessage("Temporary password copied.");
    } catch {
      setPasswordResetCopyMessage("Copy failed. Select and copy the password manually.");
    }
  }

  function closePasswordResetOneTimeModal() {
    setPasswordResetOneTimePassword("");
    setPasswordResetCopyMessage("");
  }

  async function submitCreateAdminUser(apply: boolean) {
    try {
      setCreateBusy(true);
      setCreateMessage(apply ? "Applying guarded create-admin-user request..." : "Previewing guarded create-admin-user request...");
      const response = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          apply,
          firstName: createFirstName,
          lastName: createLastName,
          displayName: createDisplayName,
          username: createUsername,
          email: createEmail,
          phoneExtension: createPhoneExtension,
          faxNumber: createFaxNumber,
          signatureBlockName: createSignatureBlockName,
          locked: createLocked,
          inactive: createInactive,
          twoFactorPhone: createTwoFactorPhone,
          twoFactorDisabled: createTwoFactorDisabled,
          twoFactorPendingSetup: createTwoFactorPendingSetup,
          status: createInactive ? "inactive" : createStatus,
          notes: createNotes,
          actorEmail: adminUsersWriteActorEmail(),
        }),
      });
      const json = await readAdminUsersJsonResponse(response, "Admin users request").catch(() => ({ ok: false, error: "Create admin user route did not return JSON." }));
      setCreateResult({ ...json, httpStatus: response.status });
      if (!response.ok || !json?.ok) {
        setCreateMessage(json?.error || `Create admin user request failed with HTTP ${response.status}.`);
        return;
      }
      if (apply) {
        setCreateMessage("Admin user created. Roles were not assigned. Permission enforcement setting was not changed.");
        setCreateFirstName("");
        setCreateLastName("");
        setCreateDisplayName("");
        setCreateUsername("");
        setCreateEmail("");
        setCreatePhoneExtension("");
        setCreateFaxNumber("");
        setCreateSignatureBlockName("");
        setCreateLocked(false);
        setCreateInactive(false);
        setCreateTwoFactorPhone("");
        setCreateTwoFactorDisabled(false);
        setCreateTwoFactorPendingSetup(false);
        setCreateNotes("");
        setCreateStatus("active");
        await loadAdminUsersPlanning();
      } else {
        setCreateMessage("Preview complete. No AdminUser row was created. Review the result before Apply.");
      }
    } catch (err: any) {
      setCreateMessage(err?.message || "Create admin user request failed.");
      setCreateResult({ ok: false, error: err?.message || "Create admin user request failed." });
    } finally {
      setCreateBusy(false);
    }
  }

  async function submitAssignAdminRole(apply: boolean) {
    try {
      setAssignBusy(true);
      setAssignMessage(apply ? "Applying guarded assign-role request..." : "Previewing guarded assign-role request...");
      const response = await fetch("/api/admin/users/assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          apply,
          targetEmail: assignTargetEmail,
          roleKey: assignRoleKey,
          actorEmail: assignActorEmail,
        }),
      });
      const json = await readAdminUsersJsonResponse(response, "Admin users request").catch(() => ({ ok: false, error: "Assign role route did not return JSON." }));
      setAssignResult({ ...json, httpStatus: response.status });
      if (!response.ok || !json?.ok) {
        setAssignMessage(json?.error || `Assign role request failed with HTTP ${response.status}.`);
        return;
      }
      if (apply) {
        setAssignMessage("Admin role assigned. Permission enforcement setting was not changed.");
        setAssignRoleKey("");
        setAssignResult(null);
        await loadAdminUsersPlanning();
      } else {
        setAssignMessage("Preview complete. No AdminUserRole row was created. Review the result before Apply.");
      }
    } catch (err: any) {
      setAssignMessage(err?.message || "Assign role request failed.");
      setAssignResult({ ok: false, error: err?.message || "Assign role request failed." });
    } finally {
      setAssignBusy(false);
    }
  }

  async function submitRemoveAdminRole(apply: boolean) {
    try {
      setRemoveBusy(true);
      setRemoveMessage(apply ? "Applying guarded remove-role request..." : "Previewing guarded remove-role request...");
      const response = await fetch("/api/admin/users/remove-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          apply,
          targetEmail: removeTargetEmail,
          roleKey: removeRoleKey,
          actorEmail: removeActorEmail,
        }),
      });
      const json = await readAdminUsersJsonResponse(response, "Admin users request").catch(() => ({ ok: false, error: "Remove role route did not return JSON." }));
      setRemoveResult({ ...json, httpStatus: response.status });
      if (!response.ok || !json?.ok) {
        setRemoveMessage(json?.error || `Remove role request failed with HTTP ${response.status}.`);
        return;
      }
      if (apply) {
        setRemoveMessage("Admin role removed. Permission enforcement setting was not changed.");
        setRemoveRoleKey("");
        setRemoveResult(null);
        await loadAdminUsersPlanning();
      } else {
        setRemoveMessage("Preview complete. No AdminUserRole row was deleted. Review the result before Apply.");
      }
    } catch (err: any) {
      setRemoveMessage(err?.message || "Remove role request failed.");
      setRemoveResult({ ok: false, error: err?.message || "Remove role request failed." });
    } finally {
      setRemoveBusy(false);
    }
  }



  async function submitAdminUserPasswordReset(apply: boolean) {
    try {
      setPasswordResetBusy(true);
      setPasswordResetMessage(apply ? "Applying guarded password reset request..." : "Previewing guarded password reset request...");
      const response = await fetch("/api/admin/users/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          apply,
          targetEmail: passwordResetTargetEmail,
          temporaryPassword: passwordResetTemporaryPassword,
          reason: passwordResetReason,
          actorEmail: passwordResetActorEmail,
        }),
      });
      const json = await readAdminUsersJsonResponse(response, "Admin users request").catch(() => ({ ok: false, error: "Password reset route did not return JSON." }));
      setPasswordResetResult({ ...json, httpStatus: response.status });
      if (apply && json?.ok && json?.temporaryPassword && json?.temporaryPasswordOneTimeDisplay) {
        setPasswordResetOneTimePassword(String(json.temporaryPassword));
        setPasswordResetCopyMessage("");
      }
      if (!response.ok || !json?.ok) {
        setPasswordResetMessage(json?.error || `Password reset request failed with HTTP ${response.status}.`);
        return;
      }
      if (apply) {
        setPasswordResetMessage("Password reset applied. Password was hashed, not displayed, and change-required is set.");
        setPasswordResetTemporaryPassword("");
        setPasswordResetResult(null);
        await loadAdminUsersPlanning();
      } else {
        setPasswordResetMessage("Preview complete. No password hash was changed. Review the result before Apply.");
      }
    } catch (err: any) {
      setPasswordResetMessage(err?.message || "Password reset request failed.");
      setPasswordResetResult({ ok: false, error: err?.message || "Password reset request failed." });
    } finally {
      setPasswordResetBusy(false);
    }
  }

  async function submitAdminUserLockout(apply: boolean) {
    try {
      setLockoutBusy(true);
      setLockoutMessage(apply ? "Applying guarded lock/unlock request..." : "Previewing guarded lock/unlock request...");
      const response = await fetch("/api/admin/users/lockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          apply,
          targetEmail: lockoutTargetEmail,
          lockoutAction,
          reason: lockoutReason,
          actorEmail: lockoutActorEmail,
        }),
      });
      const json = await readAdminUsersJsonResponse(response, "Admin users request").catch(() => ({ ok: false, error: "Lock/unlock route did not return JSON." }));
      setLockoutResult({ ...json, httpStatus: response.status });
      if (!response.ok || !json?.ok) {
        setLockoutMessage(json?.error || `Lock/unlock request failed with HTTP ${response.status}.`);
        return;
      }
      if (apply) {
        setLockoutMessage(lockoutAction === "lock" ? "Admin user locked out. Credentials were not exposed and enforcement was not changed." : "Admin user unlocked. Credentials were not exposed and enforcement was not changed.");
        setLockoutResult(null);
        await loadAdminUsersPlanning();
      } else {
        setLockoutMessage("Preview complete. No AdminUser row was changed. Review the result before Apply.");
      }
    } catch (err: any) {
      setLockoutMessage(err?.message || "Lock/unlock request failed.");
      setLockoutResult({ ok: false, error: err?.message || "Lock/unlock request failed." });
    } finally {
      setLockoutBusy(false);
    }
  }



  async function saveEditAdminCardGrants(apply: boolean) {
    if (!editUser) return;
    setEditAdminCardGrantBusy(true);
    setEditAdminCardGrantMessage("");
    setEditAdminCardGrantResult(null);

    try {
      const response = await fetch("/api/admin/users/card-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apply,
          actorEmail: ownerAdminActorEmail,
          targetEmail: editEmail || editUser.email,
          grantPermissionKeys: editAdminCardGrantKeys,
          reason: "Administrator Admin-card grants updated from Admin Users edit panel.",
        }),
      });
      const json = await readAdminUsersJsonResponse(response, apply ? "Save Administrator Admin-card grants" : "Preview Administrator Admin-card grants");
      setEditAdminCardGrantResult(json);
      setEditAdminCardGrantMessage(apply ? "Administrator Admin-card grants saved." : "Administrator Admin-card grant preview ready.");
      if (apply) {
        await loadAdminUsersPlanning();
      }
    } catch (err: any) {
      setEditAdminCardGrantMessage(err?.message || "Administrator Admin-card grant request failed.");
    } finally {
      setEditAdminCardGrantBusy(false);
    }
  }


  return (
    <main data-barsh-admin-users-planning-page="phase3-guarded" data-barsh-admin-users-browser-back-action-history="true" data-barsh-admin-users-audit-history-back-live-reload="true" data-barsh-admin-users-audit-history-back-always-live="true" data-barsh-admin-users-audit-history-back-hard-refresh="true" data-barsh-admin-users-audit-history-back-cache-bust="true" style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 30, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 24, padding: 22 }}>
          <h1 style={{ margin: 0, fontSize: 30 }}>Users & Roles</h1>
        </section>

        {error ? <section data-barsh-admin-users-planning-error="true" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 18, padding: 16 }}>{error}</section> : null}

                        <section data-barsh-admin-users-planning-summary="true" style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div><strong>Users:</strong> {data?.databasePreview?.userCount ?? 0} | <strong>Roles:</strong> {data?.databasePreview?.roleCount ?? 0} | <strong>Final Roles:</strong> {finalRoleOptions.length || 0} | <strong>Admin Cards:</strong> {finalAdminCardOptions.length || 0} | <strong>Enforcement Enabled:</strong> {enforcementLabel}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <a href="/admin/audit-history" data-barsh-admin-users-audit-history-top-link="true" onClick={markAdminUsersAuditHistoryNavigation} style={{ ...primaryButtonStyle, display: "inline-flex", textDecoration: "none", color: "#ffffff" }}>Open Audit History</a>
            <button data-barsh-admin-users-create-top-button="true" type="button" onClick={openCreateUserAction} style={primaryButtonStyle}>Create User</button>
          </div>
          <div data-barsh-admin-users-phase-v2-final-role-model-note="true" style={{ width: "100%", border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 12, padding: 10, fontWeight: 850 }}>
            Administrator Admin-card access can be previewed and saved. Permission enforcement is not active yet.
          </div>
          {adminUsersRowMessage ? <div data-barsh-admin-users-row-action-message="true" style={{ width: "100%", color: adminUsersRowMessage.toLowerCase().includes("failed") ? "#991b1b" : "#166534", fontWeight: 900 }}>{adminUsersRowMessage}</div> : null}
        </section>

        
        





        

        

        

        

        {adminUsersAction === "create" ? (<section data-barsh-admin-users-create-user-control="phase3-guarded" style={{ ...cardStyle, border: "1px solid #bfdbfe", boxShadow: "0 12px 26px rgba(30, 58, 138, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Create User</h2>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>Create a new administrator user with signer profile and two-factor setup fields. Preview remains required before Apply. Roles are assigned separately, and this action does not change permission enforcement.</p>
            </div>
            <span data-barsh-admin-users-create-user-enforcement-disabled="true" style={{ border: "1px solid #fde68a", background: "#fefce8", color: "#713f12", borderRadius: 999, padding: "7px 10px", fontWeight: 950, fontSize: 12 }}>Enforcement Disabled</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              First Name
              <input data-barsh-admin-users-create-first-name="true" value={createFirstName} onChange={(event) => { setCreateFirstName(event.target.value); setCreateResult(null); }} style={inputStyle} placeholder="Jane" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Last Name
              <input data-barsh-admin-users-create-last-name="true" value={createLastName} onChange={(event) => { setCreateLastName(event.target.value); setCreateResult(null); }} style={inputStyle} placeholder="Doe" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Username
              <input data-barsh-admin-users-create-username="true" value={createUsername} onChange={(event) => { setCreateUsername(event.target.value); setCreateResult(null); }} style={inputStyle} placeholder="JDoe" />
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Email
              <input data-barsh-admin-users-create-email="true" value={createEmail} onChange={(event) => { setCreateEmail(event.target.value); setCreateResult(null); }} style={inputStyle} placeholder="new-admin@example.com" />
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Display Name
              <input data-barsh-admin-users-create-display-name="true" value={createDisplayName} onChange={(event) => setCreateDisplayName(event.target.value)} style={inputStyle} placeholder="New Admin User" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Phone Extension
              <input data-barsh-admin-users-create-phone-extension="true" value={createPhoneExtension} onChange={(event) => { setCreatePhoneExtension(event.target.value); setCreateResult(null); }} style={inputStyle} placeholder="101" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Fax Number
              <input data-barsh-admin-users-create-fax-number="true" value={createFaxNumber} onChange={(event) => { setCreateFaxNumber(event.target.value); setCreateResult(null); }} style={inputStyle} placeholder="(516) 706-5055" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Signature Block Name
              <input data-barsh-admin-users-create-signature-block-name="true" value={createSignatureBlockName} onChange={(event) => { setCreateSignatureBlockName(event.target.value); setCreateResult(null); }} style={inputStyle} placeholder="Jane Doe" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Status
              <select data-barsh-admin-users-create-status="true" value={createStatus} onChange={(event) => { setCreateStatus(event.target.value); setCreateInactive(event.target.value !== "active"); setCreateResult(null); }} style={inputStyle}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              2FA Phone
              <input data-barsh-admin-users-create-two-factor-phone="true" value={createTwoFactorPhone} onChange={(event) => { setCreateTwoFactorPhone(event.target.value); setCreateResult(null); }} style={inputStyle} placeholder="Expected format: (631) 555-1234" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155", display: "flex", alignItems: "center", gap: 8, paddingTop: 24 }}>
              <input data-barsh-admin-users-create-locked="true" type="checkbox" checked={createLocked} onChange={(event) => { setCreateLocked(event.target.checked); setCreateResult(null); }} />
              Locked
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155", display: "flex", alignItems: "center", gap: 8, paddingTop: 24 }}>
              <input data-barsh-admin-users-create-inactive="true" type="checkbox" checked={createInactive} onChange={(event) => { setCreateInactive(event.target.checked); setCreateStatus(event.target.checked ? "inactive" : "active"); setCreateResult(null); }} />
              Inactive
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155", display: "flex", alignItems: "center", gap: 8 }}>
              <input data-barsh-admin-users-create-two-factor-disabled="true" type="checkbox" checked={createTwoFactorDisabled} onChange={(event) => { setCreateTwoFactorDisabled(event.target.checked); setCreateResult(null); }} />
              2FA Disabled
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155", display: "flex", alignItems: "center", gap: 8 }}>
              <input data-barsh-admin-users-create-two-factor-pending-setup="true" type="checkbox" checked={createTwoFactorPendingSetup} onChange={(event) => { setCreateTwoFactorPendingSetup(event.target.checked); setCreateResult(null); }} />
              2FA Pending Setup
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Owner Admin Actor Email
              <input data-barsh-admin-users-create-actor-email="true" value={createActorEmail} onChange={(event) => setCreateActorEmail(event.target.value)} style={inputStyle} placeholder="owner_admin email" />
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850, gridColumn: "1 / -1" }}>
              Notes
              <textarea data-barsh-admin-users-create-notes="true" value={createNotes} onChange={(event) => setCreateNotes(event.target.value)} style={{ ...inputStyle, minHeight: 76, resize: "vertical" }} placeholder="Optional internal notes" />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                      <p data-barsh-admin-users-signer-eligibility-note="true" style={{ margin: "12px 0 0", color: "#7c2d12", lineHeight: 1.45, fontWeight: 800 }}>Signer eligibility is not yet a separate schema/UI setting. It remains a later approved phase before document generation relies on selectable eligible signers.</p>
            <button data-barsh-admin-users-create-preview-button="true" type="button" onClick={() => void submitCreateAdminUser(false)} disabled={createBusy} style={{ ...secondaryButtonStyle, opacity: createBusy ? 0.7 : 1 }}>
              {createBusy ? "Working..." : "Preview Create User"}
            </button>
            <button data-barsh-admin-users-create-apply-button="true" type="button" onClick={() => void submitCreateAdminUser(true)} disabled={createBusy || !previewReady} style={{ ...primaryButtonStyle, opacity: createBusy || !previewReady ? 0.55 : 1, cursor: createBusy || !previewReady ? "not-allowed" : "pointer" }}>
              Apply Create User
            </button>
          </div>

          <div data-barsh-admin-users-create-result="true" style={{ marginTop: 14, background: createResult?.ok ? "#f0fdf4" : createResult ? "#fef2f2" : "#f8fafc", border: `1px solid ${createResult?.ok ? "#bbf7d0" : createResult ? "#fecaca" : "#e2e8f0"}`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 950, color: createResult?.ok ? "#166534" : createResult ? "#991b1b" : "#475569" }}>{createMessage || "Preview the request before applying. Apply remains disabled until a matching preview succeeds."}</div>
            {createResult ? <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontSize: 12, fontFamily: "monospace" }}>{JSON.stringify(createResult, null, 2)}</pre> : null}
          </div>
        </section>) : null}

        

        

        

        
        {editUser ? (<section data-barsh-admin-users-edit-panel="true" style={{ ...cardStyle, border: "1px solid #bfdbfe", boxShadow: "0 12px 26px rgba(30, 58, 138, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Edit User</h2>
            <button data-barsh-admin-users-edit-cancel-button="true" type="button" onClick={closeEditAdminUserPanel} disabled={editBusy} style={secondaryButtonStyle}>Cancel</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>First Name<input data-barsh-admin-users-edit-first-name="true" value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>Last Name<input data-barsh-admin-users-edit-last-name="true" value={editLastName} onChange={(event) => setEditLastName(event.target.value)} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>Display Name<input data-barsh-admin-users-edit-display-name="true" value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>User Name<input data-barsh-admin-users-edit-username="true" value={editUsername} onChange={(event) => setEditUsername(event.target.value)} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>Email<input data-barsh-admin-users-edit-email="true" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>Phone Extension<input data-barsh-admin-users-edit-phone-extension="true" value={editPhoneExtension} onChange={(event) => setEditPhoneExtension(event.target.value)} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>Fax Number<input data-barsh-admin-users-edit-fax-number="true" value={editFaxNumber} onChange={(event) => setEditFaxNumber(event.target.value)} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>Signature Block Name<input data-barsh-admin-users-edit-signature-block-name="true" value={editSignatureBlockName} onChange={(event) => setEditSignatureBlockName(event.target.value)} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>2FA Phone<input data-barsh-admin-users-edit-two-factor-phone="true" value={editTwoFactorPhone} onChange={(event) => setEditTwoFactorPhone(event.target.value)} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Role to Assign
              <select data-barsh-admin-users-edit-role-assign-picklist="true" data-barsh-admin-users-phase-v2-final-role-picklist="true" value={editRoleToAssign} onChange={(event) => setEditRoleToAssign(event.target.value)} style={inputStyle}>
                <option value="">No role assignment</option>
                {editAssignableRoleOptions().map((role: any) => {
                  const key = roleOptionKey(role);
                  return <option key={key} value={key}>{roleOptionLabel(role)}</option>;
                })}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Role to Remove
              <select data-barsh-admin-users-edit-role-remove-picklist="true" data-barsh-admin-users-phase-v2-final-role-remove-picklist="true" value={editRoleToRemove} onChange={(event) => setEditRoleToRemove(event.target.value)} style={inputStyle}>
                <option value="">No role removal</option>
                {editRemovableRoleOptions().map((role: any) => {
                  const key = roleOptionKey(role);
                  return <option key={key} value={key}>{roleOptionLabel(role)}</option>;
                })}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 850 }}><input data-barsh-admin-users-edit-locked="true" type="checkbox" checked={editLocked} onChange={(event) => setEditLocked(event.target.checked)} />Locked</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 850 }}><input data-barsh-admin-users-edit-inactive="true" type="checkbox" checked={editInactive} onChange={(event) => setEditInactive(event.target.checked)} />Inactive</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 850 }}><input data-barsh-admin-users-edit-two-factor-disabled="true" type="checkbox" checked={editTwoFactorDisabled} onChange={(event) => setEditTwoFactorDisabled(event.target.checked)} />2FA Disabled</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 850 }}><input data-barsh-admin-users-edit-two-factor-pending-setup="true" type="checkbox" checked={editTwoFactorPendingSetup} onChange={(event) => setEditTwoFactorPendingSetup(event.target.checked)} />2FA Pending Setup</label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            {phaseV2AdministratorCardPlanningVisible ? (
              <section data-barsh-admin-users-phase-v2-admin-card-planning="true" style={{ gridColumn: "1 / -1", border: "1px solid #dbeafe", background: "#eff6ff", borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Administrator Admin Cards</h3>
                    <p style={{ margin: 0, color: "#1e3a8a", lineHeight: 1.45, fontWeight: 800 }}>
                      Select which Admin cards this Administrator can access. Permission enforcement is not active yet.
                    </p>
                  </div>
                  <span data-barsh-admin-users-phase-v2-admin-card-mode="true" style={{ border: "1px solid #93c5fd", background: "#ffffff", color: "#1e3a8a", borderRadius: 999, padding: "7px 10px", fontWeight: 950, fontSize: 12 }}>
                    {phaseV2AdministratorCardPlanningMode}
                  </span>
                </div>
                <div data-barsh-admin-users-phase-v2-admin-card-checkboxes="true" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginTop: 12 }}>
                  {finalAdminCardOptions.map((card: any) => {
                    const checked = editUserIsOwnerPlanning || editAdminCardGrantKeys.includes(card.grantPermissionKey);
                    const disabled = editUserIsOwnerPlanning || editAdminCardGrantBusy;
                    return (
                      <label key={card.key} data-barsh-admin-users-phase-v2-admin-card-option={card.key} data-barsh-admin-users-phase-v4c-admin-card-option={card.key} style={{ display: "grid", gap: 4, border: "1px solid #bfdbfe", background: "#ffffff", borderRadius: 12, padding: 10 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => setEditAdminCardGrantKeys((keys) => adminUsersPhaseV4CToggleGrantKey(keys, card.grantPermissionKey))}
                            data-barsh-admin-users-phase-v2-admin-card-checkbox="true"
                            data-barsh-admin-users-phase-v4c-admin-card-checkbox="true"
                          />
                          {card.label}
                        </span>
                        <span style={{ fontFamily: "monospace", color: "#475569", fontSize: 12 }}>{card.grantPermissionKey}</span>
                        <span style={{ color: "#475569", lineHeight: 1.35, fontSize: 12 }}>{card.description}</span>
                        {card.ownerOnlyRecommended ? <span style={{ color: "#7c2d12", fontSize: 12, fontWeight: 900 }}>Owner-only recommended unless explicitly granted.</span> : null}
                      </label>
                    );
                  })}
                </div>
                {editUserIsAdministratorPlanning && !editUserIsOwnerPlanning ? (
                  <div data-barsh-admin-users-phase-v4c-admin-card-actions="true" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <div data-barsh-admin-users-phase-v4c-admin-card-message="true" style={{ color: editAdminCardGrantMessage.toLowerCase().includes("failed") ? "#991b1b" : "#166534", fontWeight: 900 }}>
                      {editAdminCardGrantMessage || "Select Admin cards, preview the change, then save grants."}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button data-barsh-admin-users-phase-v4c-preview-card-grants-button="true" type="button" onClick={() => void saveEditAdminCardGrants(false)} disabled={editAdminCardGrantBusy} style={{ ...secondaryButtonStyle, opacity: editAdminCardGrantBusy ? 0.7 : 1 }}>
                        Preview Card Grants
                      </button>
                      <button data-barsh-admin-users-phase-v4c-save-card-grants-button="true" type="button" onClick={() => void saveEditAdminCardGrants(true)} disabled={editAdminCardGrantBusy} style={{ ...primaryButtonStyle, opacity: editAdminCardGrantBusy ? 0.7 : 1 }}>
                        {editAdminCardGrantBusy ? "Saving Cards..." : "Save Card Grants"}
                      </button>
                    </div>
                    {editAdminCardGrantResult ? (
                      <pre data-barsh-admin-users-phase-v4c-card-grant-result="true" style={{ width: "100%", whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #dbeafe", borderRadius: 12, padding: 10, margin: 0, color: "#0f172a", fontSize: 12 }}>
                        {JSON.stringify({
                          mode: editAdminCardGrantResult.mode,
                          requestedGrantKeys: editAdminCardGrantResult.requestedGrantKeys,
                          savedGrantKeys: editAdminCardGrantResult.savedGrantKeys,
                          databaseChanged: editAdminCardGrantResult.databaseChanged,
                          enforcementChanged: editAdminCardGrantResult.enforcementChanged,
                        }, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}
            <button data-barsh-admin-users-edit-save-button="true" type="button" onClick={() => void saveEditAdminUserPanel()} disabled={editBusy} style={{ ...primaryButtonStyle, opacity: editBusy ? 0.7 : 1 }}>{editBusy ? "Saving..." : "Save User"}</button>
          </div>

          {editMessage ? <p data-barsh-admin-users-edit-message="true" style={{ margin: "12px 0 0", color: editMessage.toLowerCase().includes("failed") || editMessage.toLowerCase().includes("unauthorized") || editNeedsReauth ? "#991b1b" : "#166534", fontWeight: 900 }}>{editMessage}</p> : null}
          {editNeedsReauth ? (
            <div data-barsh-admin-users-edit-reauth-panel="true" style={{ marginTop: 12, padding: 12, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12 }}>
              <p style={{ margin: "0 0 10px", color: "#991b1b", fontWeight: 900 }}>Your edits are still on this screen. Re-authenticate in the admin gate, then come back and save again.</p>
              <button data-barsh-admin-users-edit-reauth-button="true" type="button" onClick={goToAdminUsersReauthentication} style={{ ...primaryButtonStyle, color: "#ffffff" }}>
                Re-authenticate
              </button>
            </div>
          ) : null}
        </section>) : null}

        {twoFactorSetupUser ? (<section data-barsh-admin-users-2fa-setup-panel="true" style={{ ...cardStyle, border: "1px solid #bfdbfe", boxShadow: "0 12px 26px rgba(30, 58, 138, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Start 2FA Setup</h2>
              <p style={{ margin: "8px 0 0", color: "#475569", fontWeight: 800 }}>This starts pending setup only. It does not directly enforce 2FA for the sole owner account.</p>
            </div>
            <button data-barsh-admin-users-2fa-setup-cancel-button="true" type="button" onClick={closeTwoFactorSetupPanel} disabled={twoFactorSetupBusy} style={secondaryButtonStyle}>Cancel</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              2FA Phone
              <input data-barsh-admin-users-2fa-setup-phone="true" value={twoFactorSetupPhone} onChange={(event) => setTwoFactorSetupPhone(event.target.value)} style={inputStyle} placeholder="Expected format: (631) 555-1234" inputMode="tel" autoComplete="tel" />
            </label>
            <div style={{ display: "grid", alignContent: "end" }}>
              <button data-barsh-admin-users-2fa-setup-start-button="true" type="button" onClick={() => void startTwoFactorSetupFromPanel()} disabled={twoFactorSetupBusy} style={{ ...primaryButtonStyle, color: "#ffffff", opacity: twoFactorSetupBusy ? 0.7 : 1 }}>
                {twoFactorSetupBusy ? "Starting..." : "Start Setup"}
              </button>
            </div>
          </div>

          {twoFactorSetupMessage ? <p data-barsh-admin-users-2fa-setup-message="true" style={{ margin: "12px 0 0", color: twoFactorSetupMessage.toLowerCase().includes("failed") || twoFactorSetupMessage.toLowerCase().includes("expired") || twoFactorSetupNeedsReauth ? "#991b1b" : "#166534", fontWeight: 900 }}>{twoFactorSetupMessage}</p> : null}
          {twoFactorSetupNeedsReauth ? (
            <div data-barsh-admin-users-2fa-setup-reauth-panel="true" style={{ marginTop: 12, padding: 12, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12 }}>
              <p style={{ margin: "0 0 10px", color: "#991b1b", fontWeight: 900 }}>Re-authenticate in the admin gate, then return and start 2FA setup again.</p>
              <button data-barsh-admin-users-2fa-setup-reauth-button="true" type="button" onClick={goToAdminUsersReauthentication} style={{ ...primaryButtonStyle, color: "#ffffff" }}>
                Re-authenticate
              </button>
            </div>
          ) : null}
        </section>) : null}

        {twoFactorVerifyUser ? (<section data-barsh-admin-users-2fa-verify-panel="true" style={{ ...cardStyle, border: "1px solid #bbf7d0", boxShadow: "0 12px 26px rgba(22, 101, 52, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0 }}>Verify 2FA Setup</h2>
              <p style={{ margin: "8px 0 0", color: "#475569", fontWeight: 800 }}>Create a setup challenge, enter the verification code, and then mark 2FA as enforced.</p>
            </div>
            <button data-barsh-admin-users-2fa-verify-cancel-button="true" type="button" onClick={closeTwoFactorVerifyPanel} disabled={twoFactorVerifyBusy} style={secondaryButtonStyle}>Cancel</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>User<input value={twoFactorVerifyUser.email || ""} readOnly style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>Verification Code<input data-barsh-admin-users-2fa-verify-code="true" value={twoFactorVerifyCode} onChange={(event) => setTwoFactorVerifyCode(event.target.value)} style={inputStyle} inputMode="numeric" autoComplete="one-time-code" /></label>
          </div>
          {twoFactorSetupChallengeCode ? <div data-barsh-admin-users-2fa-setup-code-preview="true" style={{ marginTop: 12, padding: 14, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 12, fontFamily: "monospace", fontWeight: 950 }}>Setup verification code: {twoFactorSetupChallengeCode}</div> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button data-barsh-admin-users-2fa-create-challenge-button="true" type="button" onClick={() => void createTwoFactorSetupChallenge()} disabled={twoFactorVerifyBusy} style={{ ...secondaryButtonStyle, opacity: twoFactorVerifyBusy ? 0.7 : 1 }}>Create Setup Challenge</button>
            <button data-barsh-admin-users-2fa-verify-setup-button="true" type="button" onClick={() => void verifyTwoFactorSetupCode()} disabled={twoFactorVerifyBusy} style={{ ...primaryButtonStyle, color: "#ffffff", opacity: twoFactorVerifyBusy ? 0.7 : 1 }}>Verify Setup</button>
          </div>
          {twoFactorVerifyMessage ? <p data-barsh-admin-users-2fa-verify-message="true" style={{ margin: "12px 0 0", color: twoFactorVerifyMessage.toLowerCase().includes("failed") || twoFactorVerifyMessage.toLowerCase().includes("enter") ? "#991b1b" : "#166534", fontWeight: 900 }}>{twoFactorVerifyMessage}</p> : null}
        </section>) : null}

        <section data-barsh-admin-users-table="true" style={{ ...cardStyle, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Display Name", "User Name", "Role", "Last Sign-in", "Actions"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}</tr></thead>
            <tbody>{dbUsers.length ? dbUsers.map((user: any) => {
              const active = user.status === "active" && !user.locked && !user.inactive;
              const twoFactorSetupPending = twoFactorSetupPendingForUser(user);
              const twoFactorEnforced = twoFactorEnforcedForUser(user);
              return (
                <tr key={user.id} data-barsh-admin-users-table-row="true">
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontWeight: 900 }}>{user.displayName || user.email}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{user.username || "—"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                    <div style={{ fontWeight: 900 }}>{adminUsersPhaseV4ERoleDisplay(user)}</div>

                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{formatAdminUserDate(user.lastLoginAt)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button data-barsh-admin-users-edit-row-button="true" type="button" onClick={() => openEditAdminUserPanel(user)} disabled={adminUsersRowBusy} style={{ ...primaryButtonStyle, color: "#ffffff" }}>Edit</button>
                      <button data-barsh-admin-users-reset-password-row-button="true" type="button" onClick={() => void resetPasswordFromRow(user)} disabled={adminUsersRowBusy} style={{ ...primaryButtonStyle, color: "#ffffff" }}>Reset Password</button>
                      {twoFactorSetupPending ? <><span data-barsh-admin-users-2fa-pending-label="true" style={{ border: "1px solid #fde68a", background: "#fefce8", color: "#713f12", borderRadius: 999, padding: "10px 12px", fontSize: 13, fontWeight: 950 }}>2FA Setup Pending</span><button data-barsh-admin-users-verify-2fa-setup-row-button="true" type="button" onClick={() => openTwoFactorVerifyPanel(user)} disabled={adminUsersRowBusy} style={{ ...secondaryButtonStyle, border: "1px solid #16a34a", color: "#166534" }}>Verify Setup</button></> : twoFactorEnforced ? <span data-barsh-admin-users-2fa-enforced-label="true" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 999, padding: "10px 12px", fontSize: 13, fontWeight: 950 }}>2FA Enforced</span> : <button data-barsh-admin-users-activate-2fa-row-button="true" type="button" onClick={() => openTwoFactorSetupPanel(user)} disabled={adminUsersRowBusy} style={{ ...primaryButtonStyle, color: "#ffffff" }}>Activate 2FA</button>}
                      <button data-barsh-admin-users-lock-row-button="true" type="button" onClick={() => void lockUserFromRow(user)} disabled={adminUsersRowBusy} style={{ ...primaryButtonStyle, color: "#ffffff" }}>{active ? "Lock" : "Unlock"}</button>
                      <button data-barsh-admin-users-signout-row-button="true" type="button" onClick={() => void signOutUserFromRow(user)} disabled={adminUsersRowBusy} style={{ ...primaryButtonStyle, color: "#ffffff" }}>Sign out</button>
                    </div>
                  </td>
                </tr>
              );
            }) : <tr><td colSpan={5} style={{ padding: 10, borderBottom: "1px solid #e5e7eb", color: "#64748b" }}>No administrator users found.</td></tr>}</tbody>
          </table>
        </section>


        

        

        

        



      </div>

      {passwordResetOneTimePassword ? (
        <div
          data-barsh-admin-users-password-reset-one-time-modal="true"
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-reset-one-time-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") closePasswordResetOneTimeModal();
          }}
        >
          <div style={{ width: "min(560px, 100%)", background: "#ffffff", borderRadius: 14, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)", overflow: "hidden", border: "1px solid #cbd5e1" }}>
            <div style={{ background: "#1e3a8a", color: "#ffffff", padding: "16px 20px", textAlign: "center" }}>
              <h2 id="password-reset-one-time-title" style={{ margin: 0, fontSize: 20, fontWeight: 950 }}>Temporary Password</h2>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ margin: "0 0 12px", color: "#334155", lineHeight: 1.5, fontWeight: 800 }}>
                This temporary password is shown once. Copy it now; it is not stored or recoverable.
              </p>
              <div data-barsh-admin-users-password-reset-one-time-password="true" style={{ padding: 14, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc", fontFamily: "monospace", fontSize: 16, fontWeight: 900, overflowWrap: "anywhere" }}>
                {passwordResetOneTimePassword}
              </div>
              {passwordResetCopyMessage ? <p style={{ margin: "10px 0 0", color: "#475569", fontWeight: 800 }}>{passwordResetCopyMessage}</p> : null}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button data-barsh-admin-users-password-reset-copy-button="true" type="button" onClick={() => void copyPasswordResetOneTimePassword()} style={secondaryButtonStyle}>
                  Copy Temporary Password
                </button>
                <button data-barsh-admin-users-password-reset-one-time-done-button="true" type="button" onClick={closePasswordResetOneTimeModal} style={primaryButtonStyle}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

            <section data-barsh-admin-users-phase-v4e-role-explanation="true" style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Role Guide</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#ffffff" }}>
              <strong>Owner</strong>
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.4 }}>Everything. Full system access, all Admin cards, user/security controls, and no-lockout protection.</p>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#ffffff" }}>
              <strong>Administrator</strong>
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.4 }}>Everything outside Admin. Admin access is limited to the selected Admin-card grants shown under the role.</p>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#ffffff" }}>
              <strong>Full User</strong>
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.4 }}>Full non-admin app access, including payment functions. No Admin screen.</p>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#ffffff" }}>
              <strong>Basic User</strong>
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.4 }}>Full non-admin app access except payment, billing, and payment-status functions. No Admin screen.</p>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#ffffff" }}>
              <strong>View Only</strong>
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.4 }}>Can view non-admin screens only. No create, edit, delete, upload, finalize, payment, or Admin actions.</p>
            </div>
          </div>
        </section>

        <section data-barsh-admin-users-phase-w4-simulator-visibility="true" style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Permission Simulator Preview</h2>
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.45 }}>
                Read-only dry-run summary from the current role coverage and route classification. Permission enforcement is not active yet.
              </p>
            </div>
            <span data-barsh-admin-users-phase-w4-dry-run-badge="true" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 999, padding: "7px 10px", fontWeight: 950, fontSize: 12 }}>
              Dry run only
            </span>
          </div>

          <div data-barsh-admin-users-phase-w4-simulator-summary="true" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#475569" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Role</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Allowed</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Blocked</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Admin Blocks</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Payment Blocks</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Mutation Blocks</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { role: "Owner", allowed: 201, blocked: 0, admin: 0, payment: 0, mutation: 0 },
                  { role: "Administrator", allowed: 169, blocked: 32, admin: 32, payment: 0, mutation: 32 },
                  { role: "Full User", allowed: 134, blocked: 67, admin: 67, payment: 12, mutation: 67 },
                  { role: "Basic User", allowed: 112, blocked: 89, admin: 67, payment: 16, mutation: 89 },
                  { role: "View Only", allowed: 20, blocked: 181, admin: 67, payment: 16, mutation: 181 },
                ].map((row) => (
                  <tr key={row.role} data-barsh-admin-users-phase-w4-simulator-row="true">
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{row.role}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", color: "#166534", fontWeight: 900 }}>{row.allowed}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", color: row.blocked ? "#991b1b" : "#166534", fontWeight: 900 }}>{row.blocked}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{row.admin}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{row.payment}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{row.mutation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p data-barsh-admin-users-phase-w4-no-enforcement-note="true" style={{ margin: 0, color: "#64748b", lineHeight: 1.45, fontSize: 13 }}>
            These numbers are planning output only. They do not hide buttons, block routes, change sessions, or modify database permissions.
          </p>
        </section>

</main>
  );
}
