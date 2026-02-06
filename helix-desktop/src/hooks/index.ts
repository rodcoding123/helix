// Export all hooks
export { useGateway } from './useGateway';
export { useConfig, type HelixConfig } from './useConfig';
export { useKeyring, KEYRING_KEYS, type KeyringKey } from './useKeyring';
export { useSystem, type SystemInfo, type HelixPaths } from './useSystem';
export { useStreaming, type GatewayMessage } from './useStreaming';
export { usePsychology, type PsychologyLayer, type PsychologyState } from './usePsychology';
export { useSession, type ChatSession } from './useSession';
export { useTheme } from './useTheme';
export { useMemory, type MemoryEntry, type MemoryStats, type MemorySearchResult } from './useMemory';
export { useOnboarding, type OnboardingStep, type OnboardingData, type OnboardingState } from './useOnboarding';
export { useOAuth, type OAuthStatus } from './useOAuth';
export { useSecretsData, type SecretsDataResult } from './useSecretsData';

// Phase 3: Custom Tools, Composite Skills, Memory Synthesis
export { useCustomTools } from './useCustomTools';
export { useCompositeSkills } from './useCompositeSkills';
export { useMemorySynthesis } from './useMemorySynthesis';

// Phase 4.1: Voice Features (Real-time Voice, Recording, Commands)
export { useVoiceRecorder } from './useVoiceRecorder';
export type { WebRTCVoiceState, WebRTCVoiceControls } from './useWebRTCVoice';
export { useWebRTCVoice } from './useWebRTCVoice';

// Phase C: Tauri Desktop Features
export { useTauriFileOps } from './useTauriFileOps';

// Gateway config synchronization
export { useGatewayConfig } from './useGatewayConfig';

// Phase J2: System Tray live state sync
export { useTraySync } from './useTraySync';

// Phase J: Deep Linking
export { useDeepLink } from './useDeepLink';
export type { DeepLinkAction, DeepLinkActionType, UseDeepLinkReturn } from './useDeepLink';

// Phase J: Keyboard Shortcuts System
export {
  useGlobalShortcuts,
  useShortcutRecorder,
  useShortcutListener,
  getPlatformModifier,
  isMacPlatform,
  formatShortcut,
  formatKeyName,
  getShortcutFingerprint,
  detectConflicts,
  applyOverrides,
  recordedToBinding,
  serializeOverrides,
  deserializeOverrides,
  onShortcut,
  DEFAULT_SHORTCUT_BINDINGS,
} from './useGlobalShortcuts';
export type {
  ShortcutDefinition,
  ShortcutCategory,
  ShortcutBinding,
  ShortcutOverrides,
  ShortcutConflict,
  ShortcutEvent,
  RecordedBinding,
  UseGlobalShortcutsOptions,
  UseGlobalShortcutsReturn,
  UseShortcutRecorderReturn,
} from './useGlobalShortcuts';

// Phase 2.3: Orchestrator Metrics Monitoring
export { useOrchestratorMetrics, useOrchestratorMetricsController } from './useOrchestratorMetrics';
export type {
  OrchestratorMetricsSnapshot,
  OrchestratorCheckpointSnapshot,
  OrchestratorCostBurnRate,
  OrchestratorEvent,
  OrchestratorEventType,
  OrchestratorStateChangeEvent,
  OrchestratorCostUpdateEvent,
  OrchestratorAgentActiveEvent,
  OrchestratorCheckpointSavedEvent,
  OrchestratorMetricsState,
  UseOrchestratorMetricsOptions,
} from '../lib/types/orchestrator-metrics';
