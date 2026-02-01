import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type ActivePanel = 'thinking' | 'terminal' | 'diff' | null;
export type SidebarSection = 'sessions' | 'psychology' | 'memory';

interface UiState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarWidth: number;
  activeSidebarSection: SidebarSection;

  // Panels
  activePanel: ActivePanel;
  panelWidth: number;

  // Theme
  theme: Theme;
  resolvedTheme: 'light' | 'dark';

  // Layout
  isCompactMode: boolean;
  showStatusBar: boolean;

  // Modals
  activeModal: string | null;
  modalProps: Record<string, unknown>;

  // Notifications
  notifications: Notification[];

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarSection: (section: SidebarSection) => void;

  setActivePanel: (panel: ActivePanel) => void;
  togglePanel: (panel: ActivePanel) => void;
  setPanelWidth: (width: number) => void;

  setTheme: (theme: Theme) => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;

  setCompactMode: (compact: boolean) => void;
  setShowStatusBar: (show: boolean) => void;

  openModal: (modal: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: number;
  duration?: number;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarOpen: true,
      sidebarWidth: 280,
      activeSidebarSection: 'sessions',
      activePanel: null,
      panelWidth: 400,
      theme: 'system',
      resolvedTheme: 'dark',
      isCompactMode: false,
      showStatusBar: true,
      activeModal: null,
      modalProps: {},
      notifications: [],

      // Sidebar actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),
      setSidebarSection: (section) => set({ activeSidebarSection: section }),

      // Panel actions
      setActivePanel: (panel) => set({ activePanel: panel }),
      togglePanel: (panel) => {
        const current = get().activePanel;
        set({ activePanel: current === panel ? null : panel });
      },
      setPanelWidth: (width) => set({ panelWidth: Math.max(300, Math.min(600, width)) }),

      // Theme actions
      setTheme: (theme) => set({ theme }),
      setResolvedTheme: (theme) => set({ resolvedTheme: theme }),

      // Layout actions
      setCompactMode: (compact) => set({ isCompactMode: compact }),
      setShowStatusBar: (show) => set({ showStatusBar: show }),

      // Modal actions
      openModal: (modal, props = {}) => set({ activeModal: modal, modalProps: props }),
      closeModal: () => set({ activeModal: null, modalProps: {} }),

      // Notification actions
      addNotification: (notification) => {
        const fullNotification: Notification = {
          ...notification,
          id: generateId(),
          timestamp: Date.now(),
        };

        set((state) => ({
          notifications: [...state.notifications, fullNotification].slice(-10),
        }));

        // Auto-remove after duration
        if (notification.duration !== 0) {
          setTimeout(() => {
            get().removeNotification(fullNotification.id);
          }, notification.duration || 5000);
        }
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'helix-ui-storage',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        panelWidth: state.panelWidth,
        theme: state.theme,
        isCompactMode: state.isCompactMode,
        showStatusBar: state.showStatusBar,
      }),
    }
  )
);
