
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

const ADMIN_PERMISSION_KEYS = [
  "admin.home.view",
  "admin.readiness.view",
  "admin.claimIndex.view",
  "admin.claimIndex.audit",
  "admin.lawsuits.audit",
  "admin.documentReadiness.audit",
  "admin.lawsuitCleanup.view",
  "admin.lawsuitCleanup.confirm",
  "admin.ticklers.view",
  "admin.ticklers.run",
  "admin.clients.view",
  "admin.clients.edit",
  "admin.invoices.view",
  "admin.invoices.create",
  "admin.invoices.finalize",
  "admin.invoices.void",
  "admin.referenceData.view",
  "admin.referenceData.import",
  "admin.auditHistory.view",
  "admin.documentTemplates.view",
  "admin.documentTemplates.manage",
  "admin.backups.view",
  "admin.backups.run",
  "admin.backups.restorePreview",
] as const;


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
  const [createEmail, setCreateEmail] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
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
  const [overrideTargetEmail, setOverrideTargetEmail] = useState("");
  const [overridePermissionKey, setOverridePermissionKey] = useState("admin.invoices.view");
  const [overrideAction, setOverrideAction] = useState("allow");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideActorEmail, setOverrideActorEmail] = useState("dbarshay15@gmail.com");
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState("");
  const [overrideResult, setOverrideResult] = useState<any>(null);
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
  const overridePreviewReady = Boolean(
    overrideResult?.ok &&
      overrideResult?.mode === "preview" &&
      overrideResult?.wouldOverride?.email === cleanEmail(overrideTargetEmail) &&
      overrideResult?.wouldOverride?.permissionKey === overridePermissionKey &&
      overrideResult?.wouldOverride?.overrideAction === overrideAction
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
          email: createEmail,
          displayName: createDisplayName,
          status: createStatus,
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
        setCreateEmail("");
        setCreateDisplayName("");
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

  async function submitPermissionOverride(apply: boolean) {
    try {
      setOverrideBusy(true);
      setOverrideMessage(apply ? "Applying guarded permission override request..." : "Previewing guarded permission override request...");
      const response = await fetch("/api/admin/users/permission-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          apply,
          targetEmail: overrideTargetEmail,
          permissionKey: overridePermissionKey,
          overrideAction,
          reason: overrideReason,
          actorEmail: overrideActorEmail,
        }),
      });
      const json = await readAdminUsersJsonResponse(response, "Admin users request").catch(() => ({ ok: false, error: "Permission override route did not return JSON." }));
      setOverrideResult({ ...json, httpStatus: response.status });
      if (!response.ok || !json?.ok) {
        setOverrideMessage(json?.error || `Permission override request failed with HTTP ${response.status}.`);
        return;
      }
      if (apply) {
        setOverrideMessage("Admin permission override saved. Permission enforcement setting was not changed.");
        setOverrideResult(null);
        await loadAdminUsersPlanning();
      } else {
        setOverrideMessage("Preview complete. No AdminUserPermissionOverride row was saved. Review the result before Apply.");
      }
    } catch (err: any) {
      setOverrideMessage(err?.message || "Permission override request failed.");
      setOverrideResult({ ok: false, error: err?.message || "Permission override request failed." });
    } finally {
      setOverrideBusy(false);
    }
  }

  return (
    <main data-barsh-admin-users-planning-page="phase3-guarded" style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 30, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 24, padding: 22 }}>
          <p style={{ margin: "0 0 8px", color: "#64748b", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Phase 3 Guarded Write Controls</p>
          <h1 style={{ margin: 0, fontSize: 30 }}>Admin Users / Roles</h1>
          <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.5 }}>Guarded administrator user management surface. Active write controls in this phase are Create Admin User, Assign Role, Remove Role, and Permission Override. All use preview/apply mode, require an authenticated administrator session, require an active owner_admin actor, preserve lockout safety, and do not enable enforcement.</p>
        </section>

        {error ? <section data-barsh-admin-users-planning-error="true" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 18, padding: 16 }}>{error}</section> : null}

        <section data-barsh-admin-users-planning-summary="true" style={cardStyle}>
          <strong>Mode:</strong> {data?.mode || "loading"} | <strong>Enforcement Enabled:</strong> {enforcementLabel} | <strong>Planning Roles:</strong> {roles.length} | <strong>Planning Users:</strong> {users.length} | <strong>DB Roles:</strong> {data?.databasePreview?.roleCount ?? 0} | <strong>DB Users:</strong> {data?.databasePreview?.userCount ?? 0}
        </section>



        <section data-barsh-admin-users-password-reset-card="true" style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Reset Temporary Password</h2>
          <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>Phase 12K guarded route. Preview is the default. Apply hashes the temporary password immediately, sets passwordChangeRequired, resets failed login counters, and never returns or displays the password. This does not enable impersonation and does not enable permission enforcement.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Target User
              <select data-barsh-admin-users-password-reset-target-email="true" value={passwordResetTargetEmail} onChange={(event) => { setPasswordResetTargetEmail(event.target.value); setPasswordResetResult(null); }} style={inputStyle}>
                <option value="">Choose user</option>
                {dbUsers.map((user: any) => <option key={user.email} value={user.email}>{user.displayName || user.email} · {user.username || "no username"} · {user.status}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Temporary Password
              <input data-barsh-admin-users-password-reset-temporary-password="true" type="password" value={passwordResetTemporaryPassword} onChange={(event) => { setPasswordResetTemporaryPassword(event.target.value); setPasswordResetResult(null); }} style={inputStyle} placeholder="Min 10 + upper/lower/number/symbol" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Actor Email
              <input data-barsh-admin-users-password-reset-actor-email="true" value={passwordResetActorEmail} onChange={(event) => setPasswordResetActorEmail(event.target.value)} style={inputStyle} placeholder="owner_admin email" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Reason
              <input data-barsh-admin-users-password-reset-reason="true" value={passwordResetReason} onChange={(event) => { setPasswordResetReason(event.target.value); setPasswordResetResult(null); }} style={inputStyle} placeholder="Required reason" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
            <button data-barsh-admin-users-password-reset-preview-button="true" type="button" onClick={() => void submitAdminUserPasswordReset(false)} disabled={passwordResetBusy} style={{ ...secondaryButtonStyle, opacity: passwordResetBusy ? 0.7 : 1 }}>
              Preview Password Reset
            </button>
            <button data-barsh-admin-users-password-reset-apply-button="true" type="button" onClick={() => void submitAdminUserPasswordReset(true)} disabled={passwordResetBusy || !passwordResetPreviewReady} style={{ ...primaryButtonStyle, opacity: passwordResetBusy || !passwordResetPreviewReady ? 0.55 : 1, cursor: passwordResetBusy || !passwordResetPreviewReady ? "not-allowed" : "pointer" }}>
              Apply Password Reset
            </button>
            <span data-barsh-admin-users-password-reset-message="true" style={{ color: passwordResetResult?.ok ? "#166534" : "#991b1b", fontWeight: 900 }}>{passwordResetMessage}</span>
          </div>
          {passwordResetResult ? <pre data-barsh-admin-users-password-reset-result="true" style={{ marginTop: 12, whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, maxHeight: 260, overflow: "auto" }}>{JSON.stringify(passwordResetResult, null, 2)}</pre> : null}
          <p style={{ margin: "12px 0 0", color: "#991b1b", fontWeight: 900 }}>Safety: passwords are not viewable or recoverable. This route hashes the temporary password and never returns it. Login impersonation remains intentionally unavailable.</p>
        </section>

        <section data-barsh-admin-users-lockout-card="true" style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Lock / Unlock Admin User</h2>
          <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>Phase 12J guarded route. Preview is the default. Apply changes only AdminUser.status between active and inactive. It blocks locking the last active bootstrapSafe owner_admin user, does not expose passwords, does not impersonate users, and does not enable permission enforcement.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Target User
              <select data-barsh-admin-users-lockout-target-email="true" value={lockoutTargetEmail} onChange={(event) => { setLockoutTargetEmail(event.target.value); setLockoutResult(null); }} style={inputStyle}>
                <option value="">Choose user</option>
                {dbUsers.map((user: any) => <option key={user.email} value={user.email}>{user.displayName || user.email} · {user.status}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Action
              <select data-barsh-admin-users-lockout-action="true" value={lockoutAction} onChange={(event) => { setLockoutAction(event.target.value); setLockoutResult(null); }} style={inputStyle}>
                <option value="lock">Lock out user</option>
                <option value="unlock">Unlock user</option>
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Actor Email
              <input data-barsh-admin-users-lockout-actor-email="true" value={lockoutActorEmail} onChange={(event) => setLockoutActorEmail(event.target.value)} style={inputStyle} placeholder="owner_admin email" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
              Reason
              <input data-barsh-admin-users-lockout-reason="true" value={lockoutReason} onChange={(event) => { setLockoutReason(event.target.value); setLockoutResult(null); }} style={inputStyle} placeholder="Required reason" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
            <button data-barsh-admin-users-lockout-preview-button="true" type="button" onClick={() => void submitAdminUserLockout(false)} disabled={lockoutBusy} style={{ ...secondaryButtonStyle, opacity: lockoutBusy ? 0.7 : 1 }}>
              Preview Lock / Unlock
            </button>
            <button data-barsh-admin-users-lockout-apply-button="true" type="button" onClick={() => void submitAdminUserLockout(true)} disabled={lockoutBusy || !lockoutPreviewReady} style={{ ...primaryButtonStyle, opacity: lockoutBusy || !lockoutPreviewReady ? 0.55 : 1, cursor: lockoutBusy || !lockoutPreviewReady ? "not-allowed" : "pointer" }}>
              Apply Lock / Unlock
            </button>
            <span data-barsh-admin-users-lockout-message="true" style={{ color: lockoutResult?.ok ? "#166534" : "#991b1b", fontWeight: 900 }}>{lockoutMessage}</span>
          </div>
          {lockoutResult ? <pre data-barsh-admin-users-lockout-result="true" style={{ marginTop: 12, whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, maxHeight: 260, overflow: "auto" }}>{JSON.stringify(lockoutResult, null, 2)}</pre> : null}
          <p style={{ margin: "12px 0 0", color: "#991b1b", fontWeight: 900 }}>Safety: owner/bootstrap no-lockout protection remains active. Password viewing and login impersonation are intentionally not available.</p>
        </section>

        <section data-barsh-admin-users-enforcement-banner="disabled" style={{ background: "#fefce8", border: "1px solid #fde68a", color: "#713f12", borderRadius: 18, padding: 16, lineHeight: 1.5 }}>
          <strong>Enforcement Disabled:</strong> persisted users, roles, role permissions, and effective permissions are still displayed for review only. They are not used to block pages or API functions in this phase.
        </section>

        <section data-barsh-admin-users-audit-visibility="read-only" style={{ ...cardStyle, border: "1px solid #dbeafe", background: "#eff6ff" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Admin Users Audit Visibility</h2>
          <p style={{ margin: "0 0 12px", color: "#1e3a8a", lineHeight: 1.5 }}>
            Read-only audit review for admin-user create, role assignment, role removal, and permission-override activity. Apply actions are audit logged, and permission enforcement remains disabled.
          </p>
          <a href="/admin/audit-history" data-barsh-admin-users-audit-history-link="true" style={{ ...secondaryButtonStyle, display: "inline-flex", textDecoration: "none" }}>
            Open Audit History
          </a>
        </section>

        <section data-barsh-admin-users-create-user-control="phase3-guarded" style={{ ...cardStyle, border: "1px solid #bfdbfe", boxShadow: "0 12px 26px rgba(30, 58, 138, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Create Admin User</h2>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>Phase 3 guarded route. Preview is the default. Apply creates only an AdminUser row; it does not assign roles, create permission overrides, enable enforcement, write Clio, send email, generate documents, or change the print queue.</p>
            </div>
            <span data-barsh-admin-users-create-user-enforcement-disabled="true" style={{ border: "1px solid #fde68a", background: "#fefce8", color: "#713f12", borderRadius: 999, padding: "7px 10px", fontWeight: 950, fontSize: 12 }}>Enforcement Disabled</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Email
              <input data-barsh-admin-users-create-email="true" value={createEmail} onChange={(event) => { setCreateEmail(event.target.value); setCreateResult(null); }} style={inputStyle} placeholder="new-admin@example.com" />
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Display Name
              <input data-barsh-admin-users-create-display-name="true" value={createDisplayName} onChange={(event) => setCreateDisplayName(event.target.value)} style={inputStyle} placeholder="New Admin User" />
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Status
              <select data-barsh-admin-users-create-status="true" value={createStatus} onChange={(event) => setCreateStatus(event.target.value)} style={inputStyle}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
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
            <button data-barsh-admin-users-create-preview-button="true" type="button" onClick={() => void submitCreateAdminUser(false)} disabled={createBusy} style={{ ...secondaryButtonStyle, opacity: createBusy ? 0.7 : 1 }}>
              {createBusy ? "Working..." : "Preview Create Admin User"}
            </button>
            <button data-barsh-admin-users-create-apply-button="true" type="button" onClick={() => void submitCreateAdminUser(true)} disabled={createBusy || !previewReady} style={{ ...primaryButtonStyle, opacity: createBusy || !previewReady ? 0.55 : 1, cursor: createBusy || !previewReady ? "not-allowed" : "pointer" }}>
              Apply Create Admin User
            </button>
          </div>

          <div data-barsh-admin-users-create-result="true" style={{ marginTop: 14, background: createResult?.ok ? "#f0fdf4" : createResult ? "#fef2f2" : "#f8fafc", border: `1px solid ${createResult?.ok ? "#bbf7d0" : createResult ? "#fecaca" : "#e2e8f0"}`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 950, color: createResult?.ok ? "#166534" : createResult ? "#991b1b" : "#475569" }}>{createMessage || "Preview the request before applying. Apply remains disabled until a matching preview succeeds."}</div>
            {createResult ? <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontSize: 12, fontFamily: "monospace" }}>{JSON.stringify(createResult, null, 2)}</pre> : null}
          </div>
        </section>

        <section data-barsh-admin-users-assign-role-control="phase3-guarded" style={{ ...cardStyle, border: "1px solid #bbf7d0", boxShadow: "0 12px 26px rgba(22, 101, 52, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Assign Admin Role</h2>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>Phase 3 guarded route. Preview is the default. Apply creates only an AdminUserRole join row; it requires an active target user, an active role, an active owner_admin actor, duplicate-assignment prevention, and active bootstrapSafe owner_admin preservation. It does not create users, create roles, create permission overrides, enable enforcement, write Clio, send email, generate documents, or change the print queue.</p>
            </div>
            <span data-barsh-admin-users-assign-role-enforcement-disabled="true" style={{ border: "1px solid #fde68a", background: "#fefce8", color: "#713f12", borderRadius: 999, padding: "7px 10px", fontWeight: 950, fontSize: 12 }}>Enforcement Disabled</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Target Active Admin User
              <select data-barsh-admin-users-assign-target-email="true" value={assignTargetEmail} onChange={(event) => { setAssignTargetEmail(event.target.value); setAssignResult(null); }} style={inputStyle}>
                <option value="">Choose active user...</option>
                {activeDbUsers.map((user: any) => <option key={user.email} value={user.email}>{user.email}{user.displayName ? ` — ${user.displayName}` : ""}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Active Role
              <select data-barsh-admin-users-assign-role-key="true" value={assignRoleKey} onChange={(event) => { setAssignRoleKey(event.target.value); setAssignResult(null); }} style={inputStyle}>
                <option value="">Choose active role...</option>
                {activeDbRoles.map((role: any) => <option key={role.key} value={role.key}>{role.key} — {role.label}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Owner Admin Actor Email
              <input data-barsh-admin-users-assign-actor-email="true" value={assignActorEmail} onChange={(event) => setAssignActorEmail(event.target.value)} style={inputStyle} placeholder="owner_admin email" />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button data-barsh-admin-users-assign-preview-button="true" type="button" onClick={() => void submitAssignAdminRole(false)} disabled={assignBusy} style={{ ...secondaryButtonStyle, opacity: assignBusy ? 0.7 : 1 }}>
              {assignBusy ? "Working..." : "Preview Assign Role"}
            </button>
            <button data-barsh-admin-users-assign-apply-button="true" type="button" onClick={() => void submitAssignAdminRole(true)} disabled={assignBusy || !assignPreviewReady} style={{ ...primaryButtonStyle, opacity: assignBusy || !assignPreviewReady ? 0.55 : 1, cursor: assignBusy || !assignPreviewReady ? "not-allowed" : "pointer" }}>
              Apply Assign Role
            </button>
          </div>

          <div data-barsh-admin-users-assign-result="true" style={{ marginTop: 14, background: assignResult?.ok ? "#f0fdf4" : assignResult ? "#fef2f2" : "#f8fafc", border: `1px solid ${assignResult?.ok ? "#bbf7d0" : assignResult ? "#fecaca" : "#e2e8f0"}`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 950, color: assignResult?.ok ? "#166534" : assignResult ? "#991b1b" : "#475569" }}>{assignMessage || "Preview the role assignment before applying. Apply remains disabled until a matching preview succeeds."}</div>
            {assignResult ? <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontSize: 12, fontFamily: "monospace" }}>{JSON.stringify(assignResult, null, 2)}</pre> : null}
          </div>
        </section>

        <section data-barsh-admin-users-remove-role-control="phase3-guarded" style={{ ...cardStyle, border: "1px solid #fecaca", boxShadow: "0 12px 26px rgba(153, 27, 27, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Remove Admin Role</h2>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>Phase 3 guarded route. Preview is the default. Apply deletes only an AdminUserRole join row; it blocks missing assignments and blocks removing owner_admin from the last active bootstrapSafe owner_admin user. It does not delete users, delete roles, create permission overrides, enable enforcement, write Clio, send email, generate documents, or change the print queue.</p>
            </div>
            <span data-barsh-admin-users-remove-role-enforcement-disabled="true" style={{ border: "1px solid #fde68a", background: "#fefce8", color: "#713f12", borderRadius: 999, padding: "7px 10px", fontWeight: 950, fontSize: 12 }}>Enforcement Disabled</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Target Admin User With Roles
              <select data-barsh-admin-users-remove-target-email="true" value={removeTargetEmail} onChange={(event) => { setRemoveTargetEmail(event.target.value); setRemoveRoleKey(""); setRemoveResult(null); }} style={inputStyle}>
                <option value="">Choose user...</option>
                {dbUsers.filter((user: any) => (user.roleKeys || []).length > 0).map((user: any) => <option key={user.email} value={user.email}>{user.email}{user.displayName ? ` — ${user.displayName}` : ""}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Assigned Role To Remove
              <select data-barsh-admin-users-remove-role-key="true" value={removeRoleKey} onChange={(event) => { setRemoveRoleKey(event.target.value); setRemoveResult(null); }} style={inputStyle}>
                <option value="">Choose assigned role...</option>
                {selectedRemoveUserRoleKeys.map((roleKey: string) => {
                  const role = dbRoles.find((entry: any) => entry.key === roleKey);
                  return <option key={roleKey} value={roleKey}>{roleKey}{role?.label ? ` — ${role.label}` : ""}</option>;
                })}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Owner Admin Actor Email
              <input data-barsh-admin-users-remove-actor-email="true" value={removeActorEmail} onChange={(event) => setRemoveActorEmail(event.target.value)} style={inputStyle} placeholder="owner_admin email" />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button data-barsh-admin-users-remove-preview-button="true" type="button" onClick={() => void submitRemoveAdminRole(false)} disabled={removeBusy} style={{ ...secondaryButtonStyle, opacity: removeBusy ? 0.7 : 1 }}>
              {removeBusy ? "Working..." : "Preview Remove Role"}
            </button>
            <button data-barsh-admin-users-remove-apply-button="true" type="button" onClick={() => void submitRemoveAdminRole(true)} disabled={removeBusy || !removePreviewReady} style={{ ...primaryButtonStyle, background: "#991b1b", border: "1px solid #991b1b", opacity: removeBusy || !removePreviewReady ? 0.55 : 1, cursor: removeBusy || !removePreviewReady ? "not-allowed" : "pointer" }}>
              Apply Remove Role
            </button>
          </div>

          <div data-barsh-admin-users-remove-result="true" style={{ marginTop: 14, background: removeResult?.ok ? "#f0fdf4" : removeResult ? "#fef2f2" : "#f8fafc", border: `1px solid ${removeResult?.ok ? "#bbf7d0" : removeResult ? "#fecaca" : "#e2e8f0"}`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 950, color: removeResult?.ok ? "#166534" : removeResult ? "#991b1b" : "#475569" }}>{removeMessage || "Preview the role removal before applying. Apply remains disabled until a matching preview succeeds."}</div>
            {removeResult ? <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontSize: 12, fontFamily: "monospace" }}>{JSON.stringify(removeResult, null, 2)}</pre> : null}
          </div>
        </section>

        <section data-barsh-admin-users-permission-override-control="phase3-guarded" style={{ ...cardStyle, border: "1px solid #ddd6fe", boxShadow: "0 12px 26px rgba(91, 33, 182, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Permission Override</h2>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>Phase 3 guarded route. Preview is the default. Apply creates or updates only one AdminUserPermissionOverride row; it requires an explicit reason and blocks any block override mapped to administrator lockout safety routes. It does not change roles, enable enforcement, write Clio, send email, generate documents, or change the print queue.</p>
            </div>
            <span data-barsh-admin-users-permission-override-enforcement-disabled="true" style={{ border: "1px solid #fde68a", background: "#fefce8", color: "#713f12", borderRadius: 999, padding: "7px 10px", fontWeight: 950, fontSize: 12 }}>Enforcement Disabled</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Target Admin User
              <select data-barsh-admin-users-override-target-email="true" value={overrideTargetEmail} onChange={(event) => { setOverrideTargetEmail(event.target.value); setOverrideResult(null); }} style={inputStyle}>
                <option value="">Choose user...</option>
                {dbUsers.map((user: any) => <option key={user.email} value={user.email}>{user.email}{user.displayName ? ` — ${user.displayName}` : ""}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Permission Key
              <select data-barsh-admin-users-override-permission-key="true" value={overridePermissionKey} onChange={(event) => { setOverridePermissionKey(event.target.value); setOverrideResult(null); }} style={inputStyle}>
                {ADMIN_PERMISSION_KEYS.map((permissionKey) => <option key={permissionKey} value={permissionKey}>{permissionKey}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Action
              <select data-barsh-admin-users-override-action="true" value={overrideAction} onChange={(event) => { setOverrideAction(event.target.value); setOverrideResult(null); }} style={inputStyle}>
                <option value="allow">allow</option>
                <option value="block">block</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Owner Admin Actor Email
              <input data-barsh-admin-users-override-actor-email="true" value={overrideActorEmail} onChange={(event) => setOverrideActorEmail(event.target.value)} style={inputStyle} placeholder="owner_admin email" />
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 850, gridColumn: "span 2" }}>
              Explicit Reason
              <input data-barsh-admin-users-override-reason="true" value={overrideReason} onChange={(event) => { setOverrideReason(event.target.value); setOverrideResult(null); }} style={inputStyle} placeholder="Required reason for allow/block override" />
            </label>
          </div>

          <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 14, padding: 12, lineHeight: 1.45 }}>
            <strong>Lockout protection:</strong> Block overrides are rejected if the permission maps to never-block safety routes, including /admin, /admin/permissions, /api/admin/permissions, and /api/admin/permissions/check.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button data-barsh-admin-users-override-preview-button="true" type="button" onClick={() => void submitPermissionOverride(false)} disabled={overrideBusy} style={{ ...secondaryButtonStyle, opacity: overrideBusy ? 0.7 : 1 }}>
              {overrideBusy ? "Working..." : "Preview Permission Override"}
            </button>
            <button data-barsh-admin-users-override-apply-button="true" type="button" onClick={() => void submitPermissionOverride(true)} disabled={overrideBusy || !overridePreviewReady} style={{ ...primaryButtonStyle, opacity: overrideBusy || !overridePreviewReady ? 0.55 : 1, cursor: overrideBusy || !overridePreviewReady ? "not-allowed" : "pointer" }}>
              Apply Permission Override
            </button>
          </div>

          <div data-barsh-admin-users-override-result="true" style={{ marginTop: 14, background: overrideResult?.ok ? "#f0fdf4" : overrideResult ? "#fef2f2" : "#f8fafc", border: `1px solid ${overrideResult?.ok ? "#bbf7d0" : overrideResult ? "#fecaca" : "#e2e8f0"}`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 950, color: overrideResult?.ok ? "#166534" : overrideResult ? "#991b1b" : "#475569" }}>{overrideMessage || "Preview the permission override before applying. Apply remains disabled until a matching preview succeeds."}</div>
            {overrideResult ? <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontSize: 12, fontFamily: "monospace" }}>{JSON.stringify(overrideResult, null, 2)}</pre> : null}
          </div>
        </section>

        <section data-barsh-admin-users-db-preview="read-only" style={{ ...cardStyle, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Database-Backed Preview</h2>
          <p style={{ color: "#475569" }}>Preview of persisted admin users and roles. These records are not used for enforcement yet.</p>
          <h3>DB Users</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Name", "Email", "Status", "Bootstrap Safe", "Roles", "Overrides"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}</tr></thead>
            <tbody>{dbUsers.length ? dbUsers.map((user: any) => <tr key={user.id}><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontWeight: 900 }}>{user.displayName || ""}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{user.email}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.status === "active" ? "Active" : "Locked / Inactive"}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.bootstrapSafe ? "Yes" : "No"}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(user.roleKeys || []).join(", ") || "None"}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.effectivePermissionCount ?? 0}</td></tr>) : <tr><td colSpan={6} style={{ padding: 10, borderBottom: "1px solid #e5e7eb", color: "#64748b" }}>No persisted admin users yet.</td></tr>}</tbody>
          </table>
          <h3>DB Roles</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Key", "Label", "Status", "System Role", "Permission Count"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}</tr></thead>
            <tbody>{dbRoles.length ? dbRoles.map((role: any) => <tr key={role.id}><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace", fontWeight: 900 }}>{role.key}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.label}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.status}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.systemRole ? "Yes" : "No"}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.permissionCount ?? (role.permissionKeys || []).length}</td></tr>) : <tr><td colSpan={5} style={{ padding: 10, borderBottom: "1px solid #e5e7eb", color: "#64748b" }}>No persisted admin roles yet.</td></tr>}</tbody>
          </table>
        </section>

        <section data-barsh-admin-users-effective-permissions="read-only" style={{ ...cardStyle, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Effective Permissions Preview</h2>
          <p style={{ color: "#475569" }}>Read-only effective permission calculation from persisted DB roles and overrides. Enforcement remains disabled.</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["User", "Roles", "Effective Permission Count", "Effective Permissions"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}</tr></thead>
            <tbody>{dbUsers.length ? dbUsers.map((user: any) => <tr key={user.id}><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace", fontWeight: 900 }}>{user.email}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(user.roleKeys || []).join(", ") || "None"}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.effectivePermissionCount ?? 0}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{(user.effectivePermissionKeys || []).join(", ")}</td></tr>) : <tr><td colSpan={4} style={{ padding: 10, borderBottom: "1px solid #e5e7eb", color: "#64748b" }}>No persisted admin users yet.</td></tr>}</tbody>
          </table>
        </section>

        <section data-barsh-admin-users-write-controls-preview="phase3-mixed" style={{ ...cardStyle, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Write Controls Roadmap</h2>
          <p style={{ color: "#475569", lineHeight: 1.5 }}>Create Admin User, Assign Role, Remove Role, and Permission Override are active in guarded preview/apply mode. Enforcement remains unavailable and separate.</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Action", "Guardrail", "Status"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ["Create Admin User", "Requires active admin session, active owner_admin actor, duplicate-email check, active/inactive status validation, preview/apply, and audit logging on apply.", "Active guarded route"],
                ["Assign Role", "Requires active admin session, active owner_admin actor, active target user, active role, duplicate-assignment prevention, preview/apply, bootstrap owner preservation, and audit logging on apply.", "Active guarded route"],
                ["Remove Role", "Requires active admin session, active owner_admin actor, existing assignment, preview/apply, audit logging on apply, and last active bootstrapSafe owner_admin protection.", "Active guarded route"],
                ["Permission Override", "Requires active admin session, active owner_admin actor, known permission key, allow/block action, explicit reason, preview/apply, audit logging on apply, and never-block safety route protection.", "Active guarded route"],
                ["Enable Enforcement", "Separate phase only after persisted permissions are verified and lockout simulations pass.", "Not available"],
              ].map((row) => <tr key={row[0]}><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontWeight: 900 }}>{row[0]}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{row[1]}</td><td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", color: row[2].startsWith("Active") ? "#166534" : "#92400e", fontWeight: 900 }}>{row[2]}</td></tr>)}
            </tbody>
          </table>
        </section>

        <section data-barsh-admin-users-planning-users="true" style={{ ...cardStyle, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Planned Users</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Name", "Email", "Roles", "Explicit Allow", "Explicit Block", "Effective Permissions", "Source"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((user: any) => (
                <tr key={user.email}>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontWeight: 900 }}>{user.displayName}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{user.email}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(user.plannedRoles || []).join(", ")}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(user.explicitAllow || []).join(", ") || "None"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{(user.explicitBlock || []).join(", ") || "None"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.effectivePermissionCount}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{user.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "#475569" }}>Effective permissions are calculated for review only. They are not enforced and are not persisted.</p>
        </section>

        <section data-barsh-admin-users-planning-roles="true" style={{ ...cardStyle, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Planned Roles</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Role", "Description", "Write Capable", "Permission Count", "Permissions"].map((header) => <th key={header} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #cbd5e1" }}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {roles.map((role: any) => (
                <tr key={role.key}>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace", fontWeight: 900 }}>{role.label}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.description}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.writeCapable ? "Yes" : "No"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{role.permissionCount}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{(role.permissions || []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
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
