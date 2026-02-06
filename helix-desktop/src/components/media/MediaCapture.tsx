/**
 * MediaCapture - Main media capture hub for Helix Desktop
 *
 * Combines ScreenCapture and CameraCapture into a tabbed interface
 * with a unified media gallery at the bottom. All captured media
 * is stored in component state and available for attachment to chat.
 */

import { useState, useCallback } from 'react';
import { ScreenCapture } from './ScreenCapture';
import { CameraCapture } from './CameraCapture';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface MediaCaptureProps {
  onAttach?: (imageData: string, type: 'screenshot' | 'camera') => void;
  onClose?: () => void;
}

type ActiveTab = 'screen' | 'camera';

interface GalleryItem {
  id: string;
  imageData: string;
  type: 'screenshot' | 'camera';
  timestamp: number;
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function MediaCapture({ onAttach, onClose }: MediaCaptureProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('screen');
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);

  // Handle screen capture
  const handleScreenCapture = useCallback((imageData: string) => {
    const item: GalleryItem = {
      id: `mc-screen-${Date.now()}`,
      imageData,
      type: 'screenshot',
      timestamp: Date.now(),
    };
    setGallery((prev) => [item, ...prev]);
  }, []);

  // Handle camera capture
  const handleCameraCapture = useCallback((imageData: string) => {
    const item: GalleryItem = {
      id: `mc-cam-${Date.now()}`,
      imageData,
      type: 'camera',
      timestamp: Date.now(),
    };
    setGallery((prev) => [item, ...prev]);
  }, []);

  // Delete gallery item
  const deleteItem = useCallback((id: string) => {
    setGallery((prev) => prev.filter((item) => item.id !== id));
    if (previewItem?.id === id) {
      setPreviewItem(null);
    }
  }, [previewItem]);

  // Attach gallery item to chat
  const attachItem = useCallback((item: GalleryItem) => {
    onAttach?.(item.imageData, item.type);
  }, [onAttach]);

  // Get image source for rendering
  const getImageSrc = (imageData: string): string => {
    if (imageData.startsWith('data:')) return imageData;
    return `data:image/png;base64,${imageData}`;
  };

