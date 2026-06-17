"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
  color: "#0f172a",
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
  background: "#1e3a8a",
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
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  color: "#0f172a",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #1e3a8a",
  borderRadius: 12,
  background: "#1e3a8a",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 15,
  padding: "12px 16px",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#f8fafc",
  color: "#334155",
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
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [alreadyAuthenticated, setAlreadyAuthenticated] = useState(false);
  const returnTo = useMemo(() => safeReturnToFromSearch(), []);

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

    const trimmedPassword = clean(password);
    if (!trimmedPassword) {
      setStatus("Enter the administrator password.");
      return;
    }

    try {
      setBusy(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmedPassword, action: "Login", returnTo }),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok || !json?.authenticated) {
        setStatus(json?.error || "Administrator login failed.");
        return;
      }

      window.location.href = clean(json.returnTo) || returnTo;
    } catch (error: any) {
      setStatus(error?.message || "Administrator login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      setBusy(true);
      await fetch("/api/auth/logout", { method: "POST" });
      setAlreadyAuthenticated(false);
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
          <h1 style={{ margin: "8px 0 0", fontSize: 26, lineHeight: 1.1 }}>Administrator Login</h1>
        </header>

        <form data-barsh-login-form="true" onSubmit={handleSubmit} style={bodyStyle}>
          <p style={{ margin: 0, color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
            Sign in to open Administrator functions. Two-factor authentication by SMS or phone push is planned for a later auth phase.
          </p>

          <label style={labelStyle}>
            Administrator Password
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

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/" style={{ ...secondaryButtonStyle, flex: "1 1 160px" }}>
              Back to Home
            </a>
            <a href={returnTo} style={{ ...secondaryButtonStyle, flex: "1 1 160px" }}>
              Try Administrator
            </a>
            {alreadyAuthenticated ? (
              <button type="button" onClick={handleLogout} disabled={busy} style={{ ...secondaryButtonStyle, flex: "1 1 160px", cursor: "pointer" }}>
                Logout
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
}
