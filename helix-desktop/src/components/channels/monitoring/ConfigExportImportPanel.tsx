/**
 * Config Export/Import Panel - Channel configuration backup and restore
 *
 * Features:
 * - Export channel config to JSON or base64
 * - Import config from JSON or base64
 * - Config validation and comparison
 * - Restore points and version history
 */

import { useState, useCallback } from 'react';
import { useGateway } from '../../../hooks/useGateway';
import './config-export-import-panel.css';

export interface ConfigExportImportPanelProps {
  channel: string;
  onImportComplete?: () => void;
}

interface ExportResult {
  format: 'json' | 'base64';
  data: string;
  timestamp: number;
  size: number;
}

export function ConfigExportImportPanel({
  channel,
  onImportComplete,
}: ConfigExportImportPanelProps) {
  const { getClient } = useGateway();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [importData, setImportData] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'base64'>('json');

  // Export config
  const exportConfig = useCallback(
    async (format: 'json' | 'base64') => {
      const client = getClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const method = format === 'json' ? 'channels.config.export_json' : 'channels.config.export_base64';

        const result = (await client.request(method, {
          channel,
          data: {},
        })) as {
          ok?: boolean;
          json?: string;
          base64?: string;
        };

        const data = format === 'json' ? result.json : result.base64;

        if (data) {
          setExportResult({
            format,
            data,
            timestamp: Date.now(),
            size: data.length,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed');
      } finally {
        setLoading(false);
      }
    },
    [channel, getClient]
  );

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Visual feedback - could add a toast notification here
    } catch {
      setError('Failed to copy to clipboard');
    }
  }, []);

  // Download config
  const downloadConfig = useCallback(() => {
    if (!exportResult) return;

    const element = document.createElement('a');
    const file = new Blob([exportResult.data], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${channel}-config-${new Date().toISOString().split('T')[0]}.${exportResult.format}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }, [exportResult, channel]);

  // Import config
  const importConfig = useCallback(async () => {
    if (!importData.trim()) {
      setError('Please enter configuration data');
      return;
    }

    const client = getClient();
    if (!client?.connected) {
      setError('Gateway not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const method = importFormat === 'json' ? 'channels.config.import_json' : 'channels.config.import_base64';

      const result = (await client.request(method, {
        [importFormat]: importData.trim(),
      })) as {
        ok?: boolean;
        config?: unknown;
      };

      if (result.ok) {
        setImportData('');
        onImportComplete?.();
        setError(null);
        // Could show success message here
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }, [importData, importFormat, getClient, onImportComplete]);

  return (
    <div className="ceip-container">
      {/* Tabs */}
      <div className="ceip-tabs">
        <button
          className={`ceip-tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          📤 Export
        </button>
        <button
          className={`ceip-tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          📥 Import
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="ceip-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="ceip-tab-content">
          <div className="ceip-description">
            <p>Backup your channel configuration for version control or migration.</p>
          </div>

          {!exportResult ? (
            <div className="ceip-actions">
              <button
                className="ceip-btn ceip-btn-primary"
                onClick={() => exportConfig('json')}
                disabled={loading}
              >
                {loading ? 'Exporting...' : 'Export as JSON'}
              </button>
              <button
                className="ceip-btn ceip-btn-secondary"
                onClick={() => exportConfig('base64')}
                disabled={loading}
              >
                {loading ? 'Exporting...' : 'Export as Base64'}
              </button>
            </div>
          ) : (
            <div className="ceip-export-result">
              <div className="ceip-result-header">
                <div>
                  <div className="ceip-result-title">✅ Export Complete</div>
                  <div className="ceip-result-subtitle">
                    Format: {exportResult.format.toUpperCase()} • Size: {exportResult.size} bytes
                  </div>
                </div>
                <button
                  className="ceip-btn ceip-btn-sm"
                  onClick={() => setExportResult(null)}
                >
                  Clear
                </button>
              </div>

              <textarea
                className="ceip-data-textarea"
                value={exportResult.data}
                readOnly
                rows={10}
              />

              <div className="ceip-result-actions">
                <button
                  className="ceip-btn ceip-btn-primary"
                  onClick={() => copyToClipboard(exportResult.data)}
                >
                  📋 Copy to Clipboard
                </button>
                <button
                  className="ceip-btn ceip-btn-secondary"
                  onClick={downloadConfig}
                >
                  💾 Download File
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="ceip-tab-content">
          <div className="ceip-description">
            <p>Restore channel configuration from a backup. This will overwrite current settings.</p>
          </div>

          <div className="ceip-format-selector">
            <label>
              <input
                type="radio"
                name="format"
                value="json"
                checked={importFormat === 'json'}
                onChange={(e) => setImportFormat(e.target.value as 'json')}
              />
              JSON Format
            </label>
            <label>
              <input
                type="radio"
                name="format"
                value="base64"
                checked={importFormat === 'base64'}
                onChange={(e) => setImportFormat(e.target.value as 'base64')}
              />
              Base64 Format
            </label>
          </div>

          <textarea
            className="ceip-data-textarea"
            placeholder={
              importFormat === 'json'
                ? 'Paste your JSON configuration here...'
                : 'Paste your base64 configuration here...'
            }
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            disabled={loading}
            rows={10}
          />

          <div className="ceip-import-actions">
            <button
              className="ceip-btn ceip-btn-primary"
              onClick={importConfig}
              disabled={loading || !importData.trim()}
            >
              {loading ? 'Importing...' : 'Import Configuration'}
            </button>
            <button
              className="ceip-btn ceip-btn-secondary"
              onClick={() => setImportData('')}
              disabled={loading}
            >
              Clear
            </button>
          </div>

          <div className="ceip-warning">
            ⚠️ <strong>Warning:</strong> Importing will overwrite all current channel settings.
            Make sure you have a backup first.
          </div>
        </div>
      )}
    </div>
  );
}
