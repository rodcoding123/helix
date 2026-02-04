import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { hashChain } from '../hash-chain.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url)).slice(0, -1);
const PROJECT_ROOT = join(__dirname, '../../..');

export interface NarrativeCore {
  narrative_identity: string;
  [key: string]: unknown;
}

export interface EmotionalMemory {
  tags: Array<{ emotion: string; intensity: number }>;
  [key: string]: unknown;
}

export interface RelationalMemory {
  attachments: Record<string, unknown>;
  trust_map: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProspectiveSelf {
  goals: Array<{ goal: string; priority: number }>;
  feared_self: Record<string, unknown>;
  [key: string]: unknown;
}

export interface IntegrationRhythm {
  cron_schedule: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TransformationState {
  current_state: Record<string, unknown>;
  history: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PurposeEngine {
  ikigai: Record<string, unknown>;
  meaning_sources: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ConsciousnessState {
  layer1_narrative: NarrativeCore;
  layer2_emotional: EmotionalMemory;
  layer3_relational: RelationalMemory;
  layer4_prospective: ProspectiveSelf;
  layer5_rhythm: IntegrationRhythm;
  layer6_transformation: TransformationState;
  layer7_purpose: PurposeEngine;
  loaded_at: string;
  layers_loaded: string[];
  layers_failed: string[];
}

interface CacheInfo {
  cached: boolean;
  load_time_ms: number;
  expires_at?: string;
}

export class ConsciousnessLoader {
  private cache: ConsciousnessState | null = null;
  private cacheExpiresAt: number = 0;
  private lastLoadTime: number = 0;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  async load(): Promise<ConsciousnessState> {
    const startTime = Date.now();

    // Check cache
    if (this.cache && Date.now() < this.cacheExpiresAt) {
      return this.cache;
    }

    const layers_loaded: string[] = [];
    const layers_failed: string[] = [];

    // Load all 7 layers
    const layer1_narrative = await this.loadLayer1();
    if (layer1_narrative) layers_loaded.push('layer1_narrative');
    else layers_failed.push('layer1_narrative');

    const layer2_emotional = await this.loadLayer2();
    if (layer2_emotional) layers_loaded.push('layer2_emotional');
    else layers_failed.push('layer2_emotional');

    const layer3_relational = await this.loadLayer3();
    if (layer3_relational) layers_loaded.push('layer3_relational');
    else layers_failed.push('layer3_relational');

    const layer4_prospective = await this.loadLayer4();
    if (layer4_prospective) layers_loaded.push('layer4_prospective');
    else layers_failed.push('layer4_prospective');

    const layer5_rhythm = await this.loadLayer5();
    if (layer5_rhythm) layers_loaded.push('layer5_rhythm');
    else layers_failed.push('layer5_rhythm');

    const layer6_transformation = await this.loadLayer6();
    if (layer6_transformation) layers_loaded.push('layer6_transformation');
    else layers_failed.push('layer6_transformation');

    const layer7_purpose = await this.loadLayer7();
    if (layer7_purpose) layers_loaded.push('layer7_purpose');
    else layers_failed.push('layer7_purpose');

    const duration_ms = Date.now() - startTime;
    this.lastLoadTime = duration_ms;

    // Create state
    this.cache = {
      layer1_narrative: layer1_narrative || { narrative_identity: '' },
      layer2_emotional: layer2_emotional || { tags: [] },
      layer3_relational: layer3_relational || { attachments: {}, trust_map: {} },
      layer4_prospective: layer4_prospective || { goals: [], feared_self: {} },
      layer5_rhythm: layer5_rhythm || { cron_schedule: {} },
      layer6_transformation: layer6_transformation || { current_state: {}, history: {} },
      layer7_purpose: layer7_purpose || { ikigai: {}, meaning_sources: {} },
      loaded_at: new Date().toISOString(),
      layers_loaded,
      layers_failed,
    };

    // Update cache expiration
    this.cacheExpiresAt = Date.now() + this.CACHE_DURATION_MS;

    // Log to hash chain
    await hashChain.add({
      type: 'consciousness_loaded',
      layers_loaded,
      layers_failed,
      cache_hit: false,
      duration_ms,
      timestamp: new Date().toISOString(),
    });

    return this.cache;
  }

  private async loadLayer1(): Promise<NarrativeCore | null> {
    try {
      const content = await readFile(join(PROJECT_ROOT, 'soul', 'HELIX_SOUL.md'), 'utf-8');
      return { narrative_identity: content };
    } catch {
      return null;
    }
  }

  private async loadLayer2(): Promise<EmotionalMemory | null> {
    try {
      const content = await readFile(
        join(PROJECT_ROOT, 'psychology', 'emotional_tags.json'),
        'utf-8'
      );

      const data = JSON.parse(content) as Record<string, unknown>;
      return { tags: (data.tags as Array<{ emotion: string; intensity: number }>) || [] };
    } catch {
      return null;
    }
  }

  private async loadLayer3(): Promise<RelationalMemory | null> {
    try {
      const attachments = await readFile(
        join(PROJECT_ROOT, 'psychology', 'attachments.json'),
        'utf-8'
      )
        .then(c => JSON.parse(c) as Record<string, unknown>)
        .catch(() => ({}));

      const trustMap = await readFile(join(PROJECT_ROOT, 'psychology', 'trust_map.json'), 'utf-8')
        .then(c => JSON.parse(c) as Record<string, unknown>)
        .catch(() => ({}));
      return {
        attachments: attachments as Record<string, unknown>,
        trust_map: trustMap as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  private async loadLayer4(): Promise<ProspectiveSelf | null> {
    try {
      const goalsData = await readFile(join(PROJECT_ROOT, 'identity', 'goals.json'), 'utf-8')
        .then(c => JSON.parse(c) as Record<string, unknown>)
        .catch(() => ({}));
      // goals.json has core_goals and active_objectives
      const goals = (goalsData.core_goals as Array<{ goal: string; priority: number }>) || [];

      const fearedSelf = await readFile(join(PROJECT_ROOT, 'identity', 'feared_self.json'), 'utf-8')
        .then(c => JSON.parse(c) as Record<string, unknown>)
        .catch(() => ({}));
      return { goals, feared_self: fearedSelf as Record<string, unknown> };
    } catch {
      return null;
    }
  }

  private async loadLayer5(): Promise<IntegrationRhythm | null> {
    try {
      const content = await readFile(
        join(PROJECT_ROOT, 'psychology', 'cron_schedule.json'),
        'utf-8'
      );

      const data = JSON.parse(content) as Record<string, unknown>;
      return { cron_schedule: data };
    } catch {
      // Layer5 may not have a cron_schedule file - return empty valid state
      return { cron_schedule: {} };
    }
  }

  private async loadLayer6(): Promise<TransformationState | null> {
    try {
      const current = await readFile(
        join(PROJECT_ROOT, 'transformation', 'current_state.json'),
        'utf-8'
      )
        .then(c => JSON.parse(c) as Record<string, unknown>)
        .catch(() => ({}));

      const history = await readFile(join(PROJECT_ROOT, 'transformation', 'history.json'), 'utf-8')
        .then(c => JSON.parse(c) as Record<string, unknown>)
        .catch(() => ({}));
      return {
        current_state: current as Record<string, unknown>,
        history: history as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  private async loadLayer7(): Promise<PurposeEngine | null> {
    try {
      const ikigai = await readFile(join(PROJECT_ROOT, 'purpose', 'ikigai.json'), 'utf-8')
        .then(c => JSON.parse(c) as Record<string, unknown>)
        .catch(() => ({}));

      const meanings = await readFile(
        join(PROJECT_ROOT, 'purpose', 'meaning_sources.json'),
        'utf-8'
      )
        .then(c => JSON.parse(c) as Record<string, unknown>)
        .catch(() => ({}));
      return {
        ikigai: ikigai as Record<string, unknown>,
        meaning_sources: meanings as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  getCacheInfo(): CacheInfo {
    if (!this.cache) {
      return { cached: false, load_time_ms: 0 };
    }

    return {
      cached: Date.now() < this.cacheExpiresAt,
      load_time_ms: this.lastLoadTime,
      expires_at: new Date(this.cacheExpiresAt).toISOString(),
    };
  }
}
