"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitChangePassword(event: React.FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      setMessage("Changing password...");
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const json = await response.json().catch(() => ({ ok: false, error: "Password change route did not return JSON." }));
      if (!response.ok || !json?.ok) {
        setMessage(json?.error || `Password change failed with HTTP ${response.status}.`);
        return;
      }
      setMessage("Password changed. Redirecting to Admin...");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.replace("/admin");
    } catch (err: any) {
      setMessage(err?.message || "Password change failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main data-barsh-change-password-page="true" style={{ minHeight: "100vh", background: "#f8fafc", padding: 32 }}>
      <section style={{ maxWidth: 560, margin: "40px auto", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>Change Password</h1>
        <p style={{ color: "#475569", lineHeight: 1.5 }}>Your account requires a password change before continuing. Passwords are hashed immediately and are not viewable or recoverable.</p>
        <form onSubmit={submitChangePassword} style={{ display: "grid", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 900 }}>
            Current / Temporary Password
            <input data-barsh-change-password-current="true" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 900 }}>
            New Password
            <input data-barsh-change-password-new="true" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} style={inputStyle} placeholder="Min 10 + upper/lower/number/symbol" />
          </label>
          <label style={{ fontSize: 13, fontWeight: 900 }}>
            Confirm New Password
            <input data-barsh-change-password-confirm="true" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} style={inputStyle} />
          </label>
          <button data-barsh-change-password-submit="true" type="submit" disabled={busy} style={{ ...primaryButtonStyle, opacity: busy ? 0.7 : 1 }}>
            Change Password
          </button>
        </form>
        {message ? <p data-barsh-change-password-message="true" style={{ marginTop: 14, fontWeight: 900, color: message.includes("failed") || message.includes("incorrect") ? "#991b1b" : "#166534" }}>{message}</p> : null}
        <p style={{ marginTop: 18, color: "#991b1b", fontWeight: 900 }}>Safety: no password viewing, no password recovery, and no login impersonation are available.</p>
      </section>
    </main>
  );
}
