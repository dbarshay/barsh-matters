/* eslint-disable @typescript-eslint/no-explicit-any -- Pre-existing planning-read mapping helpers use broad Prisma row shapes; this change only adds owner gating and preserves those shapes. */
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_IDENTITY_COOKIE_NAME, adminUnauthorizedJson, isAdminRequestAuthorized, readSignedAdminIdentityCookie } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { configuredAdminPermissionsEnforcementEnabled } from "@/lib/adminPermissions";
import { ADMIN_ROLE_PLANNING_DEFINITIONS, ADMIN_USER_PLANNING_ROWS, adminRolePlanningSummary, effectiveAdminUserPlanningRows } from "@/lib/adminUsersPlanning";
import { ADMIN_USERS_PHASE_V1_ADMIN_CARDS, ADMIN_USERS_PHASE_V1_FINAL_ROLE_DEFINITIONS } from "@/src/lib/admin-users/admin-users-final-role-model-phase-v1";

const ADMIN_USERS_PHASE_V4B_ADMIN_CARD_GRANT_KEYS = ADMIN_USERS_PHASE_V1_ADMIN_CARDS.map((card) => card.grantPermissionKey);
const ADMIN_USERS_PHASE_V4B_ADMIN_CARD_GRANT_KEY_SET = new Set(ADMIN_USERS_PHASE_V4B_ADMIN_CARD_GRANT_KEYS);

export const dynamic = "force-dynamic";

// This route feeds the owner-only Admin Users page, so it must itself be owner-gated;
// it previously had no auth check at all.
const OWNER_ADMIN_EMAIL = (process.env.BARSH_OWNER_ADMIN_EMAIL || "dbarshay@brlfirm.com").trim().toLowerCase();

