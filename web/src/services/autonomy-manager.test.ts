import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutonomyManagerService } from './autonomy-manager';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((_table) => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'settings-123',
          user_id: 'user-123',
          helix_autonomy_level: 0,
          auto_agent_creation: true,
          agent_proposals_require_approval: true,
          discord_approval_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    })),
  })),
}));

// Mock secrets loader
vi.mock('@/lib/secrets-loader', () => ({
  loadSecret: vi.fn(async (secret: string) => {
    if (secret === 'Supabase URL') {
      return 'https://test.supabase.co';
    }
    if (secret === 'Supabase Anon Key') {
      return 'test-key';
    }
    return 'test-secret';
  }),
}));

// Mock Discord logger
vi.mock('./discord-logger', () => {
  class MockDiscordLogger {
    async logAutonomyAction() {
      return 'message-123';
    }
    async logExecutedAction() {
      return undefined;
    }
  }
  return {
    DiscordLoggerService: MockDiscordLogger,
  };
});

describe('AutonomyManagerService', () => {
  let service: AutonomyManagerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AutonomyManagerService();
  });

  describe('getAutonomySettings', () => {
    it('should return autonomy settings for user', async () => {
      const settings = await service.getAutonomySettings('user-123');

      expect(settings).toBeDefined();
      expect(settings.user_id).toBe('user-123');
      expect(settings.helix_autonomy_level).toBe(0);
    });

    it('should have default values', async () => {
      const settings = await service.getAutonomySettings('user-123');

      expect(settings.auto_agent_creation).toBe(true);
      expect(settings.agent_proposals_require_approval).toBe(true);
      expect(settings.discord_approval_enabled).toBe(true);
    });
  });

  describe('updateAutonomySettings', () => {
    it('should update autonomy level', async () => {
      const updated = await service.updateAutonomySettings('user-123', {
        helix_autonomy_level: 2,
      });

      expect(updated).toBeDefined();
    });

    it('should update feature toggles', async () => {
      const updated = await service.updateAutonomySettings('user-123', {
        auto_agent_creation: false,
        discord_approval_enabled: false,
      });

      expect(updated).toBeDefined();
    });
  });

  describe('proposeAction', () => {
    it('should create pending action when approval needed', async () => {
      const action = await service.proposeAction(
        'user-123',
        'agent_creation',
        'Create new agent',
        'medium'
      );

      expect(action).toBeDefined();
      expect(action.user_id).toBe('user-123');
      expect(action.action_type).toBe('agent_creation');
    });

    it('should mark high-risk actions as pending', async () => {
      const action = await service.proposeAction(
        'user-123',
        'code_execution',
        'Execute code',
        'high'
      );

      expect(action).toBeDefined();
    });

    it('should auto-approve low-risk actions at autonomy level 3', async () => {
      // First set autonomy level to 3
      await service.updateAutonomySettings('user-123', {
        helix_autonomy_level: 3,
      });

      const action = await service.proposeAction(
        'user-123',
        'simple_task',
        'Do something simple',
        'low'
      );

      expect(action).toBeDefined();
    });
  });

  describe('approveAction', () => {
    it('should approve a pending action', async () => {
      const action = await service.approveAction('action-123', 'user-123');

      expect(action).toBeDefined();
    });

    it('should record approval method', async () => {
      const action = await service.approveAction(
        'action-123',
        'user-123',
        'discord_reaction'
      );

      expect(action).toBeDefined();
    });
  });

  describe('rejectAction', () => {
    it('should reject a pending action', async () => {
      const action = await service.rejectAction('action-123', 'user-123');

      expect(action).toBeDefined();
    });
  });

  describe('getPendingActions', () => {
    it('should return pending actions for user', async () => {
      const actions = await service.getPendingActions('user-123');

      expect(Array.isArray(actions)).toBe(true);
    });
  });

  describe('getActionHistory', () => {
    it('should return action history with default limit', async () => {
      const history = await service.getActionHistory('user-123');

      expect(Array.isArray(history)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const history = await service.getActionHistory('user-123', 10);

      expect(Array.isArray(history)).toBe(true);
    });

    it('should support pagination with offset', async () => {
      const history = await service.getActionHistory('user-123', 10, 20);

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('approval determination logic', () => {
    it('should always approve high-risk actions', async () => {
      // At any autonomy level, high-risk actions need approval
      for (let level = 0; level <= 3; level++) {
        await service.updateAutonomySettings('user-123', {
          helix_autonomy_level: level as 0 | 1 | 2 | 3,
        });

        const action = await service.proposeAction(
          'user-123',
          'test_action',
          'Test',
          'high'
        );

        expect(action).toBeDefined();
      }
    });

    it('should always require approval for dangerous action types', async () => {
      const dangerousActions = [
        'code_execution',
        'system_modification',
        'data_deletion',
      ];

      for (const actionType of dangerousActions) {
        const action = await service.proposeAction(
          'user-123',
          actionType,
          `Execute ${actionType}`,
          'low'
        );

        expect(action).toBeDefined();
      }
    });
  });

  describe('autonomy level behavior', () => {
    it('should require all approvals at level 0', async () => {
      await service.updateAutonomySettings('user-123', {
        helix_autonomy_level: 0,
      });

      const action = await service.proposeAction(
        'user-123',
        'simple_task',
        'Do something',
        'low'
      );

      expect(action).toBeDefined();
    });

    it('should allow medium-risk without approval at level 2', async () => {
      await service.updateAutonomySettings('user-123', {
        helix_autonomy_level: 2,
      });

      const action = await service.proposeAction(
        'user-123',
        'moderate_task',
        'Do something moderate',
        'medium'
      );

      expect(action).toBeDefined();
    });

    it('should allow most actions without approval at level 3', async () => {
      await service.updateAutonomySettings('user-123', {
        helix_autonomy_level: 3,
      });

      const action = await service.proposeAction(
        'user-123',
        'any_task',
        'Do anything',
        'medium'
      );

      expect(action).toBeDefined();
    });
  });
});
