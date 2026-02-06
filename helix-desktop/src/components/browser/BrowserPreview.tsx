/**
 * BrowserPreview - Screenshot preview component for the browser automation panel
 *
 * Renders a base64-encoded screenshot in a scrollable, zoomable container.
 * Shows loading overlay during refresh and an empty state when no screenshot is available.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowserPreviewProps {
  screenshotData?: string;
  loading?: boolean;
  onRefresh?: () => void;
  onClickSnapshot?: () => void;
  zoom?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrowserPreview({
  screenshotData,
  loading = false,
  onRefresh,
  onClickSnapshot,
  zoom = 1,
}: BrowserPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [internalZoom, setInternalZoom] = useState(zoom);

  // Sync external zoom prop
  useEffect(() => {
    setInternalZoom(zoom);
  }, [zoom]);

  const handleZoomFit = useCallback(() => {
    setInternalZoom(0); // 0 = fit to container
  }, []);

  const handleZoom100 = useCallback(() => {
    setInternalZoom(1);
  }, []);

  const handleZoom200 = useCallback(() => {
    setInternalZoom(2);
  }, []);

  const imageStyle: React.CSSProperties = internalZoom === 0
    ? { width: '100%', height: 'auto', objectFit: 'contain' as const }
    : { width: `${internalZoom * 100}%`, height: 'auto' };

  return (
    <div className="bpv-root">
      <style>{browserPreviewStyles}</style>

      {/* Zoom controls overlay */}
      <div className="bpv-zoom-controls">
        <button
          className={`bpv-zoom-btn ${internalZoom === 0 ? 'bpv-zoom-btn--active' : ''}`}
          onClick={handleZoomFit}
          title="Fit to view"
          type="button"
        >
          Fit
        </button>
        <button
          className={`bpv-zoom-btn ${internalZoom === 1 ? 'bpv-zoom-btn--active' : ''}`}
          onClick={handleZoom100}
          title="100% zoom"
          type="button"
        >
          100%
        </button>
        <button
          className={`bpv-zoom-btn ${internalZoom === 2 ? 'bpv-zoom-btn--active' : ''}`}
          onClick={handleZoom200}
          title="200% zoom"
          type="button"
        >
          200%
        </button>
        {onRefresh && (
          <button
            className="bpv-zoom-btn bpv-refresh-btn"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh screenshot"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
        )}
      </div>

      {/* Main content area */}
      <div
        ref={containerRef}
        className="bpv-container"
        onClick={onClickSnapshot}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="bpv-loading-overlay">
            <div className="bpv-spinner" />
          </div>
        )}

        {screenshotData ? (
          <>
            <img
              src={`data:image/png;base64,${screenshotData}`}
              alt="Browser screenshot"
              className="bpv-image"
              style={imageStyle}
              draggable={false}
            />
            {/* Snapshot hint on hover */}
            {hovered && onClickSnapshot && !loading && (
              <div className="bpv-snapshot-hint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Click for accessibility snapshot
              </div>
            )}
          </>
        ) : (
          <div className="bpv-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="bpv-empty-icon">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="bpv-empty-title">No Screenshot Available</span>
            <span className="bpv-empty-desc">
              Start the browser and navigate to a page to see a preview
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowserPreview;

// ---------------------------------------------------------------------------
// Scoped styles (bpv- prefix)
// ---------------------------------------------------------------------------

const browserPreviewStyles = `
/* Root */
.bpv-root {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-primary, #0a0a1a);
}

/* Zoom controls */
.bpv-zoom-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  display: flex;
  gap: 2px;
  padding: 2px;
  background: rgba(17, 17, 39, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  backdrop-filter: blur(8px);
}

.bpv-zoom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary, #a0a0c0);
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.bpv-zoom-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
}

.bpv-zoom-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bpv-zoom-btn--active {
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
}

.bpv-refresh-btn {
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  margin-left: 2px;
  padding-left: 8px;
}

/* Container */
.bpv-container {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8px;
  cursor: pointer;
  position: relative;
  min-height: 0;
}

.bpv-container::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.bpv-container::-webkit-scrollbar-track {
  background: transparent;
}

.bpv-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.bpv-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Image */
.bpv-image {
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  max-width: none;
  user-select: none;
  -webkit-user-select: none;
}

/* Loading overlay */
.bpv-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 26, 0.6);
  z-index: 5;
  backdrop-filter: blur(2px);
}

.bpv-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: bpv-spin 0.8s linear infinite;
}

@keyframes bpv-spin {
  to { transform: rotate(360deg); }
}

/* Snapshot hint */
.bpv-snapshot-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(17, 17, 39, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--text-secondary, #a0a0c0);
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(8px);
  animation: bpv-fadeIn 0.2s ease;
}

@keyframes bpv-fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* Empty state */
.bpv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex: 1;
  padding: 40px 20px;
  cursor: default;
}

.bpv-empty-icon {
  color: var(--text-tertiary, #606080);
  opacity: 0.5;
  margin-bottom: 4px;
}

.bpv-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
}

.bpv-empty-desc {
  font-size: 12px;
  color: var(--text-tertiary, #606080);
  text-align: center;
  max-width: 240px;
  line-height: 1.4;
}
`;
