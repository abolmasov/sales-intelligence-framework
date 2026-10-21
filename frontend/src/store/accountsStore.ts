import { create } from 'zustand';
import { AccountSummary, AccountDetail } from '../../../shared/types';
import { apiGet, apiPatch, apiPost } from '../utils/api';

interface AccountsState {
  accounts: AccountSummary[];
  accountDetails: Record<string, AccountDetail>;
  loading: boolean;
  error: string | null;
  fetchAccounts: () => Promise<void>;
  fetchAccountDetail: (accountId: string, force?: boolean) => Promise<AccountDetail | null>;
  createAccount: (payload: {
    name: string;
    domain?: string;
    owner?: string;
    industry?: string;
    location?: string;
    summary?: string;
  }) => Promise<AccountSummary | null>;
  updateAccount: (accountId: string, updates: Partial<{
    name: string;
    domain: string;
    owner: string;
    industry: string;
    location: string;
    summary: string;
  }>) => Promise<AccountSummary | null>;
  clearError: () => void;
  findAccountByDomain: (domain: string) => AccountSummary | null;
  findAccountByName: (name: string) => AccountSummary | null;
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  accountDetails: {},
  loading: false,
  error: null,

  fetchAccounts: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiGet('/api/accounts');
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to load accounts');
      }
      set({ accounts: response.data || [], loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to load accounts', loading: false });
    }
  },

  fetchAccountDetail: async (accountId: string, force = false) => {
    const state = get();
    if (!force && state.accountDetails[accountId]) {
      return state.accountDetails[accountId];
    }

    set({ loading: true, error: null });
    try {
      const response = await apiGet(`/api/accounts/${accountId}`);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to load account');
      }
      const detail = response.data as AccountDetail;
      set((prev) => ({
        accountDetails: { ...prev.accountDetails, [accountId]: detail },
        loading: false,
      }));
      return detail;
    } catch (error: any) {
      set({ error: error.message || 'Failed to load account', loading: false });
      return null;
    }
  },

  createAccount: async (payload) => {
    set({ loading: true, error: null });
    try {
      const response = await apiPost('/api/accounts', payload);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to create account');
      }

      const created = response.data as AccountSummary;
      set((prev) => ({
        accounts: [created, ...prev.accounts],
        loading: false,
      }));
      return created;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create account', loading: false });
      return null;
    }
  },

  updateAccount: async (accountId, updates) => {
    set({ loading: true, error: null });
    try {
      const response = await apiPatch(`/api/accounts/${accountId}`, updates);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to update account');
      }
      const updated = response.data as AccountSummary;
      set((prev) => ({
        accounts: prev.accounts.map((acct) => (acct.account_id === updated.account_id ? updated : acct)),
        accountDetails: prev.accountDetails[accountId]
          ? { ...prev.accountDetails, [accountId]: { ...prev.accountDetails[accountId], ...updated } }
          : prev.accountDetails,
        loading: false,
      }));
      return updated;
    } catch (error: any) {
      set({ error: error.message || 'Failed to update account', loading: false });
      return null;
    }
  },

  clearError: () => set({ error: null }),

  findAccountByDomain: (domain: string) => {
    if (!domain) return null;
    const normalizedDomain = domain.toLowerCase().trim();
    const { accounts } = get();
    return accounts.find((acc) => acc.domain?.toLowerCase() === normalizedDomain) || null;
  },

  findAccountByName: (name: string) => {
    if (!name) return null;
    const normalizedName = name.toLowerCase().trim();
    const { accounts } = get();
    return accounts.find((acc) => acc.name.toLowerCase() === normalizedName) || null;
  },
}));
