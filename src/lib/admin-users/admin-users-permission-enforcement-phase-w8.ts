import type {
  AdminUsersPhaseW1OperationKey,
  AdminUsersPhaseW1RoleKey,
} from "./admin-users-final-permission-coverage-phase-w1";

export const ADMIN_USERS_PHASE_W8_ENFORCEMENT_KILL_SWITCH_SCAFFOLD = true as const;

export const ADMIN_USERS_PHASE_W8_ENFORCEMENT_ENV_KEY = "BARSH_ADMIN_USERS_PERMISSION_ENFORCEMENT" as const;

export type AdminUsersPhaseW8Actor = {
  email: string;
  roleKeys: AdminUsersPhaseW1RoleKey[];
  adminCardGrantKeys: string[];
  bootstrapSafe?: boolean;
};

export type AdminUsersPhaseW8RouteContext = {
  path: string;
  areaKey: string;
  operationFamilies: AdminUsersPhaseW1OperationKey[];
  paymentSensitive: boolean;
  adminOnly: boolean;
  adminCardGrantKey: string | null;
};

export type AdminUsersPhaseW8Decision = {
  allowed: boolean;
  reason: string;
  enforcementActive: boolean;
  killSwitchEnabled: boolean;
  dryRunOnly: boolean;
  routeBlockingActive: false;
  uiHidingActive: false;
  databaseMutated: false;
};

export function adminUsersPhaseW8IsPermissionEnforcementEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[ADMIN_USERS_PHASE_W8_ENFORCEMENT_ENV_KEY] === "1";
}

export function adminUsersPhaseW8HasMutationOperation(operationFamilies: AdminUsersPhaseW1OperationKey[]): boolean {
  return operationFamilies.some((operation) =>
    [
      "create",
      "edit",
      "delete",
      "archive",
      "generate",
      "finalize",
      "upload",
      "email",
      "run",
      "void",
      "payment_manage",
      "admin_manage",
    ].includes(operation)
  );
}

export function adminUsersPhaseW8DryRunDecision(
  actor: AdminUsersPhaseW8Actor,
  route: AdminUsersPhaseW8RouteContext,
  env: NodeJS.ProcessEnv = process.env
): AdminUsersPhaseW8Decision {
  const killSwitchEnabled = adminUsersPhaseW8IsPermissionEnforcementEnabled(env);

  if (!killSwitchEnabled) {
    return {
      allowed: true,
      reason: "Permission enforcement kill switch is off; this helper is dry-run only and must not block.",
      enforcementActive: false,
      killSwitchEnabled,
      dryRunOnly: true,
      routeBlockingActive: false,
      uiHidingActive: false,
      databaseMutated: false,
    };
  }

  if (actor.roleKeys.includes("owner_admin")) {
    return {
      allowed: true,
      reason: "Owner is allowed everything and remains protected from lockout.",
      enforcementActive: true,
      killSwitchEnabled,
      dryRunOnly: true,
      routeBlockingActive: false,
      uiHidingActive: false,
      databaseMutated: false,
    };
  }

  if (route.adminOnly) {
    if (!actor.roleKeys.includes("administrator")) {
      return {
        allowed: false,
        reason: "Dry-run decision: non-admin role would be blocked from Admin-only route.",
        enforcementActive: true,
        killSwitchEnabled,
        dryRunOnly: true,
        routeBlockingActive: false,
        uiHidingActive: false,
        databaseMutated: false,
      };
    }

    if (route.adminCardGrantKey && !actor.adminCardGrantKeys.includes(route.adminCardGrantKey)) {
      return {
        allowed: false,
        reason: "Dry-run decision: Administrator lacks selected Admin-card grant.",
        enforcementActive: true,
        killSwitchEnabled,
        dryRunOnly: true,
        routeBlockingActive: false,
        uiHidingActive: false,
        databaseMutated: false,
      };
    }

    return {
      allowed: true,
      reason: "Dry-run decision: Administrator has Admin route/card access.",
      enforcementActive: true,
      killSwitchEnabled,
      dryRunOnly: true,
      routeBlockingActive: false,
      uiHidingActive: false,
      databaseMutated: false,
    };
  }

  if (actor.roleKeys.includes("administrator") || actor.roleKeys.includes("full_user")) {
    return {
      allowed: true,
      reason: "Dry-run decision: role allows non-admin access.",
      enforcementActive: true,
      killSwitchEnabled,
      dryRunOnly: true,
      routeBlockingActive: false,
      uiHidingActive: false,
      databaseMutated: false,
    };
  }

  if (actor.roleKeys.includes("basic_user")) {
    const blocked = route.paymentSensitive || route.operationFamilies.includes("payment_manage") || route.operationFamilies.includes("void");
    return {
      allowed: !blocked,
      reason: blocked
        ? "Dry-run decision: Basic User would be blocked from payment/billing/void route."
        : "Dry-run decision: Basic User would be allowed non-payment non-admin route.",
      enforcementActive: true,
      killSwitchEnabled,
      dryRunOnly: true,
      routeBlockingActive: false,
      uiHidingActive: false,
      databaseMutated: false,
    };
  }

  if (actor.roleKeys.includes("view_only")) {
    const blocked = route.paymentSensitive || adminUsersPhaseW8HasMutationOperation(route.operationFamilies);
    return {
      allowed: !blocked,
      reason: blocked
        ? "Dry-run decision: View Only would be blocked from payment or mutation/action route."
        : "Dry-run decision: View Only would be allowed read-only non-admin route.",
      enforcementActive: true,
      killSwitchEnabled,
      dryRunOnly: true,
      routeBlockingActive: false,
      uiHidingActive: false,
      databaseMutated: false,
    };
  }

  return {
    allowed: false,
    reason: "Dry-run decision: no recognized role allowed this route.",
    enforcementActive: true,
    killSwitchEnabled,
    dryRunOnly: true,
    routeBlockingActive: false,
    uiHidingActive: false,
    databaseMutated: false,
  };
}
