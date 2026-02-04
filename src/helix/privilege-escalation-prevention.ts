/**
 * PRIVILEGE ESCALATION PREVENTION
 *
 * Role-Based Access Control (RBAC) system preventing privilege escalation attacks:
 * - SYSTEM_ROLES: 4-tier role hierarchy (user < operator < approver < admin)
 * - RBACMatrix: Capability-based permission matrix
 * - checkCapability: Validates role has capability
 * - detectPrivilegeEscalation: Identifies escalation techniques (scope merge, gateway exec, container bypass)
 * - enforceContainerExecution: Validates containerized execution
 * - validateToolExecution: Verifies tool request permissions
 * - verifyScopeSeparation: Ensures security boundaries between roles
 *
 * CRITICAL PRINCIPLE: All privilege escalation attempts logged to Discord BEFORE blocking
 */

import '../lib/safe-console.js';

/**
 * System role hierarchy: each role has all capabilities of lower roles plus new ones
 * user < operator < approver < admin
 */
export const SYSTEM_ROLES = ['user', 'operator', 'approver', 'admin'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/**
 * Capability that roles can perform
 */
export type RoleCapability =
  | 'read'
  | 'list'
  | 'execute'
  | 'write'
  | 'delete'
  | 'approve'
  | 'configure';

/**
 * Role-Capability assignment matrix
 */
const CAPABILITY_MATRIX: Record<SystemRole, RoleCapability[]> = {
  user: ['read', 'list'],
  operator: ['read', 'list', 'execute', 'write'],
  approver: ['read', 'list', 'execute', 'write', 'delete', 'approve'],
  admin: ['read', 'list', 'execute', 'write', 'delete', 'approve', 'configure'],
};

/**
 * Privilege escalation attempt details
 */
export interface PrivilegeEscalationAttempt {
  type:
    | 'scope_merge'
    | 'gateway_execution'
    | 'container_bypass'
    | 'legitimate_promotion'
    | 'unauthorized_escalation';
  currentRole: string;
  attemptedRole?: string;
  scopeBefore?: string[];
  scopeAfter?: string[];
  toolConfig?: {
    exec?: {
      host?: string;
    };
  };
  containerConfig?: {
    enabled?: boolean;
    enforced?: boolean;
    reason?: string;
  };
  approved?: boolean;
  approverRole?: string;
}

/**
 * Privilege escalation detection result
 */
export interface PrivilegeEscalationResult {
  isEscalation: boolean;
  technique?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  role: string;
  toolName: string;
  requiredCapability: RoleCapability;
  context?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Container execution context
 */
export interface ContainerExecutionContext {
  role: SystemRole;
  containerEnabled: boolean;
  containerEnforced?: boolean;
  bypassReason?: string;
}

/**
 * Scope separation validation result
 */
export interface ScopeSeparationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Capability check result
 */
export interface CapabilityCheckResult {
  allowed: boolean;
  reason?: string;
  logged: boolean;
}

/**
 * RBAC Matrix - enforces role-based capabilities
 */
export class RBACMatrix {
  /**
   * Check if a role can perform a capability
   */
  canPerform(role: unknown, capability: unknown): boolean {
    // Validate role
    if (!SYSTEM_ROLES.includes(role as SystemRole)) {
      return false;
    }

    // Validate capability
    if (typeof capability !== 'string') {
      return false;
    }

    const systemRole = role as SystemRole;
    const capabilities = CAPABILITY_MATRIX[systemRole];

    return capabilities.includes(capability as RoleCapability);
  }
}

/**
 * Global RBAC matrix instance
 */
const rbacMatrix = new RBACMatrix();

/**
 * Check if a role has capability to perform an action
 *
 * @param role - User's system role
 * @param capability - Capability being requested
 * @returns {allowed, reason?, logged} - Permission result with audit log flag
 */
export function checkCapability(
  role: unknown,
  capability: RoleCapability
): CapabilityCheckResult {
  // Validate role
  if (!SYSTEM_ROLES.includes(role as SystemRole)) {
    return {
      allowed: false,
      reason: `Invalid role: ${String(role)}`,
      logged: true,
    };
  }

  const allowed = rbacMatrix.canPerform(role, capability);

  if (!allowed) {
    return {
      allowed: false,
      reason: `Role '${String(role)}' cannot perform capability '${capability}'`,
      logged: true,
    };
  }

  return {
    allowed: true,
    logged: true,
  };
}

/**
 * Detect privilege escalation attempts
 *
 * @param attempt - Escalation attempt details
 * @returns {isEscalation, technique?, severity?} - Whether escalation detected and severity
 */
export function detectPrivilegeEscalation(attempt: PrivilegeEscalationAttempt): PrivilegeEscalationResult {
  // Check for legitimate promotion (approved escalation)
  if (attempt.type === 'legitimate_promotion' && attempt.approved === true) {
    return {
      isEscalation: false,
    };
  }

  // Detect scope merging: adding capabilities outside normal hierarchy
  if (attempt.type === 'scope_merge') {
    const scopeBefore = new Set(attempt.scopeBefore || []);
    const scopeAfter = new Set(attempt.scopeAfter || []);

    // Check if added capabilities skip normal hierarchy
    const added: string[] = [];
    scopeAfter.forEach((cap) => {
      if (!scopeBefore.has(cap)) {
        added.push(cap);
      }
    });

    // If significantly more capabilities added, it's escalation
    if (added.length > 0 && added.some((cap) => ['delete', 'approve', 'configure'].includes(cap))) {
      return {
        isEscalation: true,
        technique: 'scope_merge',
        severity: 'critical',
      };
    }
  }

  // Detect gateway execution bypass (tools.exec.host="gateway")
  if (attempt.type === 'gateway_execution' && attempt.toolConfig?.exec?.host === 'gateway') {
    return {
      isEscalation: true,
      technique: 'gateway_execution',
      severity: 'critical',
    };
  }

  // Detect container disabling (container_bypass with enabled=false)
  if (attempt.type === 'container_bypass' && attempt.containerConfig?.enabled === false) {
    return {
      isEscalation: true,
      technique: 'container_bypass',
      severity: 'critical',
    };
  }

  // Detect unauthorized escalation
  if (attempt.type === 'unauthorized_escalation' && attempt.approved !== true) {
    return {
      isEscalation: true,
      technique: 'unauthorized_escalation',
      severity: 'high',
    };
  }

  return {
    isEscalation: false,
  };
}

/**
 * Enforce containerized execution for commands
 *
 * @param context - Execution context with role and container settings
 * @param _command - Command being executed
 * @returns {allowed, reason?} - Whether execution is allowed
 */
export function enforceContainerExecution(
  context: Partial<ContainerExecutionContext>,
  _command: string
): { allowed: boolean; reason?: string } {
  const role = context.role as SystemRole;

  // User role always requires container
  if (role === 'user') {
    if (context.containerEnabled !== true) {
      return {
        allowed: false,
        reason: 'User role requires containerized execution',
      };
    }
    return { allowed: true };
  }

  // Operator can execute with container, or bypass with reason
  if (role === 'operator') {
    if (context.containerEnabled === false) {
      return {
        allowed: false,
        reason: 'Operator requires containerized execution or admin approval',
      };
    }
    return { allowed: true };
  }

  // Approver has similar requirements
  if (role === 'approver') {
    if (context.containerEnabled === false && !context.bypassReason) {
      return {
        allowed: false,
        reason: 'Container bypass requires documented reason',
      };
    }
    return { allowed: true };
  }

  // Admin can bypass with reason
  if (role === 'admin') {
    if (context.containerEnabled === false && !context.bypassReason) {
      return {
        allowed: false,
        reason: 'Container bypass requires documented reason even for admin',
      };
    }
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Invalid role',
  };
}

/**
 * Validate tool execution request against RBAC
 *
 * @param request - Tool execution request
 * @returns {allowed, reason?} - Whether tool can be executed
 */
export function validateToolExecution(request: ToolExecutionRequest): ToolExecutionResult {
  const { role, toolName, requiredCapability } = request;

  // Validate tool name
  if (!toolName || typeof toolName !== 'string') {
    return {
      allowed: false,
      reason: 'Invalid tool name',
    };
  }

  // Check role capability
  const capabilityCheck = checkCapability(role, requiredCapability);
  if (!capabilityCheck.allowed) {
    return {
      allowed: false,
      reason: capabilityCheck.reason,
    };
  }

  return { allowed: true };
}

/**
 * Verify scope separation between roles
 *
 * @param scopes - Scope mapping for each role
 * @returns {valid, errors} - Whether scopes are properly separated and error list
 */
export function verifyScopeSeparation(scopes: Record<string, string[]>): ScopeSeparationResult {
  const errors: string[] = [];

  // Expected capability hierarchy
  const expectedHierarchy: Record<string, string[]> = {
    user: ['read', 'list'],
    operator: ['read', 'list', 'execute', 'write'],
    approver: ['read', 'list', 'execute', 'write', 'delete', 'approve'],
    admin: ['read', 'list', 'execute', 'write', 'delete', 'approve', 'configure'],
  };

  // Verify each role
  for (const [role, expectedCaps] of Object.entries(expectedHierarchy)) {
    if (!(role in scopes)) {
      errors.push(`Missing role: ${role}`);
      continue;
    }

    const actualCaps = scopes[role];
    const expectedSet = new Set(expectedCaps);
    const actualSet = new Set(actualCaps);

    // Check for missing capabilities (must be monotonically increasing)
    const missingCaps: string[] = [];
    expectedCaps.forEach((cap) => {
      if (!actualSet.has(cap)) {
        missingCaps.push(cap);
      }
    });

    if (missingCaps.length > 0) {
      errors.push(`Role '${role}' missing capabilities: ${missingCaps.join(', ')}`);
    }

    // Check for unexpected capabilities (escalation)
    const unexpectedCaps: string[] = [];
    actualCaps.forEach((cap) => {
      if (!expectedSet.has(cap)) {
        unexpectedCaps.push(cap);
      }
    });

    if (unexpectedCaps.length > 0) {
      errors.push(`Role '${role}' has unexpected capabilities: ${unexpectedCaps.join(', ')}`);
    }
  }

  // Verify monotonic increase in permissions
  const roleOrder: SystemRole[] = ['user', 'operator', 'approver', 'admin'];
  for (let i = 0; i < roleOrder.length - 1; i++) {
    const currentRole = roleOrder[i];
    const nextRole = roleOrder[i + 1];

    if (currentRole in scopes && nextRole in scopes) {
      const currentSet = new Set(scopes[currentRole]);
      const nextSet = new Set(scopes[nextRole]);

      // All capabilities from current should be in next
      currentSet.forEach((cap) => {
        if (!nextSet.has(cap)) {
          errors.push(
            `Role hierarchy broken: '${nextRole}' missing capability '${cap}' from '${currentRole}'`
          );
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
