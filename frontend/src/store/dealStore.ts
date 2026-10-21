import { create } from 'zustand';
import { Deal, DealStats } from '../../../shared/types';
import { apiGet, apiPost, apiPut } from '../utils/api';

interface DealState {
  // State
  deals: Deal[];
  selectedDeal: Deal | null;
  dealStats: DealStats | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDeals: (status?: string) => Promise<void>;
  fetchDealById: (dealId: string) => Promise<void>;
  fetchDealStats: () => Promise<void>;
  createDeal: (dealData: any) => Promise<Deal | null>;
  updateDeal: (dealId: string, updates: Partial<Deal>) => Promise<void>;
  selectDeal: (dealId: string | null) => void;
  clearError: () => void;
}

export const useDealStore = create<DealState>((set, get) => ({
  // Initial state
  deals: [],
  selectedDeal: null,
  dealStats: null,
  isLoading: false,
  error: null,

  // Fetch all deals
  fetchDeals: async (status?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') {
        params.append('status', status);
      }

      const data = await apiGet(`/api/deals/list?${params}`);

      if (data.success) {
        set({ deals: data.data || [], isLoading: false });
      } else {
        set({ error: data.error || 'Failed to fetch deals', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch deals', isLoading: false });
    }
  },

  // Fetch single deal by ID
  fetchDealById: async (dealId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiGet(`/api/deals/${dealId}`);

      if (data.success) {
        set({ selectedDeal: data.data, isLoading: false });

        // Also update in deals array if present
        const { deals } = get();
        const updatedDeals = deals.map((d) => (d.deal_id === dealId ? data.data : d));
        set({ deals: updatedDeals });
      } else {
        set({ error: data.error || 'Failed to fetch deal', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch deal', isLoading: false });
    }
  },

  // Fetch deal statistics
  fetchDealStats: async () => {
    try {
      const data = await apiGet('/api/deals/stats/overview');

      if (data.success) {
        set({ dealStats: data.data });
      }
    } catch (error: any) {
      console.error('Failed to fetch deal stats:', error);
    }
  },

  // Create new deal
  createDeal: async (dealData: any) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiPost('/api/deals', dealData);

      if (data.success) {
        const newDeal = data.data;

        // Add to deals array
        set((state) => ({
          deals: [newDeal, ...state.deals],
          isLoading: false,
        }));

        return newDeal;
      } else {
        set({ error: data.error || 'Failed to create deal', isLoading: false });
        return null;
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to create deal', isLoading: false });
      return null;
    }
  },

  // Update existing deal
  updateDeal: async (dealId: string, updates: Partial<Deal>) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiPut(`/api/deals/${dealId}`, updates);

      if (data.success) {
        const updatedDeal = data.deal;

        // Update in deals array
        set((state) => ({
          deals: state.deals.map((d) => (d.deal_id === dealId ? updatedDeal : d)),
          selectedDeal: state.selectedDeal?.deal_id === dealId ? updatedDeal : state.selectedDeal,
          isLoading: false,
        }));
      } else {
        set({ error: data.error || 'Failed to update deal', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to update deal', isLoading: false });
    }
  },

  // Select a deal
  selectDeal: (dealId: string | null) => {
    if (dealId === null) {
      set({ selectedDeal: null });
      return;
    }

    const { deals } = get();
    const deal = deals.find((d) => d.deal_id === dealId);
    set({ selectedDeal: deal || null });
  },

  // Clear error
  clearError: () => set({ error: null }),
}));
