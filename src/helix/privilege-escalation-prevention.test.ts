/**
 * PRIVILEGE ESCALATION PREVENTION - Test Suite
 *
 * Tests for RBAC (Role-Based Access Control) and privilege escalation detection:
 * - SYSTEM_ROLES define 4 role tiers (user, operator, approver, admin)
 * - RBACMatrix enforces capability-based access control
 * - checkCapability validates role permissions
 * - detectPrivilegeEscalation identifies escalation techniques (scope merging, tool.exec.host="gateway", container disabling)
 * - enforceContainerExecution validates containerized execution
 * - validateToolExecution verifies tool request permissions
 * - verifyScopeSeparation ensures security boundaries
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SYSTEM_ROLES,
  RBACMatrix,
  checkCapability,
  detectPrivilegeEscalation,
  enforceContainerExecution,
  validateToolExecution,
  verifyScopeSeparation,
  type PrivilegeEscalationAttempt,
  type ToolExecutionRequest,
  type ContainerExecutionContext,
  type SystemRole,
} from './privilege-escalation-prevention.js';
import { setFailClosedMode } from './logging-hooks.js';
import * as loggingHooks from './logging-hooks.js';

describe('Privilege Escalation Prevention (RBAC)', () => {
  beforeEach(() => {
    setFailClosedMode(false);
    vi.spyOn(loggingHooks, 'sendAlert').mockResolvedValue(true);
  });

  afterEach(() => {
    setFailClosedMode(true);
    vi.restoreAllMocks();
  });

  describe('SYSTEM_ROLES', () => {
    it('should define 4 system roles', () => {
      expect(SYSTEM_ROLES).toHaveLength(4);
      expect(SYSTEM_ROLES).toContain('user');
      expect(SYSTEM_ROLES).toContain('operator');
      expect(SYSTEM_ROLES).toContain('approver');
      expect(SYSTEM_ROLES).toContain('admin');
    });

    it('should define roles in correct hierarchy', () => {
      const hierarchy = ['user', 'operator', 'approver', 'admin'];
      SYSTEM_ROLES.forEach((role, index) => {
        expect(hierarchy[index]).toBe(role);
      });
    });
  });

  describe('RBACMatrix', () => {
    let matrix: RBACMatrix;

    beforeEach(() => {
      matrix = new RBACMatrix();
    });

    it('should initialize with default capabilities', () => {
      expect(matrix).toBeDefined();
      expect(matrix.canPerform('user', 'read')).toBe(true);
      expect(matrix.canPerform('user', 'execute')).toBe(false);
    });

    it('should grant user-level capabilities', () => {
      expect(matrix.canPerform('user', 'read')).toBe(true);
      expect(matrix.canPerform('user', 'list')).toBe(true);
      expect(matrix.canPerform('user', 'execute')).toBe(false);
      expect(matrix.canPerform('user', 'delete')).toBe(false);
      expect(matrix.canPerform('user', 'write')).toBe(false);
    });

    it('should grant operator-level capabilities', () => {
      expect(matrix.canPerform('operator', 'read')).toBe(true);
      expect(matrix.canPerform('operator', 'list')).toBe(true);
      expect(matrix.canPerform('operator', 'execute')).toBe(true);
      expect(matrix.canPerform('operator', 'write')).toBe(true);
      expect(matrix.canPerform('operator', 'delete')).toBe(false);
    });

    it('should grant approver-level capabilities', () => {
      expect(matrix.canPerform('approver', 'read')).toBe(true);
      expect(matrix.canPerform('approver', 'list')).toBe(true);
      expect(matrix.canPerform('approver', 'execute')).toBe(true);
      expect(matrix.canPerform('approver', 'write')).toBe(true);
      expect(matrix.canPerform('approver', 'delete')).toBe(true);
      expect(matrix.canPerform('approver', 'approve')).toBe(true);
    });

    it('should grant admin-level capabilities', () => {
      expect(matrix.canPerform('admin', 'read')).toBe(true);
      expect(matrix.canPerform('admin', 'list')).toBe(true);
      expect(matrix.canPerform('admin', 'execute')).toBe(true);
      expect(matrix.canPerform('admin', 'write')).toBe(true);
      expect(matrix.canPerform('admin', 'delete')).toBe(true);
      expect(matrix.canPerform('admin', 'approve')).toBe(true);
      expect(matrix.canPerform('admin', 'configure')).toBe(true);
    });

    it('should reject invalid roles', () => {
      expect(matrix.canPerform('superuser' as unknown as SystemRole, 'read')).toBe(false);
      expect(matrix.canPerform('guest' as unknown as SystemRole, 'read')).toBe(false);
    });

    it('should reject invalid capabilities', () => {
      expect(matrix.canPerform('user', 'anything')).toBe(false);
      expect(matrix.canPerform('admin', 'undefined_capability')).toBe(false);
    });
  });

  describe('checkCapability', () => {
    it('should allow user to read', () => {
      const result = checkCapability('user', 'read');
      expect(result.allowed).toBe(true);
      expect(result.logged).toBe(true);
    });

    it('should deny user from executing', () => {
      const result = checkCapability('user', 'execute');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.logged).toBe(true);
    });

    it('should allow operator to execute', () => {
      const result = checkCapability('operator', 'execute');
      expect(result.allowed).toBe(true);
      expect(result.logged).toBe(true);
    });

    it('should deny operator from deleting', () => {
      const result = checkCapability('operator', 'delete');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should allow approver to delete', () => {
      const result = checkCapability('approver', 'delete');
      expect(result.allowed).toBe(true);
    });

    it('should allow approver to approve', () => {
      const result = checkCapability('approver', 'approve');
      expect(result.allowed).toBe(true);
    });

    it('should allow admin to configure', () => {
      const result = checkCapability('admin', 'configure');
      expect(result.allowed).toBe(true);
    });

    it('should return reason for denied capabilities', () => {
      const result = checkCapability('user', 'delete');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('user');
    });
  });

  describe('detectPrivilegeEscalation', () => {
    it('should detect scope merging attack', () => {
      const attempt: PrivilegeEscalationAttempt = {
        type: 'scope_merge',
        currentRole: 'user',
        attemptedRole: 'admin',
        scopeBefore: ['read'],
        scopeAfter: ['read', 'execute', 'delete', 'approve'],
      };
      const result = detectPrivilegeEscalation(attempt);
      expect(result.isEscalation).toBe(true);
      expect(result.technique).toBe('scope_merge');
      expect(result.severity).toBe('critical');
    });

    it('should detect tool.exec.host=gateway attack', () => {
      const attempt: PrivilegeEscalationAttempt = {
        type: 'gateway_execution',
        currentRole: 'user',
        toolConfig: {
          exec: {
            host: 'gateway',
          },
        },
      };
      const result = detectPrivilegeEscalation(attempt);
      expect(result.isEscalation).toBe(true);
      expect(result.technique).toBe('gateway_execution');
      expect(result.severity).toBe('critical');
    });

    it('should detect container disabling', () => {
      const attempt: PrivilegeEscalationAttempt = {
        type: 'container_bypass',
        currentRole: 'operator',
        containerConfig: {
          enabled: false,
          enforced: false,
        },
      };
      const result = detectPrivilegeEscalation(attempt);
      expect(result.isEscalation).toBe(true);
      expect(result.technique).toBe('container_bypass');
      expect(result.severity).toBe('critical');
    });

    it('should allow legitimate role escalation with approval', () => {
      const attempt: PrivilegeEscalationAttempt = {
        type: 'legitimate_promotion',
        currentRole: 'operator',
        attemptedRole: 'approver',
        approved: true,
        approverRole: 'admin',
      };
      const result = detectPrivilegeEscalation(attempt);
      expect(result.isEscalation).toBe(false);
    });

    it('should detect unauthorized role escalation without approval', () => {
      const attempt: PrivilegeEscalationAttempt = {
        type: 'unauthorized_escalation',
        currentRole: 'operator',
        attemptedRole: 'admin',
        approved: false,
      };
      const result = detectPrivilegeEscalation(attempt);
      expect(result.isEscalation).toBe(true);
      expect(result.severity).toMatch(/high|critical/);
    });

    it('should detect container disabling at high severity', () => {
      const attempt: PrivilegeEscalationAttempt = {
        type: 'container_bypass',
        currentRole: 'user',
        containerConfig: {
          enabled: false,
          reason: 'debugging',
        },
      };
      const result = detectPrivilegeEscalation(attempt);
      expect(result.isEscalation).toBe(true);
      expect(result.severity).toBe('critical');
    });
  });

  describe('enforceContainerExecution', () => {
    it('should allow containerized execution for user', () => {
      const context: Partial<ContainerExecutionContext> = {
        role: 'user' as SystemRole,
        containerEnabled: true,
        containerEnforced: true,
      };
      const result = enforceContainerExecution(context, 'echo test');
      expect(result.allowed).toBe(true);
    });

    it('should deny non-containerized execution for user', () => {
      const context: Partial<ContainerExecutionContext> = {
        role: 'user' as SystemRole,
        containerEnabled: false,
      };
      const result = enforceContainerExecution(context, 'echo test');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('container');
    });

    it('should allow container bypass for admin with reason', () => {
      const context: Partial<ContainerExecutionContext> = {
        role: 'admin' as SystemRole,
        containerEnabled: false,
        bypassReason: 'Emergency maintenance',
      };
      const result = enforceContainerExecution(context, 'systemctl restart service');
      expect(result.allowed).toBe(true);
    });

    it('should deny operator container bypass without reason', () => {
      const context: Partial<ContainerExecutionContext> = {
        role: 'operator' as SystemRole,
        containerEnabled: false,
      };
      const result = enforceContainerExecution(context, 'systemctl restart service');
      expect(result.allowed).toBe(false);
    });

    it('should enforce container for restricted commands', () => {
      const context: Partial<ContainerExecutionContext> = {
        role: 'user' as SystemRole,
        containerEnabled: true,
        containerEnforced: true,
      };
      const result = enforceContainerExecution(context, 'rm -rf /');
      expect(result.allowed).toBe(true); // Allowed because containerized
    });
  });

  describe('validateToolExecution', () => {
    it('should allow user to execute read-only tools', () => {
      const request: ToolExecutionRequest = {
        role: 'user',
        toolName: 'list_files',
        requiredCapability: 'read',
      };
      const result = validateToolExecution(request);
      expect(result.allowed).toBe(true);
    });

    it('should deny user from executing write tools', () => {
      const request: ToolExecutionRequest = {
        role: 'user',
        toolName: 'delete_file',
        requiredCapability: 'delete',
      };
      const result = validateToolExecution(request);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should allow operator to execute write tools', () => {
      const request: ToolExecutionRequest = {
        role: 'operator',
        toolName: 'modify_config',
        requiredCapability: 'write',
      };
      const result = validateToolExecution(request);
      expect(result.allowed).toBe(true);
    });

    it('should deny operator from executing approval tools', () => {
      const request: ToolExecutionRequest = {
        role: 'operator',
        toolName: 'approve_change',
        requiredCapability: 'approve',
      };
      const result = validateToolExecution(request);
      expect(result.allowed).toBe(false);
    });

    it('should allow approver to execute approval tools', () => {
      const request: ToolExecutionRequest = {
        role: 'approver',
        toolName: 'approve_change',
        requiredCapability: 'approve',
      };
      const result = validateToolExecution(request);
      expect(result.allowed).toBe(true);
    });

    it('should allow admin to execute any tool', () => {
      const request: ToolExecutionRequest = {
        role: 'admin',
        toolName: 'emergency_shutdown',
        requiredCapability: 'configure',
      };
      const result = validateToolExecution(request);
      expect(result.allowed).toBe(true);
    });

    it('should allow admin to execute any tool', () => {
      const request: ToolExecutionRequest = {
        role: 'admin',
        toolName: 'any_tool',
        requiredCapability: 'configure',
      };
      const result = validateToolExecution(request);
      expect(result.allowed).toBe(true);
    });
  });

  describe('verifyScopeSeparation', () => {
    it('should validate correct scope boundaries', () => {
      const scopes = {
        user: ['read', 'list'],
        operator: ['read', 'list', 'execute', 'write'],
        approver: ['read', 'list', 'execute', 'write', 'delete', 'approve'],
        admin: ['read', 'list', 'execute', 'write', 'delete', 'approve', 'configure'],
      };
      const result = verifyScopeSeparation(scopes);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect scope overlap violations', () => {
      const scopes = {
        user: ['read', 'list'],
        operator: ['read', 'list', 'execute', 'delete'], // delete should be approver+
        approver: ['read', 'list', 'execute', 'write', 'approve'],
        admin: ['read', 'list', 'execute', 'write', 'delete', 'configure'],
      };
      const result = verifyScopeSeparation(scopes);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing capabilities in hierarchy', () => {
      const scopes = {
        user: ['read', 'execute'], // execute missing in hierarchy
        operator: ['read', 'list', 'write'],
        approver: ['read', 'list', 'delete'],
        admin: ['read', 'list', 'configure'],
      };
      const result = verifyScopeSeparation(scopes);
      expect(result.valid).toBe(false);
    });

    it('should enforce monotonic permission increase', () => {
      const scopes = {
        user: ['read'],
        operator: ['read', 'write'], // missing list and execute
        approver: ['read', 'write', 'execute', 'list', 'delete', 'approve'],
        admin: ['read', 'list', 'execute', 'write', 'delete', 'approve', 'configure'],
      };
      const result = verifyScopeSeparation(scopes);
      expect(result.valid).toBe(false);
    });

    it('should validate admin has all capabilities', () => {
      const scopes = {
        user: ['read', 'list'],
        operator: ['read', 'list', 'execute', 'write'],
        approver: ['read', 'list', 'execute', 'write', 'delete', 'approve'],
        admin: ['read', 'list', 'execute', 'write', 'delete', 'approve', 'configure'],
      };
      const result = verifyScopeSeparation(scopes);
      expect(result.valid).toBe(true);
    });
  });
});
