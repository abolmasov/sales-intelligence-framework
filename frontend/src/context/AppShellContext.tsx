import { AlertColor } from '@mui/material';
import { createContext, useContext } from 'react';

export interface ProposalFlowPayload {
  accountId?: string;
  analysisId?: string;
}

export interface PostCallFlowPayload {
  accountId?: string;
  meetingId?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type?: AlertColor;
  timestamp: number;
  read?: boolean;
}

interface ConfirmationConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

export interface AppShellContextValue {
  openProposalFlow: (payload?: ProposalFlowPayload) => void;
  openPostCallFlow: (payload?: PostCallFlowPayload) => void;
  closeProposalFlow: () => void;
  closePostCallFlow: () => void;
  setGlobalLoading: (state: { open: boolean; message?: string }) => void;
  showMessage: (state: { type: AlertColor; message: string }) => void;
  requestConfirmation: (config: ConfirmationConfig) => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => void;
  markNotificationsRead: () => void;
  notifications: AppNotification[];
}

export const AppShellContext = createContext<AppShellContextValue | undefined>(undefined);

export const useAppShell = () => {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error('useAppShell must be used within the application shell.');
  }

  return ctx;
};
