import { useParams } from 'react-router-dom';
import { SettingsLayout } from '../components/settings/SettingsLayout';
import { GeneralSettings } from '../components/settings/GeneralSettings';
import { ModelSettings } from '../components/settings/ModelSettings';
import { ChannelsSettings } from '../components/settings/ChannelsSettings';
import { VoiceSettings } from '../components/settings/VoiceSettings';
import { ToolsSettings } from '../components/settings/ToolsSettings';
import { SkillsSettings } from '../components/settings/SkillsSettings';
import { AutomationSettings } from '../components/settings/AutomationSettings';
import { AgentsSettings } from '../components/settings/AgentsSettings';
import { PrivacySettings } from '../components/settings/PrivacySettings';
import { PsychologySettings } from '../components/settings/PsychologySettings';
import { SecretsSettings } from '../components/settings/SecretsSettings';
import { HooksManager } from '../components/hooks';
import { AdvancedSettings } from '../components/settings/AdvancedSettings';
import { KeyboardShortcuts } from '../components/settings/KeyboardShortcuts';
import { AuthProfileManager } from '../components/auth';
import { FailoverChainEditor } from '../components/models';
import { EnvironmentVariables } from '../components/settings/EnvironmentVariables';

type SettingsSection =
  | 'general'
  | 'model'
  | 'channels'
  | 'voice'
  | 'tools'
  | 'skills'
  | 'automation'
  | 'agents'
  | 'privacy'
  | 'psychology'
  | 'secrets'
  | 'hooks'
  | 'advanced'
  | 'shortcuts'
  | 'auth-profiles'
  | 'failover'
  | 'environment';

const SETTINGS_COMPONENTS: Record<SettingsSection, React.ComponentType> = {
  general: GeneralSettings,
  model: ModelSettings,
  channels: ChannelsSettings,
  voice: VoiceSettings,
  tools: ToolsSettings,
  skills: SkillsSettings,
  automation: AutomationSettings,
  agents: AgentsSettings,
  privacy: PrivacySettings,
  psychology: PsychologySettings,
  secrets: SecretsSettings,
  hooks: HooksManager,
  advanced: AdvancedSettings,
  shortcuts: KeyboardShortcuts,
  'auth-profiles': AuthProfileManager,
  failover: FailoverChainEditor,
  environment: EnvironmentVariables,
};

/**
 * Settings route - renders settings layout with appropriate section
 */
export default function Settings() {
  const { section = 'general' } = useParams<{ section?: string }>();

  const normalizedSection = section as SettingsSection;
  const SettingsComponent = SETTINGS_COMPONENTS[normalizedSection] || GeneralSettings;

  return (
    <SettingsLayout activeSection={normalizedSection}>
      <SettingsComponent />
    </SettingsLayout>
  );
}
