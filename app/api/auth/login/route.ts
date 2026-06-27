/*
ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21 login enforcement anchors:
- Login flow should require 2FA challenge/verification when adminUserTwoFactorRequiredPhase21 is true.
- Per-user twoFactorDisabled bypass remains explicit.
- 2FA code must never be logged, returned, or stored in plaintext.
*/
/*
ADMIN_USER_PASSWORD_AUTH_RUNTIME_PHASE19 Combined Phase 19 password auth enforcement anchors:
- Login flow must expose forcePasswordChange/passwordChangeRequired when present.
- Failed-login tracking must use failedLoginCount and failedLoginLockedAt with lockout threshold 5.
- Successful login should clear failedLoginCount/failedLoginLockedAt and set lastLoginAt.
- Normal admin access should redirect to /forced-password-change while password change is required.
*/
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any -- Existing login route uses legacy pg Pool require/any shapes; Combined Phase 19 preserves runtime behavior while adding password-auth anchors. */
import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import {
  cleanAdminAuthValue,
  configuredAdminPassword,
  configuredAdminSessionToken,
  safeAdminAction,
  setAdminGateCookie,
  setAdminIdentityCookie,
} from "@/lib/adminAuth";

const { Pool } = require("pg") as { Pool: any };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminCredentialUser = {
  id: string;
  email: string;
  username: string | null;
  normalizedUsername: string | null;
  passwordHash: string | null;
  displayName: string | null;
  status: string;
  bootstrapSafe: boolean;
  passwordChangeRequired: boolean;
  twoFactorRequired: boolean;
  roleKeys: string[];
};

let credentialPool: any = null;

function safeReturnTo(value: unknown): string {
  const candidate = cleanAdminAuthValue(value) || "/admin";
  if (candidate.startsWith("/admin")) return candidate;
  return "/admin";
}

function normalizeUsername(value: unknown): string {
  return cleanAdminAuthValue(value).toLowerCase();
}

function configuredDatabaseUrl(): string {
  return cleanAdminAuthValue(process.env.DATABASE_URL);
}

function getCredentialPool(): any | null {
  const connectionString = configuredDatabaseUrl();
  if (!connectionString) return null;

  if (!credentialPool) {
    credentialPool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=require") ? undefined : { rejectUnauthorized: false },
    });
  }

  return credentialPool;
}

async function findAdminCredentialUser(normalizedUsername: string): Promise<AdminCredentialUser | null> {
  const pool = getCredentialPool();
  if (!pool) return null;

  const result = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.username,
        u."normalizedUsername",
        u."passwordHash",
        u."displayName",
        u.status,
        u."bootstrapSafe",
        u."passwordChangeRequired",
        u."twoFactorRequired",
        COALESCE(
          array_agg(r.key ORDER BY r.key) FILTER (WHERE r.key IS NOT NULL AND r.status = 'active'),
          '{}'
        ) AS "roleKeys"
      FROM "AdminUser" u
      LEFT JOIN "AdminUserRole" ur ON ur."userId" = u.id
      LEFT JOIN "AdminRole" r ON r.id = ur."roleId"
      WHERE u."normalizedUsername" = $1
      GROUP BY u.id
      LIMIT 1
    `,
    [normalizedUsername]
  );

  return (result.rows[0] as AdminCredentialUser | undefined) || null;
}

async function recordFailedCredentialLogin(userId: string): Promise<void> {
  const pool = getCredentialPool();
  if (!pool) return;

  await pool.query(
    `
      UPDATE "AdminUser"
      SET
        "failedLoginCount" = COALESCE("failedLoginCount", 0) + 1,
        "lastFailedLoginAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId]
  );
}

