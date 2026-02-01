import { useConfigStore, type MemoryDecayConfig } from '../../stores/configStore';

const LAYERS = [
  { id: 'narrative', name: 'Narrative Core', description: 'Soul and identity foundation' },
  { id: 'emotional', name: 'Emotional Memory', description: 'Affective responses and somatic markers' },
  { id: 'relational', name: 'Relational Memory', description: 'Attachments and trust relationships' },
  { id: 'prospective', name: 'Prospective Self', description: 'Goals, fears, and possibilities' },
  { id: 'integration', name: 'Integration Rhythms', description: 'Memory consolidation cycles' },
  { id: 'transformation', name: 'Transformation', description: 'Change state and history' },
  { id: 'purpose', name: 'Purpose Engine', description: 'Meaning and ikigai' },
] as const;

type LayerKey = (typeof LAYERS)[number]['id'];

export function PsychologySettings() {
  const { config, updateConfig } = useConfigStore();

  const handleEnableChange = (enabled: boolean) => {
    updateConfig('psychology', { enabled });
  };

  const handleLayerToggle = (layerId: LayerKey, enabled: boolean) => {
    updateConfig('psychology', {
      layersEnabled: {
        ...config.psychology.layersEnabled,
        [layerId]: enabled,
      },
    });
  };

  const handleScheduleChange = (schedule: string) => {
    updateConfig('psychology', {
      integrationSchedule: schedule as typeof config.psychology.integrationSchedule,
    });
  };

  const handleDecayUpdate = (updates: Partial<MemoryDecayConfig>) => {
    updateConfig('psychology', {
      memoryDecay: {
        ...config.psychology.memoryDecay,
        ...updates,
      },
    });
  };

  const decayConfig = config.psychology.memoryDecay;

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Psychology Settings</h1>
        <p>Configure the seven-layer psychological architecture</p>
      </header>

      <div className="settings-group">
        <h3>General</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Enable Psychology System</div>
            <div className="settings-item-description">
              Load and use psychological context in conversations
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.psychology.enabled}
              onChange={(e) => handleEnableChange(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Integration Schedule</div>
            <div className="settings-item-description">
              How often to run memory integration
            </div>
          </div>
          <select
            className="settings-select"
            value={config.psychology.integrationSchedule}
            onChange={(e) => handleScheduleChange(e.target.value)}
            disabled={!config.psychology.enabled}
          >
            <option value="manual">Manual Only</option>
            <option value="hourly">Every Hour</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h3>Layer Configuration</h3>

        {LAYERS.map((layer) => (
          <div key={layer.id} className="settings-item">
            <div className="settings-item-info">
              <div className="settings-item-label">{layer.name}</div>
              <div className="settings-item-description">
                {layer.description}
              </div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={config.psychology.layersEnabled[layer.id]}
                onChange={(e) => handleLayerToggle(layer.id, e.target.checked)}
                disabled={!config.psychology.enabled}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        ))}
      </div>

      <div className="settings-group">
        <h3>Memory Decay</h3>
        <p className="settings-group-description">
          Control how memories fade over time (Layer 5: Integration Rhythms)
        </p>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Enable Memory Decay</div>
            <div className="settings-item-description">
              Simulate natural memory fading based on reconsolidation theory
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={decayConfig.enabled}
              onChange={(e) => handleDecayUpdate({ enabled: e.target.checked })}
              disabled={!config.psychology.enabled}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Decay Mode</div>
            <div className="settings-item-description">
              Soft mode preserves all data (can restore later); Hard mode permanently reduces values
            </div>
          </div>
          <select
            className="settings-select"
            value={decayConfig.mode}
            onChange={(e) => handleDecayUpdate({ mode: e.target.value as 'soft' | 'hard' })}
            disabled={!config.psychology.enabled || !decayConfig.enabled}
          >
            <option value="soft">Soft (Preserve Data)</option>
            <option value="hard">Hard (Permanent)</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Decay Rate</div>
            <div className="settings-item-description">
              {Math.round((1 - decayConfig.rate) * 100)}% decay per cycle (lower = faster fade)
            </div>
          </div>
          <input
            type="range"
            className="settings-slider"
            min="0.8"
            max="0.99"
            step="0.01"
            value={decayConfig.rate}
            onChange={(e) => handleDecayUpdate({ rate: parseFloat(e.target.value) })}
            disabled={!config.psychology.enabled || !decayConfig.enabled}
          />
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Minimum Intensity Floor</div>
            <div className="settings-item-description">
              Memories never decay below this level ({Math.round(decayConfig.minimumIntensity * 100)}%)
            </div>
          </div>
          <input
            type="range"
            className="settings-slider"
            min="0"
            max="0.5"
            step="0.05"
            value={decayConfig.minimumIntensity}
            onChange={(e) => handleDecayUpdate({ minimumIntensity: parseFloat(e.target.value) })}
            disabled={!config.psychology.enabled || !decayConfig.enabled}
          />
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Trust Score Decay</div>
            <div className="settings-item-description">
              Allow trust levels to drift toward neutral without reinforcement
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={decayConfig.trustDecayEnabled}
              onChange={(e) => handleDecayUpdate({ trustDecayEnabled: e.target.checked })}
              disabled={!config.psychology.enabled || !decayConfig.enabled}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Preserve High Salience</div>
            <div className="settings-item-description">
              Critical and high-salience memories never decay (identity-preserving)
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={decayConfig.preserveHighSalience}
              onChange={(e) => handleDecayUpdate({ preserveHighSalience: e.target.checked })}
              disabled={!config.psychology.enabled || !decayConfig.enabled}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="settings-group">
        <h3>Actions</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Run Integration Now</div>
            <div className="settings-item-description">
              Manually trigger memory consolidation
            </div>
          </div>
          <button
            className="secondary-button"
            disabled={!config.psychology.enabled}
          >
            Run Integration
          </button>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">View Psychology Files</div>
            <div className="settings-item-description">
              Open the psychology folder in your file explorer
            </div>
          </div>
          <button className="secondary-button">
            Open Folder
          </button>
        </div>
      </div>
    </div>
  );
}
