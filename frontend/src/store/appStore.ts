import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type MainView =
  | 'about'
  | 'deals'
  | 'calendar'
  | 'analysis'
  | 'research'
  | 'analytics'
  | 'settings'
  | 'logs'
  | 'rag'
  | 'history'
  | 'knowledge-graphs'
  | 'case-studies';

interface AppState {
  // Navigation state
  mainView: MainView;
  setMainView: (view: MainView) => void;

  // User preferences
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  // UI state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Notification/Toast state
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: Date;
  }>;
  addNotification: (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string
  ) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial navigation state
      mainView: 'about',
      setMainView: (view) => set({ mainView: view }),

      // Initial theme
      theme: 'light',
      setTheme: (theme) => set({ theme }),

      // Initial UI state
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Initial notifications
      notifications: [],
      addNotification: (type, message) => {
        const id = `${Date.now()}-${Math.random()}`;
        set((state) => ({
          notifications: [
            ...state.notifications,
            {
              id,
              type,
              message,
              timestamp: new Date(),
            },
          ],
        }));

        // Auto-remove after 5 seconds
        setTimeout(() => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        }, 5000);
      },
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'sales-intelligence-app-storage', // unique name for localStorage key
      partialize: (state) => ({
        // Only persist these fields
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        mainView: state.mainView,
      }),
    }
  )
);
