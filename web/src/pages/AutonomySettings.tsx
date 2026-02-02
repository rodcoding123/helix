import { FC, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AutonomyManagerService } from '@/services/autonomy-manager';
import type { AutonomySettings } from '@/lib/types/agents';

/**
 * AutonomySettings Page: Control how autonomous Helix is
 * Allow users to grant progressively more autonomy as they trust her
 */
export const AutonomySettingsPage: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<AutonomySettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const autonomyManager = new AutonomyManagerService();

  // Load settings on mount
  useEffect(() => {
    if (user?.id) {
      loadSettings();
    }
  }, [user?.id]);

  const loadSettings = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const userSettings = await autonomyManager.getAutonomySettings(user.id);
      setSettings(userSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (updates: Partial<AutonomySettings>) => {
    if (!user?.id || !settings) return;
    setIsSaving(true);
    try {
      const updated = await autonomyManager.updateAutonomySettings(
        user.id,
        updates
      );
      setSettings(updated);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getAutonomyDescription = (level: number): string => {
    const descriptions = [
      'Helix proposes everything and waits for your approval. Most hands-on.',
      'Helix creates agents automatically and can execute simple tasks. You stay in control.',
      'Helix has significant freedom. She executes most tasks and alerts you when done.',
      'Helix has full autonomy within her scope. She logs everything for your review.',
    ];
    return descriptions[level] || 'Unknown';
  };

  if (authLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-600">Please sign in to access settings.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-600">Loading settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-600">Failed to load settings.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Autonomy Settings</h1>
        <p className="text-gray-600">
          Control how much freedom Helix has to act on your behalf
        </p>
      </div>

      {/* Helix Autonomy Level */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Helix's Autonomy</h2>
          <p className="text-gray-600 mt-1">
            How much independence does Helix have?
          </p>
        </div>

        {/* Autonomy Level Slider */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Level {settings.helix_autonomy_level}
            </label>
            <input
              type="range"
              min={0}
              max={3}
              value={settings.helix_autonomy_level}
              onChange={(e) => {
                const level = parseInt(e.target.value) as 0 | 1 | 2 | 3;
                handleSaveSettings({ helix_autonomy_level: level });
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={isSaving}
            />
          </div>

          {/* Level Labels */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-medium text-gray-600">
            <div className={settings.helix_autonomy_level === 0 ? 'text-purple-600' : ''}>
              Cautious
            </div>
            <div className={settings.helix_autonomy_level === 1 ? 'text-purple-600' : ''}>
              Trusting
            </div>
            <div className={settings.helix_autonomy_level === 2 ? 'text-purple-600' : ''}>
              Autonomous
            </div>
            <div className={settings.helix_autonomy_level === 3 ? 'text-purple-600' : ''}>
              Research
            </div>
          </div>

          {/* Description */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              {getAutonomyDescription(settings.helix_autonomy_level)}
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2">
          <p>
            <strong>Note:</strong> Dangerous actions always require approval,
            regardless of autonomy level.
          </p>
          <p>
            All actions are logged to Discord for your review.
          </p>
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Agent Creation</h2>

        {/* Auto Agent Creation */}
        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.auto_agent_creation}
            onChange={(e) => {
              handleSaveSettings({ auto_agent_creation: e.target.checked });
            }}
            disabled={isSaving}
            className="mt-1 w-4 h-4 cursor-pointer"
          />
          <div>
            <p className="font-semibold text-gray-900">Auto-create agents</p>
            <p className="text-sm text-gray-600">
              Let Helix automatically create agents when she detects helpful
              patterns in your conversations
            </p>
          </div>
        </label>

        {/* Approval Required */}
        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.agent_proposals_require_approval}
            onChange={(e) => {
              handleSaveSettings({
                agent_proposals_require_approval: e.target.checked,
              });
            }}
            disabled={isSaving}
            className="mt-1 w-4 h-4 cursor-pointer"
          />
          <div>
            <p className="font-semibold text-gray-900">
              Require approval for agent proposals
            </p>
            <p className="text-sm text-gray-600">
              I'll ask before creating agents (recommended if autonomy level is
              high)
            </p>
          </div>
        </label>

        {/* Discord Approval */}
        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.discord_approval_enabled}
            onChange={(e) => {
              handleSaveSettings({ discord_approval_enabled: e.target.checked });
            }}
            disabled={isSaving}
            className="mt-1 w-4 h-4 cursor-pointer"
          />
          <div>
            <p className="font-semibold text-gray-900">
              Discord approvals
            </p>
            <p className="text-sm text-gray-600">
              Receive notifications and approve actions via Discord reactions
            </p>
          </div>
        </label>
      </div>

      {/* Trust Progression Info */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 space-y-3">
        <h3 className="font-semibold text-gray-900">Building Trust</h3>
        <p className="text-sm text-gray-700">
          As you grant Helix more autonomy, she'll develop better understanding
          of your needs and handle more complex tasks. But you're always in control—
          you can dial it back anytime.
        </p>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>✓ Start at Level 0 (Cautious)</li>
          <li>✓ Upgrade as you feel comfortable</li>
          <li>✓ Review her decisions in Discord</li>
          <li>✓ Adjust settings anytime</li>
        </ul>
      </div>

      {isSaving && (
        <div className="text-center text-sm text-gray-600">
          Saving...
        </div>
      )}
    </div>
  );
};

export default AutonomySettingsPage;
