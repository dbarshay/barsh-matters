
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
  const [editMessage, setEditMessage] = useState("");
  const [editBusy, setEditBusy] = useState(false);


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

  function twoFactorEnforcedForUser(user: any): boolean {
    return user?.twoFactorDisabled !== true && Boolean(user?.twoFactorPhone || user?.twoFactorPhoneMasked || user?.twoFactorRequired);
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
  }

  useEffect(() => {
    const handleAdminUsersPopState = () => {
      closeAdminUsersTransientActionState();
    };
    window.addEventListener("popstate", handleAdminUsersPopState);
    return () => window.removeEventListener("popstate", handleAdminUsersPopState);
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
    setAdminUsersRowMessage("");
  }

  function closeEditAdminUserPanel(): void {
    setEditUser(null);
    setEditMessage("");
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
        actorEmail: createActorEmail,
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
      }, "Edit admin user");

      const assignedRole = editRoleToAssign.trim();
      const removedRole = editRoleToRemove.trim();

      if (assignedRole) {
        await postAdminUsersAction("/api/admin/users/assign-role", { apply: true, targetEmail: editEmail, roleKey: assignedRole, actorEmail: createActorEmail }, "Assign role from edit");
      }

      if (removedRole) {
        await postAdminUsersAction("/api/admin/users/remove-role", { apply: true, targetEmail: editEmail, roleKey: removedRole, actorEmail: createActorEmail }, "Remove role from edit");
      }

      setAdminUsersRowMessage(`Saved ${editEmail}${assignedRole ? `; assigned ${assignedRole}` : ""}${removedRole ? `; removed ${removedRole}` : ""}.`);
      closeEditAdminUserPanel();
      await loadAdminUsersPlanning();
    } catch (error: any) {
      setEditMessage(error?.message || "Edit failed.");
      setAdminUsersRowMessage(error?.message || "Edit failed.");
    } finally {
      setEditBusy(false);
    }
  }


  async function resetPasswordFromRow(user: any): Promise<void> {
    const reason = window.prompt(`Reason for resetting password for ${user.email}`, "Administrator password reset");
    if (!reason) return;
    try {
      setAdminUsersRowBusy(true);
      const json = await postAdminUsersAction("/api/admin/users/password-reset", { apply: true, targetEmail: user.email, reason, actorEmail: createActorEmail }, "Password reset");
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

  async function activateTwoFactorFromRow(user: any): Promise<void> {
    if (twoFactorEnforcedForUser(user)) return;
    const phone = window.prompt(`2FA phone for ${user.email}`, String(user?.twoFactorPhone || ""));
    if (!phone) return;
    try {
      setAdminUsersRowBusy(true);
      await patchAdminUsersAction("/api/admin/users/signer-profile", {
        apply: true,
        actorEmail: createActorEmail,
        userId: user.id,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        displayName: user.displayName || "",
        username: user.username || "",
        email: user.email,
        phoneExtension: user.phoneExtension || "",
        faxNumber: user.faxNumber || "",
        signatureBlockName: user.signatureBlockName || "",
        locked: Boolean(user.locked),
        inactive: Boolean(user.inactive),
        twoFactorPhone: phone,
        twoFactorDisabled: false,
        twoFactorPendingSetup: false,
      }, "Activate 2FA");
      setAdminUsersRowMessage(`2FA enforced for ${user.email}.`);
      await loadAdminUsersPlanning();
    } catch (error: any) {
      setAdminUsersRowMessage(error?.message || "2FA activation failed.");
    } finally {
      setAdminUsersRowBusy(false);
    }
  }

  async function lockUserFromRow(user: any): Promise<void> {
    const lockoutAction = user.status === "active" && !user.locked && !user.inactive ? "lock" : "unlock";
    const reason = window.prompt(`Reason to ${lockoutAction} ${user.email}`, `Administrator ${lockoutAction} action`);
    if (!reason) return;
    try {
      setAdminUsersRowBusy(true);
      await postAdminUsersAction("/api/admin/users/lockout", { apply: true, targetEmail: user.email, lockoutAction, reason, actorEmail: createActorEmail }, "Lock user");
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
      await postAdminUsersAction("/api/admin/users/assign-role", { apply: true, targetEmail: user.email, roleKey, actorEmail: createActorEmail }, "Assign role");
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
      await postAdminUsersAction("/api/admin/users/remove-role", { apply: true, targetEmail: user.email, roleKey, actorEmail: createActorEmail }, "Remove role");
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
          actorEmail: createActorEmail,
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



  return (
    <main data-barsh-admin-users-planning-page="phase3-guarded" data-barsh-admin-users-browser-back-action-history="true" style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 30, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 24, padding: 22 }}>
          <h1 style={{ margin: 0, fontSize: 30 }}>Users & Roles</h1>
        </section>

        {error ? <section data-barsh-admin-users-planning-error="true" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 18, padding: 16 }}>{error}</section> : null}

                        <section data-barsh-admin-users-planning-summary="true" style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div><strong>Users:</strong> {data?.databasePreview?.userCount ?? 0} | <strong>Roles:</strong> {data?.databasePreview?.roleCount ?? 0} | <strong>Enforcement Enabled:</strong> {enforcementLabel}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <a href="/admin/audit-history" data-barsh-admin-users-audit-history-top-link="true" style={{ ...primaryButtonStyle, display: "inline-flex", textDecoration: "none", color: "#ffffff" }}>Open Audit History</a>
            <button data-barsh-admin-users-create-top-button="true" type="button" onClick={openCreateUserAction} style={primaryButtonStyle}>Create User</button>
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
              <input data-barsh-admin-users-create-two-factor-phone="true" value={createTwoFactorPhone} onChange={(event) => { setCreateTwoFactorPhone(event.target.value); setCreateResult(null); }} style={inputStyle} placeholder="Mobile number for 2FA" />
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
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>Role to Assign<input data-barsh-admin-users-edit-role-assign="true" value={editRoleToAssign} onChange={(event) => setEditRoleToAssign(event.target.value)} style={inputStyle} placeholder="Optional role key" /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>Role to Remove<input data-barsh-admin-users-edit-role-remove="true" value={editRoleToRemove} onChange={(event) => setEditRoleToRemove(event.target.value)} style={inputStyle} placeholder={`Current: ${roleLabelForUser(editUser)}`} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 850 }}><input data-barsh-admin-users-edit-locked="true" type="checkbox" checked={editLocked} onChange={(event) => setEditLocked(event.target.checked)} />Locked</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 850 }}><input data-barsh-admin-users-edit-inactive="true" type="checkbox" checked={editInactive} onChange={(event) => setEditInactive(event.target.checked)} />Inactive</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 850 }}><input data-barsh-admin-users-edit-two-factor-disabled="true" type="checkbox" checked={editTwoFactorDisabled} onChange={(event) => setEditTwoFactorDisabled(event.target.checked)} />2FA Disabled</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 850 }}><input data-barsh-admin-users-edit-two-factor-pending-setup="true" type="checkbox" checked={editTwoFactorPendingSetup} onChange={(event) => setEditTwoFactorPendingSetup(event.target.checked)} />2FA Pending Setup</label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            <button data-barsh-admin-users-edit-save-button="true" type="button" onClick={() => void saveEditAdminUserPanel()} disabled={editBusy} style={{ ...primaryButtonStyle, opacity: editBusy ? 0.7 : 1 }}>{editBusy ? "Saving..." : "Save User"}</button>
          </div>

          {editMessage ? <p data-barsh-admin-users-edit-message="true" style={{ margin: "12px 0 0", color: editMessage.toLowerCase().includes("failed") || editMessage.toLowerCase().includes("unauthorized") ? "#991b1b" : "#166534", fontWeight: 900 }}>{editMessage}</p> : null}
        </section>) : null}

        <section data-barsh-admin-users-table="true" style={{ ...cardStyle, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Display Name", "User Name", "Role", "Last Sign-in", "Actions"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}</tr></thead>
            <tbody>{dbUsers.length ? dbUsers.map((user: any) => {
              const active = user.status === "active" && !user.locked && !user.inactive;
              const twoFactorEnforced = twoFactorEnforcedForUser(user);
              return (
                <tr key={user.id} data-barsh-admin-users-table-row="true">
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontWeight: 900 }}>{user.displayName || user.email}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{user.username || "—"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                    <div style={{ fontWeight: 900 }}>{roleLabelForUser(user)}</div>

                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{formatAdminUserDate(user.lastLoginAt)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button data-barsh-admin-users-edit-row-button="true" type="button" onClick={() => openEditAdminUserPanel(user)} disabled={adminUsersRowBusy} style={{ ...primaryButtonStyle, color: "#ffffff" }}>Edit</button>
                      <button data-barsh-admin-users-reset-password-row-button="true" type="button" onClick={() => void resetPasswordFromRow(user)} disabled={adminUsersRowBusy} style={{ ...primaryButtonStyle, color: "#ffffff" }}>Reset Password</button>
                      {twoFactorEnforced ? <span data-barsh-admin-users-2fa-enforced-label="true" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 999, padding: "10px 12px", fontSize: 13, fontWeight: 950 }}>2FA Enforced</span> : <button data-barsh-admin-users-activate-2fa-row-button="true" type="button" onClick={() => void activateTwoFactorFromRow(user)} disabled={adminUsersRowBusy} style={{ ...primaryButtonStyle, color: "#ffffff" }}>Activate 2FA</button>}
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

    </main>
  );
}
