import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";
import {
  buildAdminUserSignerProfileWritePayloadPhase7,
  getAdminUserSignerProfileChangedFieldsPhase7,
} from "@/src/lib/admin-users/admin-user-signer-profile-write-contract-phase7";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminSignerProfileUpdateBody = {
  actorEmail?: unknown;
  userId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  displayName?: unknown;
  username?: unknown;
  email?: unknown;
  phoneExtension?: unknown;
  faxNumber?: unknown;
  signatureBlockName?: unknown;
  signerEligible?: unknown;
  locked?: unknown;
  inactive?: unknown;
  twoFactorPhone?: unknown;
  twoFactorDisabled?: unknown;
  twoFactorPendingSetup?: unknown;
  apply?: unknown;
};

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function cleanBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === "yes";
}

function nullableString(value: unknown): string | null {
  const cleaned = cleanString(value);
  return cleaned.length === 0 ? null : cleaned;
}

async function requireOwnerAdminActor(actorEmail: string) {
  if (!actorEmail) return null;
  return prisma.adminUser.findFirst({
    where: {
      email: actorEmail,
      status: "active",
      roles: {
        some: {
          role: {
            key: "owner_admin",
            status: "active",
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });
}

async function activeBootstrapOwnerAdminCount(): Promise<number> {
  return prisma.adminUser.count({
    where: {
      status: "active",
      bootstrapSafe: true,
      locked: false,
      inactive: false,
      roles: {
        some: {
          role: {
            key: "owner_admin",
            status: "active",
          },
        },
      },
    },
  });
}

function profileSnapshot(user: {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  username: string | null;
  email: string;
  emailNormalized: string | null;
  usernameNormalized: string | null;
  phoneExtension: string | null;
  faxNumber: string | null;
  signatureBlockName: string | null;
  signerEligible: boolean;
  locked: boolean;
  inactive: boolean;
  twoFactorPhone: string | null;
  twoFactorDisabled: boolean;
  twoFactorPendingSetup: boolean;
}) {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    emailNormalized: user.emailNormalized,
    usernameNormalized: user.usernameNormalized,
    phoneExtension: user.phoneExtension,
    faxNumber: user.faxNumber,
    signatureBlockName: user.signatureBlockName,
    signerEligible: user.signerEligible,
    locked: user.locked,
    inactive: user.inactive,
    twoFactorPhone: user.twoFactorPhone,
    twoFactorDisabled: user.twoFactorDisabled,
    twoFactorPendingSetup: user.twoFactorPendingSetup,
  };
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isAdminRequestAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-signer-profile-update",
          mode: "blocked",
          error: "Authenticated administrator session required.",
          enforcementChanged: false,
        },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as AdminSignerProfileUpdateBody;
    const actorEmail = cleanEmail(body.actorEmail);
    const userId = cleanString(body.userId);
    const apply = cleanBoolean(body.apply);

    if (!actorEmail) {
      return NextResponse.json({ ok: false, error: "actorEmail is required." }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required." }, { status: 400 });
    }

    const actor = await requireOwnerAdminActor(actorEmail);
    if (!actor) {
      return NextResponse.json({
        ok: false,
        error: "Only an active owner_admin user may edit admin signer profiles in Phase 11.",
        actorRoleRequired: "owner_admin",
      }, { status: 403 });
    }

    const existing = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        bootstrapSafe: true,
        firstName: true,
        lastName: true,
        displayName: true,
        username: true,
        emailNormalized: true,
        usernameNormalized: true,
        phoneExtension: true,
        faxNumber: true,
        signatureBlockName: true,
        signerEligible: true,
        locked: true,
        inactive: true,
        twoFactorPhone: true,
        twoFactorDisabled: true,
        twoFactorPendingSetup: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Admin user not found." }, { status: 404 });
    }

    const payload = buildAdminUserSignerProfileWritePayloadPhase7({
      firstName: nullableString(body.firstName) ?? existing.firstName,
      lastName: nullableString(body.lastName) ?? existing.lastName,
      displayName: nullableString(body.displayName) ?? existing.displayName,
      username: nullableString(body.username) ?? existing.username,
      email: nullableString(body.email) ?? existing.email,
      phoneExtension: body.phoneExtension === undefined ? existing.phoneExtension : String(body.phoneExtension ?? ""),
      faxNumber: body.faxNumber === undefined ? existing.faxNumber : String(body.faxNumber ?? ""),
      signatureBlockName: nullableString(body.signatureBlockName) ?? existing.signatureBlockName,
      signerEligible: body.signerEligible === undefined ? existing.signerEligible : cleanBoolean(body.signerEligible),
      locked: body.locked === undefined ? existing.locked : cleanBoolean(body.locked),
      inactive: body.inactive === undefined ? existing.inactive : cleanBoolean(body.inactive),
      twoFactorPhone: nullableString(body.twoFactorPhone) ?? existing.twoFactorPhone,
      twoFactorDisabled: body.twoFactorDisabled === undefined ? existing.twoFactorDisabled : cleanBoolean(body.twoFactorDisabled),
      twoFactorPendingSetup: body.twoFactorPendingSetup === undefined ? existing.twoFactorPendingSetup : cleanBoolean(body.twoFactorPendingSetup),
    });

    if (payload.emailNormalized !== existing.emailNormalized) {
      const duplicateEmail = await prisma.adminUser.findFirst({
        where: {
          emailNormalized: payload.emailNormalized,
          id: { not: userId },
        },
        select: { id: true, email: true },
      });
      if (duplicateEmail) {
        return NextResponse.json({ ok: false, error: "Another admin user already has that email." }, { status: 409 });
      }
    }

    if (payload.usernameNormalized !== existing.usernameNormalized && payload.usernameNormalized !== null) {
      const duplicateUsername = await prisma.adminUser.findFirst({
        where: {
          // normalizedUsername is the @unique column and the auth/login lookup key; check it (not the
          // parallel non-unique usernameNormalized) so the DB constraint can't surface as a 500.
          normalizedUsername: payload.usernameNormalized,
          id: { not: userId },
        },
        select: { id: true, username: true },
      });
      if (duplicateUsername) {
        return NextResponse.json({ ok: false, error: "Another admin user already has that username." }, { status: 409 });
      }
    }

    const targetIsSoleBootstrapOwner =
      existing.bootstrapSafe === true &&
      existing.status === "active" &&
      existing.locked === false &&
      existing.inactive === false &&
      (await activeBootstrapOwnerAdminCount()) <= 1;

    const existingTwoFactorEnforced =
      existing.twoFactorDisabled === false &&
      existing.twoFactorPendingSetup === false &&
      Boolean(existing.twoFactorPhone);

    const payloadTwoFactorEnforced =
      payload.twoFactorDisabled === false &&
      payload.twoFactorPendingSetup === false &&
      Boolean(payload.twoFactorPhone);

    const movingSoleBootstrapOwnerIntoEnforcedTwoFactor =
      targetIsSoleBootstrapOwner &&
      existingTwoFactorEnforced === false &&
      payloadTwoFactorEnforced === true;

    if (movingSoleBootstrapOwnerIntoEnforcedTwoFactor) {
      return NextResponse.json({
        ok: false,
        action: "admin-user-signer-profile-update",
        mode: apply ? "apply-blocked" : "preview-blocked",
        error: "Sole bootstrapSafe owner_admin cannot be moved directly into enforced 2FA. Start with pending setup and verify recovery before enforcement.",
        lockoutProtection: true,
        soleBootstrapOwnerProtection: true,
        targetEmail: existing.email,
      }, { status: 409 });
    }

    const before = profileSnapshot(existing);
    const after = {
      ...before,
      firstName: payload.firstName,
      lastName: payload.lastName,
      displayName: payload.displayName,
      username: payload.username,
      email: payload.email ?? existing.email,
      emailNormalized: payload.emailNormalized,
      usernameNormalized: payload.usernameNormalized,
      phoneExtension: payload.phoneExtension,
      faxNumber: payload.faxNumber,
      signatureBlockName: payload.signatureBlockName,
      signerEligible: payload.signerEligible,
      locked: payload.locked,
      inactive: payload.inactive,
      twoFactorPhone: payload.twoFactorPhone,
      twoFactorDisabled: payload.twoFactorDisabled,
      twoFactorPendingSetup: payload.twoFactorPendingSetup,
    };
    const changedFields = getAdminUserSignerProfileChangedFieldsPhase7(before, after);

    if (!apply) {
      return NextResponse.json({
        ok: true,
        mode: "preview",
        previewOnly: true,
        userId,
        changedFields,
        signerProfileStatus: payload.signerProfileStatus,
        signerMissingFields: payload.signerMissingFields,
        twoFactorStatus: payload.twoFactorStatus,
        note: "Preview only. No AdminUser row, password, lockout route, role, permission, document, or Clio record was changed.",
      });
    }

    const updated = await prisma.adminUser.update({
      where: { id: userId },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        displayName: payload.displayName,
        username: payload.username,
        email: payload.email ?? existing.email,
        emailNormalized: payload.emailNormalized,
        usernameNormalized: payload.usernameNormalized,
        normalizedUsername: payload.usernameNormalized,
        phoneExtension: payload.phoneExtension,
        faxNumber: payload.faxNumber,
        signatureBlockName: payload.signatureBlockName,
        signerEligible: payload.signerEligible,
        locked: payload.locked,
        inactive: payload.inactive,
        twoFactorPhone: payload.twoFactorPhone,
        twoFactorDisabled: payload.twoFactorDisabled,
        twoFactorPendingSetup: payload.twoFactorPendingSetup,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        locked: true,
        inactive: true,
        signerEligible: true,
        twoFactorDisabled: true,
        twoFactorPendingSetup: true,
      },
    });

    await createMatterAuditLogEntry({
      action: "admin-user-signer-profile-update",
      summary: `Updated admin signer profile for ${updated.email}.`,
      entityType: "admin_user",
      fieldName: "AdminUser.signerProfile",
      priorValue: before as unknown as Prisma.InputJsonValue,
      newValue: {
        changedFields,
        after,
        signerProfileStatus: payload.signerProfileStatus,
        signerMissingFields: payload.signerMissingFields,
        twoFactorStatus: payload.twoFactorStatus,
        auditContext: {
          actorEmail,
          actorId: actor.id,
          source: "admin-users-signer-profile-phase11",
          noPasswordReset: true,
          noLockoutRouteUsed: true,
          noDocumentGenerationWiring: true,
        },
      } as Prisma.InputJsonValue,
    });

    return NextResponse.json({
      ok: true,
      mode: "apply",
      user: updated,
      changedFields,
      signerProfileStatus: payload.signerProfileStatus,
      signerMissingFields: payload.signerMissingFields,
      twoFactorStatus: payload.twoFactorStatus,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Could not update admin signer profile.",
    }, { status: 500 });
  }
}
