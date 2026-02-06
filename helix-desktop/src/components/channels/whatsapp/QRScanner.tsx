/**
 * QRScanner - QR code display component for WhatsApp pairing
 *
 * Renders QR code data as a base64 image when the gateway provides image data,
 * or as a styled placeholder with the raw data string. Supports loading,
 * expired, and error states with dark-themed inverted display.
 */

import { useState, useEffect } from 'react';

/* ===================================================================
   Types
   =================================================================== */

export interface QRScannerProps {
  /** QR code data string (base64 image or raw data) */
  qrData?: string;
  /** Whether the QR code is loading */
  loading?: boolean;
  /** Whether the QR code has expired */
  expired?: boolean;
  /** Callback when user requests a refresh */
  onRefresh?: () => void;
}

/* ===================================================================
   Component
   =================================================================== */

export function QRScanner({ qrData, loading, expired, onRefresh }: QRScannerProps) {
  const [imageError, setImageError] = useState(false);

  // Reset image error when qrData changes
  useEffect(() => {
    setImageError(false);
  }, [qrData]);

  /**
   * Determine if the qrData looks like a base64 image.
   * Gateway may return data:image/png;base64,... or just a raw base64 string.
   */
  const isBase64Image = qrData
    ? qrData.startsWith('data:image/') ||
      /^[A-Za-z0-9+/=]{100,}$/.test(qrData.replace(/\s/g, ''))
    : false;

  const imageSrc = qrData
    ? qrData.startsWith('data:image/')
      ? qrData
      : `data:image/png;base64,${qrData}`
    : undefined;

  return (
    <div className="qrs-container">
      <style>{qrScannerStyles}</style>

      <div className={`qrs-frame ${expired ? 'qrs-frame-expired' : ''}`}>
        {/* Loading overlay */}
        {loading && (
          <div className="qrs-overlay">
            <div className="qrs-spinner" />
            <span className="qrs-overlay-text">Generating QR code...</span>
          </div>
        )}

        {/* Expired overlay */}
        {expired && !loading && (
          <div className="qrs-overlay qrs-overlay-expired">
            <svg className="qrs-expired-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="qrs-overlay-text">QR code expired</span>
            {onRefresh && (
              <button className="qrs-refresh-btn" onClick={onRefresh} type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Refresh QR Code
              </button>
            )}
          </div>
        )}

        {/* QR code display */}
        {qrData && isBase64Image && !imageError ? (
          <img
            className="qrs-image"
            src={imageSrc}
            alt="WhatsApp QR Code"
            onError={() => setImageError(true)}
            draggable={false}
          />
        ) : qrData && !loading ? (
          <div className="qrs-placeholder">
            <div className="qrs-placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="3" height="3" />
                <rect x="18" y="14" width="3" height="3" />
                <rect x="14" y="18" width="3" height="3" />
                <rect x="18" y="18" width="3" height="3" />
              </svg>
            </div>
            <span className="qrs-placeholder-label">QR Code</span>
            <code className="qrs-raw-data">{qrData.length > 80 ? `${qrData.slice(0, 80)}...` : qrData}</code>
            <span className="qrs-placeholder-note">
              Scan this code with your WhatsApp camera
            </span>
          </div>
        ) : !loading ? (
          <div className="qrs-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="3" height="3" />
              <rect x="18" y="14" width="3" height="3" />
              <rect x="14" y="18" width="3" height="3" />
              <rect x="18" y="18" width="3" height="3" />
            </svg>
            <span className="qrs-empty-text">Waiting for QR code...</span>
          </div>
        ) : null}
      </div>

      {/* Manual refresh button below frame */}
      {!expired && !loading && qrData && onRefresh && (
        <button className="qrs-manual-refresh" onClick={onRefresh} type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      )}
    </div>
  );
}

export default QRScanner;

/* ===================================================================
   Scoped styles (qrs- prefix)
   =================================================================== */

const qrScannerStyles = `
/* Container */
.qrs-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

/* Frame */
.qrs-frame {
  position: relative;
  width: 280px;
  height: 280px;
  background: var(--bg-primary, #0a0a1a);
  border: 2px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.3s ease;
}

.qrs-frame-expired {
  border-color: rgba(245, 158, 11, 0.4);
}

/* QR image */
.qrs-image {
  width: 240px;
  height: 240px;
  object-fit: contain;
  image-rendering: pixelated;
  filter: invert(1);
  border-radius: 8px;
}

/* Overlays */
.qrs-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: rgba(10, 10, 26, 0.92);
  backdrop-filter: blur(4px);
  z-index: 2;
}

.qrs-overlay-expired {
  background: rgba(10, 10, 26, 0.95);
}

.qrs-overlay-text {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
}

.qrs-expired-icon {
  color: #f59e0b;
}

/* Spinner */
.qrs-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: qrs-spin 0.8s linear infinite;
}

@keyframes qrs-spin {
  to { transform: rotate(360deg); }
}

/* Refresh button (inside overlay) */
.qrs-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--accent-color, #6366f1);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-top: 0.25rem;
}

.qrs-refresh-btn:hover {
  background: #4f46e5;
  transform: translateY(-1px);
}

/* Placeholder (when data is raw text, not image) */
.qrs-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  text-align: center;
}

.qrs-placeholder-icon {
  color: var(--text-tertiary, #606080);
  opacity: 0.6;
  margin-bottom: 0.25rem;
}

.qrs-placeholder-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.qrs-raw-data {
  display: block;
  max-width: 220px;
  font-size: 0.625rem;
  font-family: var(--font-mono, monospace);
  color: var(--text-tertiary, #606080);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.375rem 0.625rem;
  border-radius: 4px;
  word-break: break-all;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qrs-placeholder-note {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.25rem;
}

/* Empty state (no data yet) */
.qrs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--text-tertiary, #606080);
  opacity: 0.5;
}

.qrs-empty-text {
  font-size: 0.8125rem;
  font-weight: 500;
}

/* Manual refresh below frame */
.qrs-manual-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  color: var(--text-tertiary, #606080);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.qrs-manual-refresh:hover {
  color: var(--text-secondary, #a0a0c0);
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
}

/* Responsive */
@media (max-width: 480px) {
  .qrs-frame {
    width: 240px;
    height: 240px;
  }

  .qrs-image {
    width: 200px;
    height: 200px;
  }
}
`;