export async function GET(req: NextRequest) {
  try {
    if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson(401);
    const identity = readSignedAdminIdentityCookie(req.cookies.get(ADMIN_IDENTITY_COOKIE_NAME)?.value);
    const roleKeys = Array.isArray(identity?.roleKeys) ? identity.roleKeys : [];
    const isOwner =
      Boolean(identity) &&
      (identity!.email === OWNER_ADMIN_EMAIL || roleKeys.includes("owner_admin") || roleKeys.includes("owner"));
    if (!isOwner) {
      return NextResponse.json({ ok: false, action: "admin-users-roles-planning-read-only", error: "Owner access required." }, { status: 403 });
    }
  const [dbUsers, dbRoles, dbRolePermissions, dbUserRoles, dbUserPermissionOverrides] = await Promise.all([
    prisma.adminUser.findMany({ orderBy: [{ email: "asc" }], take: 200, include: { roles: { include: { role: { include: { permissions: true } } } }, permissionOverrides: true } }),
    prisma.adminRole.findMany({ orderBy: [{ key: "asc" }], take: 200, include: { permissions: true } }),
    prisma.adminRolePermission.count(),
    prisma.adminUserRole.count(),
    prisma.adminUserPermissionOverride.count(),
  ]);

  return NextResponse.json({
    action: "admin-users-roles-planning-read-only",
    finalRoleModel: {
      phase: "admin-users-phase-v2-role-ui-card-planning",
      runtimeEnforcementChanged: false,
      databaseMutated: false,
      roles: ADMIN_USERS_PHASE_V1_FINAL_ROLE_DEFINITIONS.map((role) => ({
        key: role.key,
        label: role.label,
        description: role.description,
        status: "active",
        systemRole: true,
        adminAccessMode: role.adminAccessMode,
        nonAdminAccessMode: role.nonAdminAccessMode,
        paymentAccessMode: role.paymentAccessMode,
        mutationMode: role.mutationMode,
        adminCardGrantMode: role.adminCardGrantMode,
        protectedFromLockout: role.protectedFromLockout,
        mayManageUsersAndRoles: role.mayManageUsersAndRoles,
        mayResetPasswords: role.mayResetPasswords,
        mayConfigureTwoFactor: role.mayConfigureTwoFactor,
        permissionCount: 0,
        permissionKeys: [],
        source: "phase-v1-final-role-contract",
      })),
      adminCards: ADMIN_USERS_PHASE_V1_ADMIN_CARDS.map((card) => ({
        key: card.key,
        label: card.label,
        route: card.route,
        grantPermissionKey: card.grantPermissionKey,
        sensitive: card.sensitive,
        ownerOnlyRecommended: card.ownerOnlyRecommended,
        description: card.description,
      })),
      note: "Read-only final role/card model for Admin Users UI planning. This does not assign roles, save card grants, or enable runtime enforcement.",
    },
    mode: "db-preview-plus-planning",
    enforcementEnabled: configuredAdminPermissionsEnforcementEnabled(),
    note: "Read-only Phase 2 planning surface. This endpoint reads DB-backed admin user/role tables for preview only. It does not create users, edit roles, assign permissions, write database records, write Clio, or enable enforcement.",
    databasePreview: {
      readOnly: true,
      userCount: dbUsers.length,
      roleCount: dbRoles.length,
      rolePermissionCount: dbRolePermissions,
      userRoleCount: dbUserRoles,
      userPermissionOverrideCount: dbUserPermissionOverrides,
      users: dbUsers.map((user: any) => {
        const roleKeys = user.roles.map((entry: any) => entry.role.key).sort();
        const rolePermissionKeys = Array.from(new Set(user.roles.flatMap((entry: any) => (entry.role.permissions || []).map((permission: any) => permission.permissionKey)))).sort();
        const explicitOverrides = user.permissionOverrides.map((entry: any) => ({ permissionKey: entry.permissionKey, action: entry.action, reason: entry.reason })).sort((a: any, b: any) => a.permissionKey.localeCompare(b.permissionKey));
        const adminCardGrantKeys = explicitOverrides.filter((entry: any) => ADMIN_USERS_PHASE_V4B_ADMIN_CARD_GRANT_KEY_SET.has(entry.permissionKey) && entry.action === "allow").map((entry: any) => entry.permissionKey).sort();
        const adminCardBlockKeys = explicitOverrides.filter((entry: any) => ADMIN_USERS_PHASE_V4B_ADMIN_CARD_GRANT_KEY_SET.has(entry.permissionKey) && entry.action === "block").map((entry: any) => entry.permissionKey).sort();
        const explicitBlocks = new Set(explicitOverrides.filter((entry: any) => entry.action === "block").map((entry: any) => entry.permissionKey));
        const explicitAllows = explicitOverrides.filter((entry: any) => entry.action === "allow").map((entry: any) => entry.permissionKey);
        const effectivePermissionKeys = Array.from(new Set([...rolePermissionKeys.filter((permissionKey: any) => !explicitBlocks.has(permissionKey)), ...explicitAllows])).sort();
        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName,
          username: user.username,
          lastLoginAt: user.lastLoginAt,
          phoneExtension: user.phoneExtension,
          faxNumber: user.faxNumber,
          signatureBlockName: user.signatureBlockName,
          signatureImageDataUrl: user.signatureImageDataUrl || "",
          signatureImagePresent: Boolean(user.signatureImageDataUrl),
          signerEligible: user.signerEligible !== false,
          locked: Boolean(user.locked),
          inactive: Boolean(user.inactive),
          twoFactorPhone: user.twoFactorPhone,
          twoFactorDisabled: Boolean(user.twoFactorDisabled),
          twoFactorPendingSetup: Boolean(user.twoFactorPendingSetup),
          signerProfileStatus: user.signerEligible === false ? "Not Eligible" : [user.displayName, user.email, user.phoneExtension, user.faxNumber, user.signatureBlockName].every((value: any) => String(value ?? "").trim().length > 0) ? "Complete" : "Missing Fields",
          signerMissingFields: user.signerEligible === false ? [] : [
            ["Display Name", user.displayName],
            ["Email", user.email],
            ["Extension", user.phoneExtension],
            ["Fax", user.faxNumber],
            ["Signature Name", user.signatureBlockName],
          ].filter((entry: any) => String(entry[1] ?? "").trim().length === 0).map((entry: any) => entry[0]),
          twoFactorStatus: user.twoFactorDisabled ? "Disabled" : user.twoFactorPendingSetup ? "Pending Setup" : String(user.twoFactorPhone ?? "").trim().length === 0 ? "Missing Phone" : "Enabled",
          status: user.status,
          bootstrapSafe: user.bootstrapSafe,
          roleKeys,
          rolePermissionCount: rolePermissionKeys.length,
          effectivePermissionCount: effectivePermissionKeys.length,
          effectivePermissionKeys,
          explicitOverrides,
          adminCardGrantKeys,
          adminCardBlockKeys,
          adminCardGrantCount: adminCardGrantKeys.length,
          adminCardGrantPersistenceMode: roleKeys.includes("owner_admin") ? "owner_all_cards" : roleKeys.includes("administrator") ? "administrator_selected_cards" : "none",
          lockoutEligible: !user.bootstrapSafe,
          lockedOut: user.status !== "active",
          passwordConfigured: Boolean(user.passwordHash),
          passwordChangeRequired: Boolean(user.passwordChangeRequired),
          twoFactorRequired: Boolean(user.twoFactorRequired),
        };
      }),
      roles: dbRoles.map((role: any) => {
        const permissionKeys = role.permissions.map((entry: any) => entry.permissionKey).sort();
        return {
          id: role.id,
          key: role.key,
          label: role.label,
          description: role.description,
          status: role.status,
          systemRole: role.systemRole,
          permissionCount: permissionKeys.length,
          permissionKeys,
        };
      }),
    },
    planningRoleCount: ADMIN_ROLE_PLANNING_DEFINITIONS.length,
    planningUserCount: ADMIN_USER_PLANNING_ROWS.length,
    roles: adminRolePlanningSummary(),
    users: effectiveAdminUserPlanningRows(),
  });
  } catch (error) {
    console.error("Admin users planning lookup failed", error);
    return Response.json(
      {
        action: "admin-users-roles-planning-read-only",
        error: error instanceof Error ? error.message : "Admin users planning lookup failed",
        mode: "error",
        enforcementEnabled: false,
        users: [],
        roles: [],
        databasePreview: { users: [], roles: [], userCount: 0, roleCount: 0 },
        effectivePermissionsPreview: [],
      },
      { status: 500 }
    );
  }
}
