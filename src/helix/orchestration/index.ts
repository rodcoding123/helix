// src/helix/orchestration/index.ts

// Export consciousness-loader components
export { ConsciousnessLoader } from './consciousness-loader.js';

export type {
  ConsciousnessState,
  NarrativeCore,
  EmotionalMemory,
  RelationalMemory,
  ProspectiveSelf,
  IntegrationRhythm,
  TransformationState,
  PurposeEngine,
} from './consciousness-loader.js';

// Export goal-evaluator components
export { GoalEvaluator } from './goal-evaluator.js';

export type { PersonalityTraits, Goal, Operation, GoalEvaluationResult } from './goal-evaluator.js';

// Export model-spawner components
export { ModelSpawner, modelSpawner } from './model-spawner.js';

export type { ExecutionContext, SpawnedModel, SpawnResult } from './model-spawner.js';

// Export conductor-loop components
export { ConductorLoop, conductorLoop } from './conductor-loop.js';

export type { ConductionCycle, ConductorLoopConfig, LoopStatus } from './conductor-loop.js';
