/**
 * BrowserPanel - Main browser automation control panel
 *
 * Orchestrates browser lifecycle (start/stop), URL navigation,
 * screenshot preview, tab management, action execution, and
 * accessibility snapshot viewing. All communication flows through
 * the gateway WebSocket using browser.* methods.
 *
 * Gateway methods used:
 *   - browser.start     -> Launch browser instance
 *   - browser.stop      -> Stop browser
 *   - browser.status    -> Get browser status
 *   - browser.snapshot  -> Get accessibility snapshot
 *   - browser.screenshot -> Capture screenshot (base64)
 *   - browser.navigate  -> Navigate to URL
 *   - browser.action    -> Perform action (click, type, etc.)
 *   - browser.tabs      -> List/manage tabs
 *   - browser.profiles  -> List browser profiles
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { BrowserPreview } from './BrowserPreview';
import { BrowserActions, type BrowserTab, type ActionLogEntry } from './BrowserActions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowserPanelProps {
  onMinimize?: () => void;
}

interface BrowserStatus {
  running: boolean;
  currentUrl: string;
  tabCount: number;
  pageTitle: string;
  loadTime?: number;
}

interface BrowserProfile {
  id: string;
  name: string;
}

// Gateway response types
interface BrowserStatusResponse {
  running: boolean;
  url?: string;
  tabs?: { title: string; url: string; active: boolean }[];
  pageTitle?: string;
}

interface BrowserTabsResponse {
  tabs: { title: string; url: string; active: boolean }[];
  activeIndex: number;
}

interface BrowserScreenshotResponse {
  data: string;
  format: string;
}

interface BrowserSnapshotResponse {
  snapshot: string;
}

interface BrowserProfilesResponse {
  profiles: BrowserProfile[];
}

interface BrowserActionResponse {
  success: boolean;
  result?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREENSHOT_REFRESH_INTERVAL_MS = 5000;
const DEFAULT_STATUS: BrowserStatus = {
  running: false,
  currentUrl: '',
  tabCount: 0,
  pageTitle: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrowserPanel({ onMinimize }: BrowserPanelProps) {
  const { getClient, connected } = useGateway();

  // Core state
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus>(DEFAULT_STATUS);
  const [screenshotData, setScreenshotData] = useState<string | undefined>();
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [snapshotData, setSnapshotData] = useState<string | undefined>();
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [urlInput, setUrlInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.55);

  // Refs
  const screenshotTimerRef = useRef<number | null>(null);
  const splitDragging = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // ---- Helper: Log action ----
  const logAction = useCallback(
    (action: string, target: string | undefined, result: string | undefined, success: boolean) => {
      setActionLog((prev) => [
        ...prev.slice(-99), // Keep last 100 entries
        { timestamp: Date.now(), action, target, result, success },
      ]);
    },
    []
  );

  // ---- Gateway request helper ----
  const gatewayRequest = useCallback(
    async <T,>(method: string, params?: Record<string, unknown>): Promise<T | null> => {
      const client = getClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return null;
      }
      try {
        return await client.request<T>(method, params);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return null;
      }
    },
    [getClient]
  );

  // ---- Fetch browser status ----
  const fetchStatus = useCallback(async () => {
    const result = await gatewayRequest<BrowserStatusResponse>('browser.status');
    if (result) {
      setBrowserStatus({
        running: result.running,
        currentUrl: result.url ?? '',
        tabCount: result.tabs?.length ?? 0,
        pageTitle: result.pageTitle ?? '',
      });
      if (result.url) {
        setUrlInput(result.url);
      }
      if (result.tabs) {
        setTabs(result.tabs);
        const activeIdx = result.tabs.findIndex((t) => t.active);
        if (activeIdx >= 0) setActiveTabIndex(activeIdx);
      }
    }
  }, [gatewayRequest]);

  // ---- Fetch tabs ----
  const fetchTabs = useCallback(async () => {
    const result = await gatewayRequest<BrowserTabsResponse>('browser.tabs', { action: 'list' });
    if (result) {
      setTabs(result.tabs);
      setActiveTabIndex(result.activeIndex);
      setBrowserStatus((prev) => ({ ...prev, tabCount: result.tabs.length }));
    }
  }, [gatewayRequest]);

  // ---- Fetch screenshot ----
  const fetchScreenshot = useCallback(async () => {
    if (screenshotLoading) return;
    setScreenshotLoading(true);
    const result = await gatewayRequest<BrowserScreenshotResponse>('browser.screenshot');
    if (result?.data) {
      setScreenshotData(result.data);
    }
    setScreenshotLoading(false);
  }, [gatewayRequest, screenshotLoading]);

  // ---- Fetch snapshot ----
  const fetchSnapshot = useCallback(async () => {
    const result = await gatewayRequest<BrowserSnapshotResponse>('browser.snapshot');
    if (result?.snapshot) {
      setSnapshotData(result.snapshot);
    }
  }, [gatewayRequest]);

  // ---- Fetch profiles ----
  const fetchProfiles = useCallback(async () => {
    const result = await gatewayRequest<BrowserProfilesResponse>('browser.profiles');
    if (result?.profiles) {
      setProfiles(result.profiles);
      if (result.profiles.length > 0 && !selectedProfile) {
        setSelectedProfile(result.profiles[0].id);
      }
    }
  }, [gatewayRequest, selectedProfile]);

  // ---- Start browser ----
  const handleStart = useCallback(async () => {
    setStarting(true);
    setError(null);
    const params: Record<string, unknown> = {};
    if (selectedProfile) params.profile = selectedProfile;
    const result = await gatewayRequest<{ success: boolean }>('browser.start', params);
    if (result?.success) {
      setBrowserStatus((prev) => ({ ...prev, running: true }));
      logAction('start', undefined, 'Browser started', true);
      // Fetch initial state after a brief delay for browser to initialize
      setTimeout(() => {
        fetchStatus();
        fetchScreenshot();
      }, 1000);
    } else {
      logAction('start', undefined, 'Failed to start browser', false);
    }
    setStarting(false);
  }, [gatewayRequest, selectedProfile, logAction, fetchStatus, fetchScreenshot]);

  // ---- Stop browser ----
  const handleStop = useCallback(async () => {
    setStopping(true);
    setError(null);
    const result = await gatewayRequest<{ success: boolean }>('browser.stop');
    if (result) {
      setBrowserStatus(DEFAULT_STATUS);
      setScreenshotData(undefined);
      setSnapshotData(undefined);
      setTabs([]);
      setActiveTabIndex(0);
      setUrlInput('');
      logAction('stop', undefined, 'Browser stopped', true);
    } else {
      logAction('stop', undefined, 'Failed to stop browser', false);
    }
    setStopping(false);
  }, [gatewayRequest, logAction]);

  // ---- Navigate ----
  const handleNavigate = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;

    // Add protocol if missing
    const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;

    setNavigating(true);
    setError(null);
    const startTime = Date.now();
    const result = await gatewayRequest<{ success: boolean; url?: string }>(
      'browser.navigate',
      { url: normalizedUrl }
    );
    const loadTime = Date.now() - startTime;

    if (result?.success) {
      setBrowserStatus((prev) => ({
        ...prev,
        currentUrl: result.url ?? normalizedUrl,
        loadTime,
      }));
      setUrlInput(result.url ?? normalizedUrl);
      logAction('navigate', normalizedUrl, `Loaded in ${loadTime}ms`, true);
      // Refresh screenshot after navigation
      setTimeout(fetchScreenshot, 500);
      setTimeout(fetchTabs, 300);
    } else {
      logAction('navigate', normalizedUrl, 'Navigation failed', false);
    }
    setNavigating(false);
  }, [urlInput, gatewayRequest, logAction, fetchScreenshot, fetchTabs]);

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleNavigate();
      }
    },
    [handleNavigate]
  );

  // ---- Tab management ----
  const handleSwitchTab = useCallback(
    async (index: number) => {
      const result = await gatewayRequest<{ success: boolean }>(
        'browser.tabs',
        { action: 'select', index }
      );
      if (result?.success) {
        setActiveTabIndex(index);
        logAction('switch_tab', `Tab ${index}`, 'Switched', true);
        setTimeout(fetchScreenshot, 300);
        setTimeout(fetchStatus, 200);
      }
    },
    [gatewayRequest, logAction, fetchScreenshot, fetchStatus]
  );

  const handleCloseTab = useCallback(
    async (index: number) => {
      const result = await gatewayRequest<{ success: boolean }>(
        'browser.tabs',
        { action: 'close', index }
      );
      if (result?.success) {
        logAction('close_tab', `Tab ${index}`, 'Closed', true);
        fetchTabs();
        setTimeout(fetchScreenshot, 300);
      }
    },
    [gatewayRequest, logAction, fetchTabs, fetchScreenshot]
  );

  const handleNewTab = useCallback(async () => {
    const result = await gatewayRequest<{ success: boolean }>(
      'browser.tabs',
      { action: 'new' }
    );
    if (result?.success) {
      logAction('new_tab', undefined, 'Created', true);
      fetchTabs();
    }
  }, [gatewayRequest, logAction, fetchTabs]);

  // ---- Browser action ----
  const handleAction = useCallback(
    async (action: string, params: Record<string, string>) => {
      setError(null);
      const result = await gatewayRequest<BrowserActionResponse>(
        'browser.action',
        { action, ...params }
      );
      if (result) {
        logAction(
          action,
          params.ref || params.text || params.direction || undefined,
          result.result || (result.success ? 'OK' : result.error || 'Failed'),
          result.success
        );
        if (result.success) {
          // Refresh screenshot after action
          setTimeout(fetchScreenshot, 300);
        }
      } else {
        logAction(action, params.ref || undefined, 'Request failed', false);
      }
    },
    [gatewayRequest, logAction, fetchScreenshot]
  );

  // ---- Screenshot click -> snapshot ----
  const handleClickSnapshot = useCallback(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // ---- Split panel resizing ----
  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    splitDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!splitDragging.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.min(Math.max(x / rect.width, 0.25), 0.75);
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      if (splitDragging.current) {
        splitDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ---- Initial load ----
  useEffect(() => {
    if (!connected) return;
    fetchStatus();
    fetchProfiles();
  }, [connected, fetchStatus, fetchProfiles]);

  // ---- Auto-refresh screenshot ----
  useEffect(() => {
    if (browserStatus.running && connected) {
      // Initial screenshot
      fetchScreenshot();

      // Set up interval
      screenshotTimerRef.current = window.setInterval(
        fetchScreenshot,
        SCREENSHOT_REFRESH_INTERVAL_MS
      );
    }

    return () => {
      if (screenshotTimerRef.current !== null) {
        clearInterval(screenshotTimerRef.current);
        screenshotTimerRef.current = null;
      }
    };
  }, [browserStatus.running, connected, fetchScreenshot]);

  // ---- Navigation buttons ----
  const handleGoBack = useCallback(async () => {
    await gatewayRequest('browser.action', { action: 'goBack' });
    logAction('back', undefined, 'Navigated back', true);
    setTimeout(() => {
      fetchStatus();
      fetchScreenshot();
    }, 300);
  }, [gatewayRequest, logAction, fetchStatus, fetchScreenshot]);

  const handleGoForward = useCallback(async () => {
    await gatewayRequest('browser.action', { action: 'goForward' });
    logAction('forward', undefined, 'Navigated forward', true);
    setTimeout(() => {
      fetchStatus();
      fetchScreenshot();
    }, 300);
  }, [gatewayRequest, logAction, fetchStatus, fetchScreenshot]);

  const handleRefreshPage = useCallback(async () => {
    await gatewayRequest('browser.action', { action: 'reload' });
    logAction('refresh', undefined, 'Page refreshed', true);
    setTimeout(() => {
      fetchStatus();
      fetchScreenshot();
    }, 500);
  }, [gatewayRequest, logAction, fetchStatus, fetchScreenshot]);

  // ---- Not connected state ----
  if (!connected) {
    return (
      <div className="bp-root">
        <style>{browserPanelStyles}</style>
        <div className="bp-disconnected">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="bp-disconnected-icon">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <h3 className="bp-disconnected-title">Gateway Not Connected</h3>
          <p className="bp-disconnected-desc">
            Connect to the gateway to use browser automation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bp-root">
      <style>{browserPanelStyles}</style>

      {/* ---- Top bar ---- */}
      <header className="bp-topbar">
        <div className="bp-topbar-left">
          {/* Status indicator */}
          <div className={`bp-status-indicator ${browserStatus.running ? 'bp-status-indicator--running' : 'bp-status-indicator--stopped'}`}>
            <span className="bp-status-dot" />
            <span className="bp-status-text">
              {browserStatus.running ? 'Running' : 'Stopped'}
            </span>
          </div>

          {/* Start/Stop button */}
          {browserStatus.running ? (
            <button
              className="bp-btn bp-btn--danger"
              onClick={handleStop}
              disabled={stopping}
              type="button"
            >
              {stopping ? (
                <>
                  <div className="bp-btn-spinner" />
                  Stopping...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  Stop
                </>
              )}
            </button>
          ) : (
            <button
              className="bp-btn bp-btn--primary"
              onClick={handleStart}
              disabled={starting}
              type="button"
            >
              {starting ? (
                <>
                  <div className="bp-btn-spinner" />
                  Starting...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start
                </>
              )}
            </button>
          )}

          {/* Profile dropdown */}
          {profiles.length > 0 && (
            <select
              className="bp-profile-select"
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              disabled={browserStatus.running}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="bp-topbar-right">
          {/* Minimize button */}
          {onMinimize && (
            <button
              className="bp-btn bp-btn--ghost"
              onClick={onMinimize}
              title="Minimize"
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* ---- URL bar ---- */}
      <div className="bp-urlbar">
        {/* Navigation buttons */}
        <button
          className="bp-nav-btn"
          onClick={handleGoBack}
          disabled={!browserStatus.running}
          title="Go back"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          className="bp-nav-btn"
          onClick={handleGoForward}
          disabled={!browserStatus.running}
          title="Go forward"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
        <button
          className="bp-nav-btn"
          onClick={handleRefreshPage}
          disabled={!browserStatus.running}
          title="Refresh page"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>

        {/* URL input */}
        <div className="bp-url-input-wrapper">
          {navigating && <div className="bp-url-loading-bar" />}
          <input
            className="bp-url-input"
            type="text"
            placeholder="Enter URL..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            disabled={!browserStatus.running}
            spellCheck={false}
          />
        </div>

        {/* Go button */}
        <button
          className="bp-btn bp-btn--accent bp-go-btn"
          onClick={handleNavigate}
          disabled={!browserStatus.running || !urlInput.trim() || navigating}
          type="button"
        >
          {navigating ? (
            <div className="bp-btn-spinner" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          )}
        </button>
      </div>

      {/* ---- Error banner ---- */}
      {error && (
        <div className="bp-error-banner">
          <span className="bp-error-text">{error}</span>
          <button
            className="bp-error-dismiss"
            onClick={() => setError(null)}
            type="button"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ---- Main area: Split panels ---- */}
      <div className="bp-main" ref={splitContainerRef}>
        {/* Left panel - Screenshot Preview */}
        <div className="bp-panel bp-panel--left" style={{ flex: splitRatio }}>
          <BrowserPreview
            screenshotData={screenshotData}
            loading={screenshotLoading}
            onRefresh={fetchScreenshot}
            onClickSnapshot={handleClickSnapshot}
          />
        </div>

        {/* Resize handle */}
        <div className="bp-split-handle" onMouseDown={handleSplitMouseDown}>
          <div className="bp-split-handle-bar" />
        </div>

        {/* Right panel - Controls */}
        <div className="bp-panel bp-panel--right" style={{ flex: 1 - splitRatio }}>
          <BrowserActions
            tabs={tabs}
            activeTabIndex={activeTabIndex}
            actionLog={actionLog}
            snapshotData={snapshotData}
            onSwitchTab={handleSwitchTab}
            onCloseTab={handleCloseTab}
            onNewTab={handleNewTab}
            onAction={handleAction}
          />
        </div>
      </div>

      {/* ---- Bottom status bar ---- */}
      <footer className="bp-statusbar">
        <div className="bp-statusbar-left">
          {browserStatus.running ? (
            browserStatus.loadTime ? (
              <span className="bp-statusbar-text">
                Page loaded in {(browserStatus.loadTime / 1000).toFixed(1)}s
              </span>
            ) : navigating ? (
              <span className="bp-statusbar-text bp-statusbar-text--loading">
                Loading...
              </span>
            ) : (
              <span className="bp-statusbar-text">Ready</span>
            )
          ) : (
            <span className="bp-statusbar-text bp-statusbar-text--inactive">
              Browser not running
            </span>
          )}
        </div>
        <div className="bp-statusbar-right">
          {browserStatus.pageTitle && (
            <span className="bp-statusbar-title" title={browserStatus.pageTitle}>
              {browserStatus.pageTitle.length > 40
                ? browserStatus.pageTitle.slice(0, 40) + '...'
                : browserStatus.pageTitle}
            </span>
          )}
          {browserStatus.running && (
            <span className="bp-statusbar-tabs">
              {browserStatus.tabCount} tab{browserStatus.tabCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}

export default BrowserPanel;

// ---------------------------------------------------------------------------
// Scoped styles (bp- prefix)
// ---------------------------------------------------------------------------

const browserPanelStyles = `
/* Root */
.bp-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary, #0a0a1a);
  color: var(--text-primary, #fff);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  overflow: hidden;
}

/* Top bar */
.bp-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  min-height: 44px;
  padding: 0 12px;
  background: var(--bg-secondary, #111127);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  gap: 10px;
  flex-shrink: 0;
}

.bp-topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bp-topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Status indicator */
.bp-status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid;
}

.bp-status-indicator--running {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.25);
  color: #34d399;
}

.bp-status-indicator--stopped {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.bp-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bp-status-indicator--running .bp-status-dot {
  background: #10b981;
  box-shadow: 0 0 4px rgba(16, 185, 129, 0.5);
  animation: bp-pulse 2s ease-in-out infinite;
}

.bp-status-indicator--stopped .bp-status-dot {
  background: #ef4444;
}

@keyframes bp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Buttons */
.bp-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  font-family: inherit;
  line-height: 1;
}

.bp-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bp-btn--primary {
  background: var(--accent-color, #6366f1);
  color: #fff;
}

.bp-btn--primary:hover:not(:disabled) {
  background: #818cf8;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
}

.bp-btn--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.bp-btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}

.bp-btn--ghost {
  background: transparent;
  color: var(--text-secondary, #a0a0c0);
  padding: 5px 8px;
}

.bp-btn--ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary, #fff);
}

.bp-btn--accent {
  background: var(--accent-color, #6366f1);
  color: #fff;
}

.bp-btn--accent:hover:not(:disabled) {
  background: #818cf8;
}

.bp-btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: bp-spin 0.6s linear infinite;
}

@keyframes bp-spin {
  to { transform: rotate(360deg); }
}

/* Profile dropdown */
.bp-profile-select {
  padding: 4px 8px;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--text-primary, #fff);
  font-size: 11px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  max-width: 140px;
}

.bp-profile-select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bp-profile-select:focus {
  border-color: var(--accent-color, #6366f1);
}

/* URL bar */
.bp-urlbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--bg-secondary, #111127);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.bp-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.bp-nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary, #fff);
}

.bp-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.bp-url-input-wrapper {
  flex: 1;
  position: relative;
  min-width: 0;
}

.bp-url-loading-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--accent-color, #6366f1);
  border-radius: 1px;
  animation: bp-loading 1.5s ease-in-out infinite;
}

@keyframes bp-loading {
  0% { width: 0%; left: 0; }
  50% { width: 60%; left: 20%; }
  100% { width: 0%; left: 100%; }
}

.bp-url-input {
  width: 100%;
  padding: 6px 10px;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-primary, #fff);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.bp-url-input:focus {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.bp-url-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.bp-url-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bp-go-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

/* Error banner */
.bp-error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.1);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  flex-shrink: 0;
}

.bp-error-text {
  flex: 1;
  font-size: 11px;
  color: #f87171;
}

.bp-error-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 3px;
  color: #f87171;
  cursor: pointer;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.bp-error-dismiss:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* Main split area */
.bp-main {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.bp-panel {
  display: flex;
  min-width: 0;
  overflow: hidden;
}

.bp-panel--left {
  background: var(--bg-primary, #0a0a1a);
}

.bp-panel--right {
  background: var(--bg-secondary, #111127);
}

/* Split resize handle */
.bp-split-handle {
  width: 8px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s ease;
  position: relative;
  z-index: 5;
}

.bp-split-handle:hover {
  background: rgba(99, 102, 241, 0.1);
}

.bp-split-handle-bar {
  width: 2px;
  height: 32px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 1px;
  transition: background 0.15s ease, height 0.15s ease;
}

.bp-split-handle:hover .bp-split-handle-bar {
  background: var(--accent-color, #6366f1);
  height: 48px;
}

/* Bottom status bar */
.bp-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  min-height: 28px;
  padding: 0 12px;
  background: var(--bg-secondary, #111127);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  flex-shrink: 0;
  gap: 12px;
}

.bp-statusbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.bp-statusbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.bp-statusbar-text {
  color: var(--text-secondary, #a0a0c0);
}

.bp-statusbar-text--loading {
  color: var(--accent-color, #6366f1);
}

.bp-statusbar-text--inactive {
  color: var(--text-tertiary, #606080);
}

.bp-statusbar-title {
  color: var(--text-tertiary, #606080);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.bp-statusbar-tabs {
  padding: 1px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  color: var(--text-tertiary, #606080);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

/* Disconnected state */
.bp-disconnected {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
}

.bp-disconnected-icon {
  color: var(--text-tertiary, #606080);
  opacity: 0.5;
}

.bp-disconnected-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
}

.bp-disconnected-desc {
  font-size: 13px;
  color: var(--text-tertiary, #606080);
  text-align: center;
  max-width: 280px;
  line-height: 1.4;
  margin: 0;
}

/* Responsive */
@media (max-width: 700px) {
  .bp-main {
    flex-direction: column;
  }

  .bp-panel--left,
  .bp-panel--right {
    flex: none !important;
    height: 50%;
    width: 100%;
  }

  .bp-split-handle {
    width: 100%;
    height: 8px;
    cursor: row-resize;
  }

  .bp-split-handle-bar {
    width: 32px;
    height: 2px;
  }
}
`;
