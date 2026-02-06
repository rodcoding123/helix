/**
 * Voice Overlay Component
 *
 * Floating pill-shaped overlay for talk mode. Supports two visual modes:
 *   - Compact (default): circular state indicator + voice label + close button
 *   - Expanded (click):  full overlay with transcript, response, controls
 *
 * Features:
 *   - Draggable (mouse drag to reposition)
 *   - State-driven animations (idle, listening, thinking, speaking)
 *   - Keyboard accessible (Space = mute, Escape = close)
 *   - Smooth expand/collapse transitions
 *
 * CSS prefix: vo-
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { WaveformVisualizer } from './WaveformVisualizer';

/* =====================================================================
   Types
   ===================================================================== */

export interface VoiceOverlayProps {
  /** Current talk-mode state */
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  /** Live speech-to-text transcript (user speech) */
  transcript?: string;
  /** Streaming AI response text */
  response?: string;
  /** Display name of the current voice */
  voiceName?: string;
  /** Callback to interrupt during speaking */
  onInterrupt?: () => void;
  /** Callback to exit talk mode */
  onClose?: () => void;
  /** Callback to toggle microphone mute */
  onToggleMute?: () => void;
  /** Whether the microphone is muted */
  muted?: boolean;
  /** Overlay position anchor */
  position?: 'bottom-right' | 'bottom-center' | 'top-right';
}

/* =====================================================================
   Position presets
   ===================================================================== */

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  'bottom-right': { bottom: '24px', right: '24px' },
  'bottom-center': { bottom: '24px', left: '50%', transform: 'translateX(-50%)' },
  'top-right': { top: '24px', right: '24px' },
};

/* =====================================================================
   Inline styles
   ===================================================================== */

const STYLES = `
/* ---------------------------------------------------------------
   Voice Overlay - Container
   --------------------------------------------------------------- */

.vo-overlay {
  position: fixed;
  z-index: 9999;
  user-select: none;
  animation: vo-enter 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.vo-overlay--exiting {
  animation: vo-exit 0.2s ease-in forwards;
}

@keyframes vo-enter {
  0% {
    opacity: 0;
    transform: scale(0.7);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes vo-exit {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.7);
  }
}

/* ---------------------------------------------------------------
   Compact mode (pill)
   --------------------------------------------------------------- */

.vo-compact {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(17, 17, 39, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  min-width: 140px;
}

.vo-compact:hover {
  border-color: rgba(99, 102, 241, 0.35);
  box-shadow: 0 4px 32px rgba(99, 102, 241, 0.15);
}

/* State indicator (circle) */
.vo-indicator {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  transition: background 0.3s ease;
}

.vo-indicator--idle {
  color: #606080;
}

.vo-indicator--listening {
  color: #6366f1;
  background: rgba(99, 102, 241, 0.15);
}

.vo-indicator--thinking {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.vo-indicator--speaking {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

/* Listening pulse ring */
.vo-pulse-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid #6366f1;
  opacity: 0;
  animation: vo-pulse 1.8s ease-in-out infinite;
}

.vo-pulse-ring--second {
  animation-delay: 0.6s;
}

@keyframes vo-pulse {
  0% {
    opacity: 0.6;
    transform: scale(0.9);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

/* Thinking spinner */
.vo-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.vo-spinner-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #f59e0b;
  animation: vo-dot-bounce 1.2s ease-in-out infinite;
}

.vo-spinner-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.vo-spinner-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes vo-dot-bounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-6px);
    opacity: 1;
  }
}

/* Voice name label */
.vo-label {
  font-size: 0.8rem;
  color: #a0a0c0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.vo-label__state {
  display: block;
  font-size: 0.65rem;
  color: #606080;
  margin-top: 1px;
  text-transform: capitalize;
}

/* Close button */
.vo-close {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.9);
  border: none;
  color: white;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform: scale(0.8);
  z-index: 10;
  line-height: 1;
  padding: 0;
}

.vo-overlay:hover .vo-close {
  opacity: 1;
  transform: scale(1);
}

.vo-close:hover {
  background: #ef4444;
}

/* ---------------------------------------------------------------
   Expanded mode
   --------------------------------------------------------------- */

.vo-expanded {
  width: 340px;
  background: rgba(17, 17, 39, 0.97);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  animation: vo-expand 0.25s ease forwards;
}

@keyframes vo-expand {
  0% {
    opacity: 0.8;
    max-height: 60px;
  }
  100% {
    opacity: 1;
    max-height: 500px;
  }
}

/* Expanded header */
.vo-expanded__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
}

.vo-expanded__title {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 500;
  color: #fff;
}

.vo-expanded__state {
  font-size: 0.7rem;
  color: #a0a0c0;
  text-transform: capitalize;
}

.vo-expanded__close {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #a0a0c0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.15s ease;
  padding: 0;
  line-height: 1;
}

.vo-expanded__close:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

/* Content area */
.vo-expanded__content {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Transcript area */
.vo-transcript {
  max-height: 80px;
  overflow-y: auto;
  font-size: 0.8rem;
  color: #a0a0c0;
  line-height: 1.4;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.vo-transcript__label {
  font-size: 0.65rem;
  color: #606080;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  display: block;
}

.vo-transcript__text {
  color: #c0c0e0;
}

/* Response area */
.vo-response {
  max-height: 120px;
  overflow-y: auto;
  font-size: 0.8rem;
  color: #e0e0ff;
  line-height: 1.5;
  padding: 8px 10px;
  background: rgba(99, 102, 241, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(99, 102, 241, 0.1);
}

.vo-response__label {
  font-size: 0.65rem;
  color: #6366f1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  display: block;
}

/* Waveform container in expanded */
.vo-waveform {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}

/* Controls bar */
.vo-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.vo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #a0a0c0;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.vo-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.vo-btn:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.vo-btn--muted {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.vo-btn--muted:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.vo-btn--interrupt {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.vo-btn--interrupt:hover {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

/* Scrollbar styling for transcript/response */
.vo-transcript::-webkit-scrollbar,
.vo-response::-webkit-scrollbar {
  width: 4px;
}

.vo-transcript::-webkit-scrollbar-thumb,
.vo-response::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

/* Dragging cursor */
.vo-overlay--dragging {
  cursor: grabbing;
}

.vo-overlay--dragging * {
  cursor: grabbing !important;
}
`;

