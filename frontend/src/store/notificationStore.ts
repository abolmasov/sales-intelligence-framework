import { create } from 'zustand';
import { apiGet, apiPost } from '../utils/api';

export interface ServerNotification {
  notification_id: string;
  type: string;
  title: string;
  message: string;
  deal_id?: string;
  meeting_id?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: ServerNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  pollingInterval: number | null;

  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationIds?: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  lastFetched: null,
  pollingInterval: null,

  fetchNotifications: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiGet('/api/notifications');
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to fetch notifications');
      }
      const notifications = (response.data || []) as ServerNotification[];
      const unreadCount = notifications.filter((n) => !n.read).length;
      set({
        notifications,
        unreadCount,
        loading: false,
        lastFetched: new Date(),
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch notifications',
        loading: false,
      });
    }
  },

  markAsRead: async (notificationIds?: string[]) => {
    try {
      const response = await apiPost('/api/notifications/mark-read', {
        notificationIds,
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to mark notifications as read');
      }
      // Refresh notifications after marking as read
      await get().fetchNotifications();
    } catch (error: any) {
      set({ error: error.message || 'Failed to mark notifications as read' });
    }
  },

  markAllAsRead: async () => {
    await get().markAsRead();
  },

  startPolling: (intervalMs = 30000) => {
    const state = get();
    // Clear any existing interval
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval);
    }

    // Fetch immediately
    get().fetchNotifications();

    // Set up polling
    const interval = window.setInterval(() => {
      get().fetchNotifications();
    }, intervalMs);

    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const state = get();
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval);
      set({ pollingInterval: null });
    }
  },

  clearError: () => set({ error: null }),
}));
