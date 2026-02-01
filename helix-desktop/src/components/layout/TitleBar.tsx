import { useEffect, useState } from 'react';
import { isTauri, getTauriWindow } from '../../lib/tauri-compat';
import './TitleBar.css';

interface WindowControls {
  minimize: () => void;
  toggleMaximize: () => void;
  hide: () => void;
}

export function TitleBar() {
  const [windowControls, setWindowControls] = useState<WindowControls>({
    minimize: () => console.log('[Browser] minimize'),
    toggleMaximize: () => console.log('[Browser] toggleMaximize'),
    hide: () => console.log('[Browser] hide'),
  });

  useEffect(() => {
    if (isTauri) {
      getTauriWindow().then((appWindow) => {
        setWindowControls({
          minimize: () => appWindow.minimize(),
          toggleMaximize: () => appWindow.toggleMaximize(),
          hide: () => appWindow.hide(),
        });
      });
    }
  }, []);

  return (
    <div className="title-bar" data-tauri-drag-region>
      <div className="title-bar-icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-3.5l6-4.5-6-4.5v9z"/>
        </svg>
      </div>
      <span className="title-bar-title">Helix</span>
      <div className="title-bar-controls">
        <button className="title-bar-button" onClick={windowControls.minimize}>
          <svg viewBox="0 0 12 12" width="12" height="12">
            <rect y="5" width="12" height="2" fill="currentColor"/>
          </svg>
        </button>
        <button className="title-bar-button" onClick={windowControls.toggleMaximize}>
          <svg viewBox="0 0 12 12" width="12" height="12">
            <rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="2" fill="none"/>
          </svg>
        </button>
        <button className="title-bar-button close" onClick={windowControls.hide}>
          <svg viewBox="0 0 12 12" width="12" height="12">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
