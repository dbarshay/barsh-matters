/*
ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21 login page anchors:
- Login UI should route to 2FA challenge/verification UX when login response requires 2FA.
- 2FA code must not be persisted outside transient client state.
*/
/*
ADMIN_USER_PASSWORD_AUTH_RUNTIME_PHASE19 Combined Phase 19 login page anchors:
- If login apply response includes forcePasswordChange/passwordChangeRequired, route user to /forced-password-change.
- Preserve existing login behavior unless those flags are present.
*/
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- Existing login page has legacy response/error shapes and unused logout styling; Combined Phase 19 preserves behavior while adding password-change anchors. */
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const ADMIN_USERS_QA_PHASE2_FORCED_PASSWORD_CHANGE_ROUTE = "/forced-password-change";
const ADMIN_USERS_QA_PHASE2_TWO_FACTOR_CHALLENGE_ROUTE = "/api/auth/2fa/challenge";
const ADMIN_USERS_QA_PHASE2_TWO_FACTOR_VERIFY_ROUTE = "/api/auth/2fa/verify";

function adminUsersQaPhase2LoginNeedsForcedPasswordChange(json: any): boolean {
  return Boolean(
    json?.forcePasswordChange ||
      json?.passwordChangeRequired ||
      json?.forcedPasswordChangeRedirectTo ||
      json?.user?.forcePasswordChange ||
      json?.user?.passwordChangeRequired,
  );
}

function adminUsersQaPhase2LoginNeedsTwoFactor(json: any): boolean {
  return Boolean(json?.twoFactorRequired || json?.twoFactorChallengeRoute || json?.twoFactorPending || json?.user?.twoFactorRequired);
}

function adminUsersQaPhase2LoginEmail(json: any): string {
  return String(json?.email || json?.user?.email || json?.identity?.email || "");
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safeReturnToFromSearch(): string {
  if (typeof window === "undefined") return "/admin";

  const params = new URLSearchParams(window.location.search);
  const candidate = clean(params.get("from")) || "/admin";

  return candidate.startsWith("/admin") ? candidate : "/admin";
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #e0f2fe 0%, #f8fafc 52%, #eef2ff 100%)",
  padding: 24,
  color: "#00346e",
};

const cardStyle: React.CSSProperties = {
  width: "min(460px, 100%)",
  background: "#ffffff",
  border: "1px solid #dbeafe",
  borderRadius: 24,
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.18)",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  background: "#00346e",
  color: "#ffffff",
  padding: "22px 24px",
  textAlign: "center",
};

const bodyStyle: React.CSSProperties = {
  padding: 24,
  display: "grid",
  gap: 16,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 13,
  fontWeight: 900,
  color: "#385a83",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  color: "#00346e",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #00346e",
  borderRadius: 999,
  background: "#00346e",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 15,
  padding: "12px 16px",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#ffffff",
  color: "#385a83",
  fontWeight: 900,
  fontSize: 14,
  padding: "10px 14px",
  textDecoration: "none",
  textAlign: "center",
};

const statusStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: 12,
  fontSize: 13,
  fontWeight: 800,
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [alreadyAuthenticated, setAlreadyAuthenticated] = useState(false);
  const returnTo = useMemo(() => safeReturnToFromSearch(), []);

  // Second-factor (SMS) step. When active, the password step succeeded and a code was sent.
  const [twoFactor, setTwoFactor] = useState<{ active: boolean; email: string; maskedPhone: string; returnTo: string; info: string } | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!cancelled && response.ok && json?.authenticated) {
          setAlreadyAuthenticated(true);
          setStatus("You are already signed in as Administrator.");
        }
      } catch {
        // Session check failure should not block manual login.
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const trimmedUsername = clean(username);
    const trimmedPassword = clean(password);
    if (!trimmedPassword) {
      setStatus(trimmedUsername ? "Enter your password." : "Enter the password or your owner password.");
      return;
    }

    try {
      setBusy(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername || undefined, password: trimmedPassword, action: "Login", returnTo }),
      });
      const json = await response.json().catch(() => null);

      // 2FA required: password was accepted; a code was sent. Move to the code-entry step.
      if (response.ok && json?.ok && adminUsersQaPhase2LoginNeedsTwoFactor(json)) {
        setTwoFactor({
          active: true,
          email: adminUsersQaPhase2LoginEmail(json),
          maskedPhone: clean(json?.maskedPhone),
          returnTo: clean(json?.returnTo) || returnTo,
          info: clean(json?.deliveryError) || (clean(json?.maskedPhone) ? `We sent a verification code to ${clean(json?.maskedPhone)}.` : "We sent you a verification code."),
        });
        setCode("");
        setStatus("");
        return;
      }

      if (!response.ok || !json?.ok || !json?.authenticated) {
        setStatus(json?.error || "Administrator login failed.");
        return;
      }

      if (adminUsersQaPhase2LoginNeedsForcedPasswordChange(json)) {
        window.location.href = String(json?.forcedPasswordChangeRedirectTo || ADMIN_USERS_QA_PHASE2_FORCED_PASSWORD_CHANGE_ROUTE);
        return;
      }

      window.location.href = clean(json.returnTo) || returnTo;
    } catch (error: any) {
      setStatus(error?.message || "Administrator login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    const trimmedCode = clean(code);
    if (!trimmedCode) {
      setStatus("Enter the verification code.");
      return;
    }
    try {
      setBusy(true);
      const response = await fetch(ADMIN_USERS_QA_PHASE2_TWO_FACTOR_VERIFY_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmedCode, returnTo: twoFactor?.returnTo || returnTo }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.authenticated) {
        setStatus(json?.error || "Verification failed.");
        return;
      }
      window.location.href = clean(json.returnTo) || twoFactor?.returnTo || returnTo;
    } catch (error: any) {
      setStatus(error?.message || "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setStatus("");
    try {
      setBusy(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: clean(username) || undefined, password: clean(password), action: "Login", returnTo }),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.ok && adminUsersQaPhase2LoginNeedsTwoFactor(json)) {
        setStatus(clean(json?.maskedPhone) ? `New code sent to ${clean(json?.maskedPhone)}.` : "New code sent.");
      } else {
        setStatus(json?.error || "Could not resend the code. Sign in again.");
      }
    } catch (error: any) {
      setStatus(error?.message || "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  }

  function cancelTwoFactor() {
    setTwoFactor(null);
    setCode("");
    setStatus("");
  }

  async function handleLogout() {
    try {
      setBusy(true);
      await fetch("/api/auth/logout", { method: "POST" });
      setAlreadyAuthenticated(false);
      setUsername("");
      setPassword("");
      setStatus("Administrator session cleared.");
    } catch (error: any) {
      setStatus(error?.message || "Logout failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main data-barsh-login-page="true" style={pageStyle}>
      <section style={cardStyle}>
        <header style={headerStyle}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85 }}>
            Barsh Matters
          </div>
          <h1 style={{ margin: "8px 0 0", fontSize: 26, lineHeight: 1.1 }}>Login</h1>
        </header>

        {twoFactor?.active ? (
          <form data-barsh-login-2fa-form="true" onSubmit={handleVerifyCode} style={bodyStyle}>
            <p style={{ margin: 0, color: "#385a83", fontSize: 14, lineHeight: 1.5 }}>{twoFactor.info}</p>

            <label style={labelStyle}>
              Verification code
              <input
                data-barsh-login-2fa-code="true"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                autoFocus
                style={{ ...inputStyle, letterSpacing: "0.4em", fontSize: 20, textAlign: "center" }}
              />
            </label>

            {status ? (
              <div data-barsh-login-status="true" style={{ ...statusStyle, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
                {status}
              </div>
            ) : null}

            <button data-barsh-login-2fa-submit="true" type="submit" disabled={busy} style={{ ...primaryButtonStyle, opacity: busy ? 0.7 : 1 }}>
              {busy ? "Verifying..." : "Verify & sign in"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button type="button" onClick={resendCode} disabled={busy} style={{ ...secondaryButtonStyle, flex: 1, cursor: busy ? "default" : "pointer" }}>
                Resend code
              </button>
              <button type="button" onClick={cancelTwoFactor} disabled={busy} style={{ ...secondaryButtonStyle, flex: 1, cursor: busy ? "default" : "pointer" }}>
                Back
              </button>
            </div>
          </form>
        ) : (
        <form data-barsh-login-form="true" onSubmit={handleSubmit} style={bodyStyle}>
          <p style={{ margin: 0, color: "#385a83", fontSize: 14, lineHeight: 1.5 }}>
            Sign in with your username and password. During rollout, the legacy admin password still works if the username field is left blank.
          </p>

          <label style={labelStyle}>
            Username
            <input
              data-barsh-login-username="true"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="dbarshay"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Password
            <input
              data-barsh-login-password="true"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={inputStyle}
            />
          </label>

          {status ? (
            <div
              data-barsh-login-status="true"
              style={{
                ...statusStyle,
                background: alreadyAuthenticated ? "#ecfdf5" : "#fef2f2",
                border: alreadyAuthenticated ? "1px solid #bbf7d0" : "1px solid #fecaca",
                color: alreadyAuthenticated ? "#166534" : "#991b1b",
              }}
            >
              {status}
            </div>
          ) : null}

          <button data-barsh-login-submit="true" type="submit" disabled={busy} style={{ ...primaryButtonStyle, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Checking..." : "Login"}
          </button>


        </form>
        )}
      </section>
    </main>
  );
}
