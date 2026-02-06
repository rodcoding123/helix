/**
 * ScreenCapture - Screen capture component for Helix Desktop
 *
 * Uses gateway node invocation to capture screenshots via platform-native APIs.
 * Supports full screen, window, and region capture modes with optional delay timers.
 *
 * Gateway methods:
 *   - nodes.invoke { capability: 'screen.capture' } - Capture screenshot
 *   - nodes.status - Check if screen capture is available
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface ScreenCaptureProps {
  onCapture?: (imageData: string) => void;
  onClose?: () => void;
}

type CaptureMode = 'fullscreen' | 'window' | 'region';
type DelayOption = 0 | 3 | 5 | 10;

interface CaptureEntry {
  id: string;
  imageData: string;
  timestamp: number;
  mode: CaptureMode;
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function ScreenCapture({ onCapture, onClose }: ScreenCaptureProps) {
  const { getClient, connected } = useGateway();

  const [capabilityAvailable, setCapabilityAvailable] = useState<boolean | null>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('fullscreen');
  const [delay, setDelay] = useState<DelayOption>(0);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [history, setHistory] = useState<CaptureEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check capability availability
  useEffect(() => {
    let cancelled = false;

    async function checkCapability(): Promise<void> {
      const client = getClient();
      if (!client?.connected) {
        setCapabilityAvailable(false);
        return;
      }

      try {
        const result = (await client.request('nodes.status')) as {
          capabilities?: string[];
        };
        if (!cancelled) {
          const caps = result.capabilities ?? [];
          setCapabilityAvailable(
            caps.includes('screen.capture') || caps.includes('screen')
          );
        }
      } catch {
        if (!cancelled) {
          setCapabilityAvailable(false);
        }
      }
    }

    checkCapability();
    return () => {
      cancelled = true;
    };
  }, [getClient, connected]);

  // Clean up countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current !== null) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Execute the actual capture
  const executeCapture = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setError('Gateway not connected');
      setCapturing(false);
      return;
    }

    try {
      const result = (await client.request('nodes.invoke', {
        capability: 'screen.capture',
        args: { mode: captureMode },
      })) as { imageData?: string; image?: string; data?: string };

      const imageData = result.imageData ?? result.image ?? result.data ?? '';

      if (!imageData) {
        setError('Capture returned no image data');
        setCapturing(false);
        return;
      }

      setPreviewImage(imageData);

      const entry: CaptureEntry = {
        id: `sc-${Date.now()}`,
        imageData,
        timestamp: Date.now(),
        mode: captureMode,
      };

      setHistory((prev) => [entry, ...prev].slice(0, 5));
      onCapture?.(imageData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Screen capture failed');
    } finally {
      setCapturing(false);
    }
  }, [getClient, captureMode, onCapture]);

  // Start capture with optional delay
  const startCapture = useCallback(() => {
    setError(null);
    setPreviewImage(null);

    if (delay === 0) {
      setCapturing(true);
      executeCapture();
      return;
    }

    // Start countdown
    let remaining = delay;
    setCountdown(remaining);

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownRef.current !== null) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setCountdown(null);
        setCapturing(true);
        executeCapture();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [delay, executeCapture]);

  // Cancel countdown
  const cancelCountdown = useCallback(() => {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  }, []);

  // Copy image to clipboard
  const copyToClipboard = useCallback(async () => {
    if (!previewImage) return;

    try {
      // Attempt to write base64 image to clipboard via canvas
      const img = new Image();
      img.src = previewImage.startsWith('data:')
        ? previewImage
        : `data:image/png;base64,${previewImage}`;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
    } catch {
      // Fallback: copy base64 string
      const text = previewImage.startsWith('data:')
        ? previewImage
        : `data:image/png;base64,${previewImage}`;
      await navigator.clipboard.writeText(text);
    }
  }, [previewImage]);

  // Save image
  const saveImage = useCallback(() => {
    if (!previewImage) return;

    const src = previewImage.startsWith('data:')
      ? previewImage
      : `data:image/png;base64,${previewImage}`;

    const link = document.createElement('a');
    link.href = src;
    link.download = `helix-capture-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [previewImage]);

  // Retake
  const retake = useCallback(() => {
    setPreviewImage(null);
    setError(null);
  }, []);

  // Get image source for rendering
  const getImageSrc = (imageData: string): string => {
    if (imageData.startsWith('data:')) return imageData;
    return `data:image/png;base64,${imageData}`;
  };

  // Not connected
  if (!connected) {
    return (
      <div className="sc-container">
        <style>{screenCaptureStyles}</style>
        <div className="sc-unavailable">
          <div className="sc-unavailable-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </div>
          <h3 className="sc-unavailable-title">Gateway Not Connected</h3>
          <p className="sc-unavailable-desc">
            Screen capture requires an active gateway connection.
          </p>
        </div>
      </div>
    );
  }

  // Capability not available
  if (capabilityAvailable === false) {
    return (
      <div className="sc-container">
        <style>{screenCaptureStyles}</style>
        <div className="sc-unavailable">
          <div className="sc-unavailable-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h3 className="sc-unavailable-title">Screen Capture Not Available</h3>
          <p className="sc-unavailable-desc">
            This device does not support screen capture, or the capability has not been granted.
          </p>
        </div>
      </div>
    );
  }

  // Loading capability check
  if (capabilityAvailable === null) {
    return (
      <div className="sc-container">
        <style>{screenCaptureStyles}</style>
        <div className="sc-loading">
          <div className="sc-spinner" />
          <span>Checking screen capture availability...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-container">
      <style>{screenCaptureStyles}</style>

      {/* Header */}
      <div className="sc-header">
        <h3 className="sc-title">Screen Capture</h3>
        {onClose && (
          <button className="sc-close-btn" onClick={onClose} type="button">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="sc-error">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
          <button className="sc-error-dismiss" onClick={() => setError(null)} type="button">
            Dismiss
          </button>
        </div>
      )}

      {/* Preview or controls */}
      {previewImage ? (
        <div className="sc-preview-area">
          <div className="sc-preview-image-wrapper">
            <img
              src={getImageSrc(previewImage)}
              alt="Screen capture preview"
              className="sc-preview-image"
            />
          </div>
          <div className="sc-preview-actions">
            <button className="sc-action-btn" onClick={copyToClipboard} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy to Clipboard
            </button>
            <button className="sc-action-btn" onClick={saveImage} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Save
            </button>
            <button
              className="sc-action-btn sc-action-btn--primary"
              onClick={() => onCapture?.(previewImage)}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
              Attach to Chat
            </button>
            <button className="sc-action-btn sc-action-btn--secondary" onClick={retake} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              </svg>
              Retake
            </button>
          </div>
        </div>
      ) : (
        <div className="sc-controls">
          {/* Capture Mode Selector */}
          <div className="sc-control-group">
            <label className="sc-control-label">Capture Mode</label>
            <div className="sc-mode-selector">
              {([
                { id: 'fullscreen', label: 'Full Screen', icon: 'M1 1h6v2H3v4H1V1zm16 0h6v6h-2V3h-4V1zM1 17v6h6v-2H3v-4H1zm22 0v6h-6v-2h4v-4h2z' },
                { id: 'window', label: 'Window', icon: 'M3 3h18v18H3V3zm2 4v12h14V7H5z' },
                { id: 'region', label: 'Region', icon: 'M15 3h6v6h-2V5h-4V3zM3 15v6h6v-2H5v-4H3zm14 0l4 4m0-4l-4 4' },
              ] as { id: CaptureMode; label: string; icon: string }[]).map((mode) => (
                <button
                  key={mode.id}
                  className={`sc-mode-btn ${captureMode === mode.id ? 'sc-mode-btn--active' : ''}`}
                  onClick={() => setCaptureMode(mode.id)}
                  type="button"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={mode.icon} />
                  </svg>
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Delay Timer */}
          <div className="sc-control-group">
            <label className="sc-control-label">Delay Timer</label>
            <div className="sc-delay-selector">
              {([0, 3, 5, 10] as DelayOption[]).map((d) => (
                <button
                  key={d}
                  className={`sc-delay-btn ${delay === d ? 'sc-delay-btn--active' : ''}`}
                  onClick={() => setDelay(d)}
                  type="button"
                >
                  {d === 0 ? 'None' : `${d}s`}
                </button>
              ))}
            </div>
          </div>

          {/* Capture Button */}
          <div className="sc-capture-area">
            {countdown !== null ? (
              <div className="sc-countdown">
                <span className="sc-countdown-number">{countdown}</span>
                <button className="sc-countdown-cancel" onClick={cancelCountdown} type="button">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="sc-capture-btn"
                onClick={startCapture}
                disabled={capturing}
                type="button"
              >
                {capturing ? (
                  <>
                    <div className="sc-spinner sc-spinner--small" />
                    Capturing...
                  </>
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    Capture Screen
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Capture History */}
      {history.length > 0 && (
        <div className="sc-history">
          <h4 className="sc-history-title">Recent Captures</h4>
          <div className="sc-history-grid">
            {history.map((entry) => (
              <button
                key={entry.id}
                className="sc-history-thumb"
                onClick={() => setPreviewImage(entry.imageData)}
                type="button"
                title={`${entry.mode} - ${new Date(entry.timestamp).toLocaleTimeString()}`}
              >
                <img
                  src={getImageSrc(entry.imageData)}
                  alt={`Capture ${entry.mode}`}
                  className="sc-history-img"
                />
                <span className="sc-history-meta">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ScreenCapture;

/* ═══════════════════════════════════════════
   Scoped styles (sc- prefix)
   ═══════════════════════════════════════════ */

const screenCaptureStyles = `
.sc-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

.sc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sc-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.sc-close-btn {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.sc-close-btn:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

/* ── Unavailable / Loading ── */
.sc-unavailable {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
}

.sc-unavailable-icon {
  color: var(--text-tertiary, #606080);
  margin-bottom: 1rem;
  opacity: 0.5;
}

.sc-unavailable-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.5rem;
}

.sc-unavailable-desc {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  max-width: 300px;
}

.sc-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
}

.sc-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: sc-spin 0.8s linear infinite;
}

.sc-spinner--small {
  width: 18px;
  height: 18px;
  border-width: 2px;
}

@keyframes sc-spin {
  to { transform: rotate(360deg); }
}

/* ── Error ── */
.sc-error {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.sc-error-dismiss {
  margin-left: auto;
  background: none;
  border: none;
  color: #fca5a5;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.sc-error-dismiss:hover {
  background: rgba(239, 68, 68, 0.15);
}

/* ── Controls ── */
.sc-controls {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sc-control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sc-control-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
}

.sc-mode-selector {
  display: flex;
  gap: 0.5rem;
}

.sc-mode-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.875rem 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

.sc-mode-btn:hover {
  border-color: rgba(255,255,255,0.15);
  color: var(--text-primary, #fff);
}

.sc-mode-btn--active {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.08);
  color: var(--accent-color, #6366f1);
}

.sc-delay-selector {
  display: flex;
  gap: 0.375rem;
}

.sc-delay-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

.sc-delay-btn:hover {
  border-color: rgba(255,255,255,0.15);
  color: var(--text-primary, #fff);
}

.sc-delay-btn--active {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.08);
  color: var(--accent-color, #6366f1);
}

/* ── Capture area ── */
.sc-capture-area {
  display: flex;
  justify-content: center;
  padding: 1.5rem 0;
}

.sc-capture-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2.5rem;
  background: var(--accent-color, #6366f1);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}

.sc-capture-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.4);
}

.sc-capture-btn:active:not(:disabled) {
  transform: translateY(0);
}

.sc-capture-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Countdown ── */
.sc-countdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.sc-countdown-number {
  font-size: 3rem;
  font-weight: 800;
  color: var(--accent-color, #6366f1);
  line-height: 1;
  animation: sc-pulse 1s ease-in-out infinite;
}

@keyframes sc-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.95); }
}

.sc-countdown-cancel {
  padding: 0.375rem 1rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  font-size: 0.8125rem;
  transition: all 0.15s ease;
}

.sc-countdown-cancel:hover {
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}

/* ── Preview ── */
.sc-preview-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sc-preview-image-wrapper {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 400px;
}

.sc-preview-image {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}

.sc-preview-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sc-action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

.sc-action-btn:hover {
  border-color: rgba(255,255,255,0.15);
  color: var(--text-primary, #fff);
}

.sc-action-btn--primary {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: white;
}

.sc-action-btn--primary:hover {
  background: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

.sc-action-btn--secondary {
  border-color: rgba(255,255,255,0.12);
}

/* ── History ── */
.sc-history {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 1rem;
}

.sc-history-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  margin: 0 0 0.625rem;
}

.sc-history-grid {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
}

.sc-history-thumb {
  flex-shrink: 0;
  width: 80px;
  height: 60px;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
  padding: 0;
}

.sc-history-thumb:hover {
  border-color: var(--accent-color, #6366f1);
  transform: translateY(-1px);
}

.sc-history-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sc-history-meta {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 0.5625rem;
  background: rgba(0,0,0,0.7);
  color: var(--text-secondary, #a0a0c0);
  padding: 0.125rem 0.25rem;
  text-align: center;
}
`;