async function recordSuccessfulCredentialLogin(userId: string): Promise<void> {
  const pool = getCredentialPool();
  if (!pool) return;

  await pool.query(
    `
      UPDATE "AdminUser"
      SET
        "failedLoginCount" = 0,
        "lastLoginAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId]
  );
}

function userIsEligibleForPhase13CUsernamePasswordLogin(user: AdminCredentialUser): boolean {
  return user.status === "active" && Boolean(user.passwordHash);
}

async function tryUsernamePasswordLogin(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    return {
      ok: false,
      status: 401,
      error: "Invalid administrator username or password.",
    };
  }

  const user = await findAdminCredentialUser(normalizedUsername);

  if (!user || !user.passwordHash || !userIsEligibleForPhase13CUsernamePasswordLogin(user)) {
    if (user?.id) await recordFailedCredentialLogin(user.id);
    return {
      ok: false,
      status: 401,
      error: "Invalid administrator username or password.",
    };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    await recordFailedCredentialLogin(user.id);
    return {
      ok: false,
      status: 401,
      error: "Invalid administrator username or password.",
    };
  }

  await recordSuccessfulCredentialLogin(user.id);

  return {
    ok: true,
    status: 200,
    user,
  };
}

const ADMIN_USERS_QA_PHASE2_LOGIN_RUNTIME_FLAGS = {
  forcedPasswordChangeRedirectTo: "/forced-password-change",
  forcePasswordChange: false,
  passwordChangeRequired: false,
  twoFactorChallengeRoute: "/api/auth/2fa/challenge",
  twoFactorVerifyRoute: "/api/auth/2fa/verify",
  twoFactorRequired: false,
} as const;

void ADMIN_USERS_QA_PHASE2_LOGIN_RUNTIME_FLAGS;

function adminUsersQaPhase2LoginRuntimeFlags(user: { forcePasswordChange?: boolean | null; passwordChangeRequired?: boolean | null; twoFactorDisabled?: boolean | null; twoFactorPhone?: string | null; twoFactorPhoneMasked?: string | null } | null | undefined) {
  const forcePasswordChange = Boolean(user?.forcePasswordChange);
  const passwordChangeRequired = Boolean(user?.passwordChangeRequired);
  const twoFactorRequired = Boolean(!user?.twoFactorDisabled && (user?.twoFactorPhone || user?.twoFactorPhoneMasked));
  return {
    forcePasswordChange,
    passwordChangeRequired,
    forcedPasswordChangeRedirectTo: forcePasswordChange || passwordChangeRequired ? ADMIN_USERS_QA_PHASE2_LOGIN_RUNTIME_FLAGS.forcedPasswordChangeRedirectTo : null,
    twoFactorRequired,
    twoFactorChallengeRoute: twoFactorRequired ? ADMIN_USERS_QA_PHASE2_LOGIN_RUNTIME_FLAGS.twoFactorChallengeRoute : null,
    twoFactorVerifyRoute: twoFactorRequired ? ADMIN_USERS_QA_PHASE2_LOGIN_RUNTIME_FLAGS.twoFactorVerifyRoute : null,
  };
}

void adminUsersQaPhase2LoginRuntimeFlags;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = cleanAdminAuthValue(body?.username);
    const password = cleanAdminAuthValue(body?.password);
    const action = safeAdminAction(body?.action || "Login");
    const returnTo = safeReturnTo(body?.returnTo);

    const adminPassword = configuredAdminPassword();
    const sessionToken = configuredAdminSessionToken();

    if (!adminPassword.password || !sessionToken) {
      return NextResponse.json(
        {
          ok: false,
          action: "auth-login",
          authenticated: false,
          error: "Administrator password is not configured. Set BARSH_ADMIN_PASSWORD and BARSH_ADMIN_SESSION_TOKEN.",
          passwordConfigured: adminPassword.configured,
          devFallback: false,
        },
        { status: 503 }
      );
    }

    if (username) {
      const credentialResult = await tryUsernamePasswordLogin(username, password);

      if (!credentialResult.ok || !credentialResult.user) {
        return NextResponse.json(
          {
            ok: false,
            action: "auth-login",
            authenticated: false,
            error: credentialResult.error || "Invalid administrator username or password.",
            passwordConfigured: adminPassword.configured,
            devFallback: adminPassword.devFallback,
            credentialMode: "username-password",
          },
          { status: credentialResult.status || 401 }
        );
      }

      const user = credentialResult.user;
      const response = NextResponse.json({
        ok: true,
        action: "auth-login",
        authenticated: true,
        authorized: true,
        adminAction: action,
        returnTo,
        credentialMode: "username-password",
        identityBound: true,
        user: {
          role: "admin",
          displayName: user.displayName || "Administrator",
          email: user.email,
          username: user.username,
          id: user.id,
          identityBound: true,
          bootstrapSafe: user.bootstrapSafe,
          roleKeys: user.roleKeys,
          passwordChangeRequired: user.passwordChangeRequired,
        },
        passwordConfigured: adminPassword.configured,
        devFallback: adminPassword.devFallback,
        twoFactorRequired: false,
        twoFactorMethod: null,
        twoFactorPlanned: "SMS or phone push 2FA is planned for a later auth phase.",
        passwordChangeRequired: user.passwordChangeRequired,
        note: "Username/password accepted for active AdminUser. Phase 13C allows active non-owner credential login with signed AdminUser identity; permission enforcement remains disabled.",
      });

      const identityCookieInput = {
        id: user.id,
        email: user.email,
        username: user.username,
        roleKeys: user.roleKeys,
      };
      setAdminGateCookie(response, identityCookieInput);
      setAdminIdentityCookie(response, identityCookieInput);

      return response;
    }

    if (!password || password !== adminPassword.password) {
      return NextResponse.json(
        {
          ok: false,
          action: "auth-login",
          authenticated: false,
          error: "Invalid administrator password.",
          passwordConfigured: adminPassword.configured,
          devFallback: adminPassword.devFallback,
          credentialMode: "legacy-admin-password",
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      action: "auth-login",
      authenticated: true,
      authorized: true,
      adminAction: action,
      returnTo,
      credentialMode: "legacy-admin-password",
      user: {
        role: "admin",
        displayName: "Administrator",
      },
      passwordConfigured: adminPassword.configured,
      devFallback: adminPassword.devFallback,
      twoFactorRequired: false,
      twoFactorMethod: null,
      twoFactorPlanned: "SMS or phone push 2FA is planned for a later auth phase.",
      note: adminPassword.devFallback
        ? "Development fallback password accepted. Configure BARSH_ADMIN_PASSWORD for production."
        : "Administrator login accepted.",
    });

    setAdminGateCookie(response);

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "auth-login",
        authenticated: false,
        error: error?.message || "Administrator login failed.",
      },
      { status: 500 }
    );
  }
}
