import { useState, useCallback, useMemo } from 'react';

export type PanelType = 'thinking' | 'terminal' | 'diff' | 'chat';

interface PanelState {
  thinking: boolean;
  terminal: boolean;
  diff: boolean;
  chat: boolean;
}

interface UsePanelsOptions {
  defaultPanels?: Partial<PanelState>;
  isMobile?: boolean;
}

interface UsePanelsReturn {
  panels: PanelState;
  activePanel: PanelType;
  togglePanel: (panel: PanelType) => void;
  showPanel: (panel: PanelType) => void;
  hidePanel: (panel: PanelType) => void;
  setActivePanel: (panel: PanelType) => void;
  isPanelVisible: (panel: PanelType) => boolean;
  visiblePanelCount: number;
}

const DEFAULT_PANELS: PanelState = {
  thinking: true,
  terminal: true,
  diff: false,
  chat: true,
};

export function usePanels(options: UsePanelsOptions = {}): UsePanelsReturn {
  const { defaultPanels = {}, isMobile = false } = options;

  const [panels, setPanels] = useState<PanelState>({
    ...DEFAULT_PANELS,
    ...defaultPanels,
  });

  const [activePanel, setActivePanel] = useState<PanelType>('chat');

  const togglePanel = useCallback((panel: PanelType) => {
    if (isMobile) {
      // On mobile, only show one panel at a time
      setActivePanel(panel);
    } else {
      setPanels((prev) => ({
        ...prev,
        [panel]: !prev[panel],
      }));
    }
  }, [isMobile]);

  const showPanel = useCallback((panel: PanelType) => {
    if (isMobile) {
      setActivePanel(panel);
    } else {
      setPanels((prev) => ({
        ...prev,
        [panel]: true,
      }));
    }
  }, [isMobile]);

  const hidePanel = useCallback((panel: PanelType) => {
    if (!isMobile) {
      setPanels((prev) => ({
        ...prev,
        [panel]: false,
      }));
    }
  }, [isMobile]);

  const isPanelVisible = useCallback((panel: PanelType) => {
    if (isMobile) {
      return activePanel === panel;
    }
    return panels[panel];
  }, [isMobile, activePanel, panels]);

  const visiblePanelCount = useMemo(() => {
    if (isMobile) return 1;
    return Object.values(panels).filter(Boolean).length;
  }, [isMobile, panels]);

  return {
    panels,
    activePanel,
    togglePanel,
    showPanel,
    hidePanel,
    setActivePanel,
    isPanelVisible,
    visiblePanelCount,
  };
}
