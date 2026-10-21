import { create } from 'zustand';
import { Meeting } from '../../../shared/types';
import { apiGet, apiPost, apiPut } from '../utils/api';

interface MeetingState {
  // State
  meetings: Meeting[];
  selectedMeeting: Meeting | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchMeetings: (dealId?: string) => Promise<void>;
  fetchMeetingById: (meetingId: string) => Promise<void>;
  createMeeting: (meetingData: any) => Promise<Meeting | null>;
  updateMeeting: (meetingId: string, updates: Partial<Meeting>) => Promise<void>;
  selectMeeting: (meetingId: string | null) => void;
  clearError: () => void;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  // Initial state
  meetings: [],
  selectedMeeting: null,
  isLoading: false,
  error: null,

  // Fetch all meetings (optionally filtered by deal)
  fetchMeetings: async (dealId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (dealId) {
        params.append('deal_id', dealId);
      }

      const data = await apiGet(`/api/meetings?${params}`);

      if (data.success) {
        set({ meetings: data.data || [], isLoading: false });
      } else {
        set({ error: data.error || 'Failed to fetch meetings', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch meetings', isLoading: false });
    }
  },

  // Fetch single meeting by ID
  fetchMeetingById: async (meetingId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiGet(`/api/meetings/${meetingId}`);

      if (data.success) {
        set({ selectedMeeting: data.data, isLoading: false });

        // Also update in meetings array if present
        const { meetings } = get();
        const updatedMeetings = meetings.map((m) =>
          m.meeting_id === meetingId ? data.data : m
        );
        set({ meetings: updatedMeetings });
      } else {
        set({ error: data.error || 'Failed to fetch meeting', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch meeting', isLoading: false });
    }
  },

  // Create new meeting
  createMeeting: async (meetingData: any) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiPost('/api/meetings', meetingData);

      if (data.success) {
        const newMeeting = data.data;

        // Add to meetings array
        set((state) => ({
          meetings: [newMeeting, ...state.meetings],
          isLoading: false,
        }));

        return newMeeting;
      } else {
        set({ error: data.error || 'Failed to create meeting', isLoading: false });
        return null;
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to create meeting', isLoading: false });
      return null;
    }
  },

  // Update existing meeting
  updateMeeting: async (meetingId: string, updates: Partial<Meeting>) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiPut(`/api/meetings/${meetingId}`, updates);

      if (data.success) {
        const updatedMeeting = data.data;

        // Update in meetings array
        set((state) => ({
          meetings: state.meetings.map((m) => (m.meeting_id === meetingId ? updatedMeeting : m)),
          selectedMeeting:
            state.selectedMeeting?.meeting_id === meetingId
              ? updatedMeeting
              : state.selectedMeeting,
          isLoading: false,
        }));
      } else {
        set({ error: data.error || 'Failed to update meeting', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to update meeting', isLoading: false });
    }
  },

  // Select a meeting
  selectMeeting: (meetingId: string | null) => {
    if (meetingId === null) {
      set({ selectedMeeting: null });
      return;
    }

    const { meetings } = get();
    const meeting = meetings.find((m) => m.meeting_id === meetingId);
    set({ selectedMeeting: meeting || null });
  },

  // Clear error
  clearError: () => set({ error: null }),
}));