/* =====================================================================
   SVG icon helpers (inline, no dependency)
   ===================================================================== */

function MicIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.1 1.32-.27 1.93" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

/* =====================================================================
   Component
   ===================================================================== */

export function VoiceOverlay({
  state,
  transcript,
  response,
  voiceName,
  onInterrupt,
  onClose,
  onToggleMute,
  muted = false,
  position = 'bottom-right',
}: VoiceOverlayProps) {
  const [expanded, setExpanded] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Drag state
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; offsetX: number; offsetY: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Auto-scroll response area
  const responseRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  // -----------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        onToggleMute?.();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleMute, onClose]);

  // -----------------------------------------------------------------
  // Drag handlers
  // -----------------------------------------------------------------
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only drag on left button, and not on buttons/interactive elements
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('.vo-btn')) return;

      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        offsetX: dragOffset.x,
        offsetY: dragOffset.y,
      };
    },
    [dragOffset]
  );

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragStartRef.current) return;

      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      // Only start drag if moved more than 4px (prevent accidental drags)
      if (!isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        setIsDragging(true);
      }

      if (isDragging || Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        setDragOffset({
          x: dragStartRef.current.offsetX + dx,
          y: dragStartRef.current.offsetY + dy,
        });
      }
    }

    function handleMouseUp() {
      dragStartRef.current = null;
      setIsDragging(false);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // -----------------------------------------------------------------
  // Close with exit animation
  // -----------------------------------------------------------------
  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      onClose?.();
    }, 200);
  }, [onClose]);

  // -----------------------------------------------------------------
  // Toggle expand (don't expand on drag)
  // -----------------------------------------------------------------
  const handleCompactClick = useCallback(() => {
    if (!isDragging) {
      setExpanded(true);
    }
  }, [isDragging]);

  const handleHeaderClick = useCallback(() => {
    if (!isDragging) {
      setExpanded(false);
    }
  }, [isDragging]);

  // -----------------------------------------------------------------
  // Compute position styles
  // -----------------------------------------------------------------
  const positionStyle: React.CSSProperties = {
    ...POSITION_STYLES[position],
    // Apply drag offset
    ...(dragOffset.x !== 0 || dragOffset.y !== 0
      ? {
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
          // Override position preset transform if needed
          ...(position === 'bottom-center'
            ? { transform: `translateX(calc(-50% + ${dragOffset.x}px)) translateY(${dragOffset.y}px)` }
            : {}),
        }
      : {}),
  };

  // -----------------------------------------------------------------
  // State indicator content
  // -----------------------------------------------------------------
  function renderIndicator(large?: boolean) {
    const size = large ? 44 : 36;
    const iconSize = large ? 22 : 18;

    switch (state) {
      case 'idle':
        return (
          <div className={`vo-indicator vo-indicator--idle`} style={{ width: size, height: size }}>
            <MicIcon size={iconSize} />
          </div>
        );

      case 'listening':
        return (
          <div className={`vo-indicator vo-indicator--listening`} style={{ width: size, height: size }}>
            <div className="vo-pulse-ring" />
            <div className="vo-pulse-ring vo-pulse-ring--second" />
            {muted ? <MicOffIcon size={iconSize} /> : <MicIcon size={iconSize} />}
          </div>
        );

      case 'thinking':
        return (
          <div className={`vo-indicator vo-indicator--thinking`} style={{ width: size, height: size }}>
            <div className="vo-spinner">
              <div className="vo-spinner-dot" />
              <div className="vo-spinner-dot" />
              <div className="vo-spinner-dot" />
            </div>
          </div>
        );

      case 'speaking':
        return (
          <div className={`vo-indicator vo-indicator--speaking`} style={{ width: size, height: size }}>
            <WaveformVisualizer
              active={true}
              mode="speaking"
              color="#10b981"
              barCount={8}
              height={size - 12}
              width={size - 8}
            />
          </div>
        );
    }
  }

  // -----------------------------------------------------------------
  // Overlay class name
  // -----------------------------------------------------------------
  let overlayClass = 'vo-overlay';
  if (exiting) overlayClass += ' vo-overlay--exiting';
  if (isDragging) overlayClass += ' vo-overlay--dragging';

  return (
    <>
      <style>{STYLES}</style>
      <div
        ref={overlayRef}
        className={overlayClass}
        style={positionStyle}
        onMouseDown={handleMouseDown}
        role="dialog"
        aria-label="Voice talk mode overlay"
      >
        {!expanded ? (
          /* ---- Compact mode ---- */
          <div className="vo-compact" onClick={handleCompactClick}>
            <button
              className="vo-close"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              aria-label="Close talk mode"
              title="Close talk mode"
            >
              &times;
            </button>
            {renderIndicator()}
            <div className="vo-label">
              <span>{voiceName || 'Helix Voice'}</span>
              <span className="vo-label__state">{state}</span>
            </div>
            {state === 'speaking' && (
              <WaveformVisualizer
                active={true}
                mode="speaking"
                color="#10b981"
                barCount={12}
                height={24}
                width={60}
              />
            )}
          </div>
        ) : (
          /* ---- Expanded mode ---- */
          <div className="vo-expanded">
            {/* Header (click to collapse) */}
            <div className="vo-expanded__header" onClick={handleHeaderClick}>
              {renderIndicator()}
              <div style={{ flex: 1 }}>
                <div className="vo-expanded__title">{voiceName || 'Helix Voice'}</div>
                <div className="vo-expanded__state">{state}</div>
              </div>
              <button
                className="vo-expanded__close"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                aria-label="Close talk mode"
                title="Close talk mode"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="vo-expanded__content">
              {/* Transcript (user speech) */}
              {transcript && (
                <div className="vo-transcript">
                  <span className="vo-transcript__label">You</span>
                  <span className="vo-transcript__text">{transcript}</span>
                </div>
              )}

              {/* Waveform during speaking */}
              {state === 'speaking' && (
                <div className="vo-waveform">
                  <WaveformVisualizer
                    active={true}
                    mode="speaking"
                    color="#10b981"
                    barCount={32}
                    height={40}
                    width={280}
                  />
                </div>
              )}

              {/* Listening waveform */}
              {state === 'listening' && !muted && (
                <div className="vo-waveform">
                  <WaveformVisualizer
                    active={true}
                    mode="listening"
                    color="#6366f1"
                    barCount={32}
                    height={32}
                    width={280}
                  />
                </div>
              )}

              {/* Response (AI speech) */}
              {response && (
                <div className="vo-response" ref={responseRef}>
                  <span className="vo-response__label">Helix</span>
                  {response}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="vo-controls">
              <button
                className={`vo-btn ${muted ? 'vo-btn--muted' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute?.();
                }}
                aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                title={muted ? 'Unmute (Space)' : 'Mute (Space)'}
              >
                {muted ? <MicOffIcon size={14} /> : <MicIcon size={14} />}
                {muted ? 'Unmute' : 'Mute'}
              </button>

              {state === 'speaking' && onInterrupt && (
                <button
                  className="vo-btn vo-btn--interrupt"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInterrupt();
                  }}
                  aria-label="Interrupt response"
                  title="Interrupt"
                >
                  Interrupt
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default VoiceOverlay;
