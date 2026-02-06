/**
 * CameraCapture - Camera capture component for Helix Desktop
 *
 * Uses gateway node invocation to take photos via platform-native camera APIs.
 * Supports camera selection (front/back) and maintains a capture history.
 *
 * Gateway methods:
 *   - nodes.invoke { capability: 'camera.snap' } - Take photo
 *   - nodes.status - Check if camera is available
 */

import { useState, useEffect, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface CameraCaptureProps {
  onCapture?: (imageData: string) => void;
  onClose?: () => void;
}

type CameraFacing = 'front' | 'back';

interface CaptureEntry {
  id: string;
  imageData: string;
  timestamp: number;
  facing: CameraFacing;
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const { getClient, connected } = useGateway();

  const [capabilityAvailable, setCapabilityAvailable] = useState<boolean | null>(null);
  const [facing, setFacing] = useState<CameraFacing>('front');
  const [capturing, setCapturing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [history, setHistory] = useState<CaptureEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

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
            caps.includes('camera.snap') || caps.includes('camera')
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

  // Take a photo
  const takePhoto = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setError('Gateway not connected');
      return;
    }

    setCapturing(true);
    setError(null);

    try {
      const result = (await client.request('nodes.invoke', {
        capability: 'camera.snap',
        args: { facing },
      })) as { imageData?: string; image?: string; data?: string };

      const imageData = result.imageData ?? result.image ?? result.data ?? '';

      if (!imageData) {
        setError('Camera returned no image data');
        setCapturing(false);
        return;
      }

      setPreviewImage(imageData);

      const entry: CaptureEntry = {
        id: `cam-${Date.now()}`,
        imageData,
        timestamp: Date.now(),
        facing,
      };

      setHistory((prev) => [entry, ...prev].slice(0, 5));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera capture failed');
    } finally {
      setCapturing(false);
    }
  }, [getClient, facing]);

  // Accept the photo
  const acceptPhoto = useCallback(() => {
    if (previewImage) {
      onCapture?.(previewImage);
    }
  }, [previewImage, onCapture]);

  // Retake
  const retake = useCallback(() => {
    setPreviewImage(null);
    setError(null);
  }, []);

  // Save image
  const saveImage = useCallback(() => {
    if (!previewImage) return;

    const src = previewImage.startsWith('data:')
      ? previewImage
      : `data:image/png;base64,${previewImage}`;

    const link = document.createElement('a');
    link.href = src;
    link.download = `helix-camera-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [previewImage]);

  // Get image source for rendering
  const getImageSrc = (imageData: string): string => {
    if (imageData.startsWith('data:')) return imageData;
    return `data:image/png;base64,${imageData}`;
  };

  // Toggle camera facing
  const toggleFacing = useCallback(() => {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }, []);

  // Not connected
  if (!connected) {
    return (
      <div className="cam-container">
        <style>{cameraCaptureStyles}</style>
        <div className="cam-unavailable">
          <div className="cam-unavailable-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </div>
          <h3 className="cam-unavailable-title">Gateway Not Connected</h3>
          <p className="cam-unavailable-desc">
            Camera capture requires an active gateway connection.
          </p>
        </div>
      </div>
    );
  }

  // Capability not available
  if (capabilityAvailable === false) {
    return (
      <div className="cam-container">
        <style>{cameraCaptureStyles}</style>
        <div className="cam-unavailable">
          <div className="cam-unavailable-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <h3 className="cam-unavailable-title">Camera Not Available on This Device</h3>
          <p className="cam-unavailable-desc">
            This device does not have a camera, or the camera capability has not been granted.
          </p>
        </div>
      </div>
    );
  }

  // Loading capability check
  if (capabilityAvailable === null) {
    return (
      <div className="cam-container">
        <style>{cameraCaptureStyles}</style>
        <div className="cam-loading">
          <div className="cam-spinner" />
          <span>Checking camera availability...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cam-container">
      <style>{cameraCaptureStyles}</style>

      {/* Header */}
      <div className="cam-header">
        <h3 className="cam-title">Camera</h3>
        {onClose && (
          <button className="cam-close-btn" onClick={onClose} type="button">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="cam-error">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
          <button className="cam-error-dismiss" onClick={() => setError(null)} type="button">
            Dismiss
          </button>
        </div>
      )}

      {/* Preview or viewfinder */}
      {previewImage ? (
        <div className="cam-preview-area">
          <div className="cam-preview-image-wrapper">
            <img
              src={getImageSrc(previewImage)}
              alt="Camera capture preview"
              className="cam-preview-image"
            />
          </div>
          <div className="cam-preview-actions">
            <button className="cam-action-btn cam-action-btn--accept" onClick={acceptPhoto} type="button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Accept
            </button>
            <button className="cam-action-btn" onClick={retake} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              </svg>
              Retake
            </button>
            <button className="cam-action-btn" onClick={saveImage} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Save
            </button>
            <button
              className="cam-action-btn cam-action-btn--primary"
              onClick={() => onCapture?.(previewImage)}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
              Attach to Chat
            </button>
          </div>
        </div>
      ) : (
        <div className="cam-viewfinder-area">
          {/* Viewfinder placeholder */}
          <div className="cam-viewfinder">
            <div className="cam-viewfinder-content">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="cam-viewfinder-text">Camera viewfinder</span>
            </div>

            {/* Corner brackets */}
            <div className="cam-viewfinder-corner cam-viewfinder-corner--tl" />
            <div className="cam-viewfinder-corner cam-viewfinder-corner--tr" />
            <div className="cam-viewfinder-corner cam-viewfinder-corner--bl" />
            <div className="cam-viewfinder-corner cam-viewfinder-corner--br" />
          </div>

          {/* Camera selector */}
          <div className="cam-facing-row">
            <button
              className={`cam-facing-btn ${facing === 'front' ? 'cam-facing-btn--active' : ''}`}
              onClick={() => setFacing('front')}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Front
            </button>
            <button
              className="cam-flip-btn"
              onClick={toggleFacing}
              type="button"
              title="Switch camera"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 014-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
            </button>
            <button
              className={`cam-facing-btn ${facing === 'back' ? 'cam-facing-btn--active' : ''}`}
              onClick={() => setFacing('back')}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              Back
            </button>
          </div>

          {/* Shutter button */}
          <div className="cam-shutter-area">
            <button
              className="cam-shutter-btn"
              onClick={takePhoto}
              disabled={capturing}
              type="button"
              title="Take Photo"
            >
              {capturing ? (
                <div className="cam-spinner cam-spinner--small" />
              ) : (
                <div className="cam-shutter-inner" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Capture History */}
      {history.length > 0 && (
        <div className="cam-history">
          <h4 className="cam-history-title">Recent Photos</h4>
          <div className="cam-history-grid">
            {history.map((entry) => (
              <button
                key={entry.id}
                className="cam-history-thumb"
                onClick={() => setPreviewImage(entry.imageData)}
                type="button"
                title={`${entry.facing} camera - ${new Date(entry.timestamp).toLocaleTimeString()}`}
              >
                <img
                  src={getImageSrc(entry.imageData)}
                  alt={`Photo ${entry.facing}`}
                  className="cam-history-img"
                />
                <span className="cam-history-meta">
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

export default CameraCapture;

/* ═══════════════════════════════════════════
   Scoped styles (cam- prefix)
   ═══════════════════════════════════════════ */

const cameraCaptureStyles = `
.cam-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

.cam-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cam-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.cam-close-btn {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.cam-close-btn:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

/* ── Unavailable / Loading ── */
.cam-unavailable {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
}

.cam-unavailable-icon {
  color: var(--text-tertiary, #606080);
  margin-bottom: 1rem;
  opacity: 0.5;
}

.cam-unavailable-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.5rem;
}

.cam-unavailable-desc {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  max-width: 300px;
}

.cam-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
}

.cam-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: cam-spin 0.8s linear infinite;
}

.cam-spinner--small {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

@keyframes cam-spin {
  to { transform: rotate(360deg); }
}

/* ── Error ── */
.cam-error {
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

.cam-error-dismiss {
  margin-left: auto;
  background: none;
  border: none;
  color: #fca5a5;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.cam-error-dismiss:hover {
  background: rgba(239, 68, 68, 0.15);
}

/* ── Viewfinder ── */
.cam-viewfinder-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.cam-viewfinder {
  width: 100%;
  max-width: 400px;
  aspect-ratio: 4/3;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.cam-viewfinder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.cam-viewfinder-text {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  opacity: 0.6;
}

/* Corner brackets */
.cam-viewfinder-corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: var(--accent-color, #6366f1);
  border-style: solid;
  border-width: 0;
  opacity: 0.5;
}

.cam-viewfinder-corner--tl {
  top: 12px;
  left: 12px;
  border-top-width: 2px;
  border-left-width: 2px;
  border-top-left-radius: 4px;
}

.cam-viewfinder-corner--tr {
  top: 12px;
  right: 12px;
  border-top-width: 2px;
  border-right-width: 2px;
  border-top-right-radius: 4px;
}

.cam-viewfinder-corner--bl {
  bottom: 12px;
  left: 12px;
  border-bottom-width: 2px;
  border-left-width: 2px;
  border-bottom-left-radius: 4px;
}

.cam-viewfinder-corner--br {
  bottom: 12px;
  right: 12px;
  border-bottom-width: 2px;
  border-right-width: 2px;
  border-bottom-right-radius: 4px;
}

/* ── Camera selector ── */
.cam-facing-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.cam-facing-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
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

.cam-facing-btn:hover {
  border-color: rgba(255,255,255,0.15);
  color: var(--text-primary, #fff);
}

.cam-facing-btn--active {
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.08);
  color: var(--accent-color, #6366f1);
}

.cam-flip-btn {
  padding: 0.5rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 50%;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cam-flip-btn:hover {
  color: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  transform: rotate(180deg);
}

/* ── Shutter button ── */
.cam-shutter-area {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
}

.cam-shutter-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: transparent;
  border: 3px solid var(--accent-color, #6366f1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.15s ease;
}

.cam-shutter-btn:hover:not(:disabled) {
  border-color: #818cf8;
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
}

.cam-shutter-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.cam-shutter-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cam-shutter-inner {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
  transition: all 0.15s ease;
}

.cam-shutter-btn:hover:not(:disabled) .cam-shutter-inner {
  background: #818cf8;
}

.cam-shutter-btn:active:not(:disabled) .cam-shutter-inner {
  background: #4f46e5;
  transform: scale(0.9);
}

/* ── Preview ── */
.cam-preview-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cam-preview-image-wrapper {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 400px;
}

.cam-preview-image {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}

.cam-preview-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.cam-action-btn {
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

.cam-action-btn:hover {
  border-color: rgba(255,255,255,0.15);
  color: var(--text-primary, #fff);
}

.cam-action-btn--accept {
  background: #10b981;
  border-color: #10b981;
  color: white;
  padding: 0.625rem 1.5rem;
  font-size: 0.9375rem;
}

.cam-action-btn--accept:hover {
  background: #059669;
  border-color: #059669;
  color: white;
}

.cam-action-btn--primary {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: white;
}

.cam-action-btn--primary:hover {
  background: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

/* ── History ── */
.cam-history {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 1rem;
}

.cam-history-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
  margin: 0 0 0.625rem;
}

.cam-history-grid {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
}

.cam-history-thumb {
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

.cam-history-thumb:hover {
  border-color: var(--accent-color, #6366f1);
  transform: translateY(-1px);
}

.cam-history-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cam-history-meta {
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