  return (
    <div className="mc-container">
      <style>{mediaCaptureStyles}</style>

      {/* Header */}
      <div className="mc-header">
        <h2 className="mc-main-title">Media Capture</h2>
        {onClose && (
          <button className="mc-close-btn" onClick={onClose} type="button">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="mc-tab-bar">
        <button
          className={`mc-tab ${activeTab === 'screen' ? 'mc-tab--active' : ''}`}
          onClick={() => setActiveTab('screen')}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Screen Capture
        </button>
        <button
          className={`mc-tab ${activeTab === 'camera' ? 'mc-tab--active' : ''}`}
          onClick={() => setActiveTab('camera')}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Camera
        </button>
      </div>

      {/* Active tab content */}
      <div className="mc-content">
        {activeTab === 'screen' ? (
          <ScreenCapture onCapture={handleScreenCapture} />
        ) : (
          <CameraCapture onCapture={handleCameraCapture} />
        )}
      </div>

      {/* Media gallery */}
      {gallery.length > 0 && (
        <div className="mc-gallery">
          <div className="mc-gallery-header">
            <h4 className="mc-gallery-title">
              Media Gallery
              <span className="mc-gallery-count">{gallery.length}</span>
            </h4>
            <button
              className="mc-gallery-clear"
              onClick={() => {
                setGallery([]);
                setPreviewItem(null);
              }}
              type="button"
            >
              Clear All
            </button>
          </div>

          <div className="mc-gallery-grid">
            {gallery.map((item) => (
              <div key={item.id} className="mc-gallery-item">
                <button
                  className="mc-gallery-thumb"
                  onClick={() => setPreviewItem(item)}
                  type="button"
                >
                  <img
                    src={getImageSrc(item.imageData)}
                    alt={`${item.type} capture`}
                    className="mc-gallery-img"
                  />
                  <span className={`mc-gallery-type mc-gallery-type--${item.type}`}>
                    {item.type === 'screenshot' ? 'Screen' : 'Camera'}
                  </span>
                </button>
                <div className="mc-gallery-item-actions">
                  <button
                    className="mc-gallery-action mc-gallery-action--attach"
                    onClick={() => attachItem(item)}
                    type="button"
                    title="Attach to chat"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <button
                    className="mc-gallery-action mc-gallery-action--delete"
                    onClick={() => deleteItem(item.id)}
                    type="button"
                    title="Delete"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full-size preview modal */}
      {previewItem && (
        <div className="mc-preview-overlay" onClick={() => setPreviewItem(null)}>
          <div className="mc-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mc-preview-header">
              <div className="mc-preview-info">
                <span className={`mc-gallery-type mc-gallery-type--${previewItem.type}`}>
                  {previewItem.type === 'screenshot' ? 'Screen Capture' : 'Camera Photo'}
                </span>
                <span className="mc-preview-time">
                  {new Date(previewItem.timestamp).toLocaleString()}
                </span>
              </div>
              <button
                className="mc-preview-close"
                onClick={() => setPreviewItem(null)}
                type="button"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="mc-preview-image-area">
              <img
                src={getImageSrc(previewItem.imageData)}
                alt="Full size preview"
                className="mc-preview-image"
              />
            </div>
            <div className="mc-preview-actions">
              <button
                className="mc-preview-btn mc-preview-btn--primary"
                onClick={() => {
                  attachItem(previewItem);
                  setPreviewItem(null);
                }}
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                Attach to Chat
              </button>
              <button
                className="mc-preview-btn mc-preview-btn--danger"
                onClick={() => {
                  deleteItem(previewItem.id);
                }}
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Delete
              </button>
              <button
                className="mc-preview-btn"
                onClick={() => setPreviewItem(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaCapture;

/* ═══════════════════════════════════════════
   Scoped styles (mc- prefix)
   ═══════════════════════════════════════════ */

const mediaCaptureStyles = `
.mc-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.mc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.mc-main-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.mc-close-btn {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.mc-close-btn:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

/* ── Tab bar ── */
.mc-tab-bar {
  display: flex;
  gap: 0;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 10px;
  padding: 3px;
  border: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 1rem;
}

.mc-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mc-tab:hover {
  color: var(--text-primary, #fff);
}

.mc-tab--active {
  background: var(--accent-color, #6366f1);
  color: white;
}

/* ── Content ── */
.mc-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* ── Gallery ── */
.mc-gallery {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 1rem;
  margin-top: 1rem;
}

.mc-gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.mc-gallery-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mc-gallery-count {
  font-size: 0.6875rem;
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  font-weight: 600;
}

.mc-gallery-clear {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.mc-gallery-clear:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.mc-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 0.5rem;
}

.mc-gallery-item {
  position: relative;
}

.mc-gallery-thumb {
  width: 100%;
  aspect-ratio: 4/3;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
  padding: 0;
  display: block;
}

.mc-gallery-thumb:hover {
  border-color: var(--accent-color, #6366f1);
  transform: translateY(-1px);
}

.mc-gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mc-gallery-type {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 0.5625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.0625rem 0.25rem;
  border-radius: 3px;
  backdrop-filter: blur(4px);
}

.mc-gallery-type--screenshot {
  background: rgba(99, 102, 241, 0.7);
  color: white;
}

.mc-gallery-type--camera {
  background: rgba(16, 185, 129, 0.7);
  color: white;
}

.mc-gallery-item-actions {
  display: flex;
  gap: 0.25rem;
  justify-content: center;
  margin-top: 0.25rem;
}

.mc-gallery-action {
  padding: 0.25rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-tertiary, #606080);
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mc-gallery-action--attach:hover {
  color: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.08);
}

.mc-gallery-action--delete:hover {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.08);
}

/* ── Preview modal ── */
.mc-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 1000);
  animation: mc-fade-in 0.15s ease;
}

@keyframes mc-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.mc-preview-modal {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 1.5rem;
  width: 90%;
  max-width: 720px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  animation: mc-modal-in 0.2s ease;
}

@keyframes mc-modal-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.mc-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.mc-preview-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mc-preview-time {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.mc-preview-close {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.mc-preview-close:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

.mc-preview-image-area {
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.mc-preview-image {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
}

.mc-preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
}

.mc-preview-btn {
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

.mc-preview-btn:hover {
  border-color: rgba(255,255,255,0.15);
  color: var(--text-primary, #fff);
}

.mc-preview-btn--primary {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
  color: white;
}

.mc-preview-btn--primary:hover {
  background: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

.mc-preview-btn--danger {
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.mc-preview-btn--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}
`;
