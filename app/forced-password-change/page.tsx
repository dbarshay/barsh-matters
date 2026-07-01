"use client";

import { useState } from "react";

const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8 } as const;
const primaryButtonStyle = { background: "#00346e", color: "#ffffff", border: "1px solid #00346e", borderRadius: 8, padding: "10px 14px", fontWeight: 900, cursor: "pointer" } as const;

export default function ForcedPasswordChangePage() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/auth/forced-password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword, newPassword, confirmPassword }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) {
        setStatus(json?.passwordPolicyErrors?.join(" ") || json?.error || "Password change failed.");
        return;
      }
      setStatus("Password changed. Continue to Admin.");
      window.location.href = json?.redirectTo || "/admin";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <section data-barsh-forced-password-change-page="true" style={{ width: "min(520px, 100%)", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, overflow: "hidden", boxShadow: "0 18px 44px rgba(15, 23, 42, 0.14)" }}>
        <div style={{ background: "#00346e", color: "#ffffff", padding: "16px 20px", textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 950 }}>Change Password Required</h1>
        </div>
        <div style={{ padding: 22, display: "grid", gap: 12 }}>
          <p style={{ margin: 0, color: "#385a83", fontWeight: 800 }}>Enter the temporary password you were given, then choose a new password.</p>
          <input data-barsh-forced-password-change-email="true" style={inputStyle} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="username" />
          <input data-barsh-forced-password-change-current-password="true" style={inputStyle} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Temporary password" type="password" autoComplete="current-password" />
          <input data-barsh-forced-password-change-new-password="true" style={inputStyle} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" type="password" autoComplete="new-password" />
          <input data-barsh-forced-password-change-confirm-password="true" style={inputStyle} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" type="password" autoComplete="new-password" />
          <button data-barsh-forced-password-change-submit="true" type="button" disabled={busy} onClick={() => void submit()} style={primaryButtonStyle}>{busy ? "Saving..." : "Change Password"}</button>
          {status ? <p data-barsh-forced-password-change-status="true" style={{ margin: 0, color: "#385a83", fontWeight: 800 }}>{status}</p> : null}
        </div>
      </section>
    </main>
  );
}
