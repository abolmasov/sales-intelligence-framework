import { useState, useCallback } from 'react';
import {
  Alert,
  AlertColor,
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Typography,
  Slide,
  useTheme,
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import { AppShellContext, PostCallFlowPayload, ProposalFlowPayload, AppNotification } from './AppShellContext';
import ProposalFlowDialog from '../components/dialogs/ProposalFlowDialog';
import PostCallAnalysisDialog from '../components/dialogs/PostCallAnalysisDialog';

interface AppShellProviderProps {
  children: React.ReactNode;
}

const AppShellProvider = ({ children }: AppShellProviderProps) => {
  const theme = useTheme();
  const [proposalState, setProposalState] = useState<{ open: boolean; payload?: ProposalFlowPayload | null }>({
    open: false,
    payload: null,
  });
  const [postCallState, setPostCallState] = useState<{ open: boolean; payload?: PostCallFlowPayload | null }>({
    open: false,
    payload: null,
  });
  const [loadingState, setLoadingState] = useState<{ open: boolean; message?: string }>({ open: false });
  const [snackbar, setSnackbar] = useState<{ open: boolean; type: AlertColor; message: string } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
  }>({ open: false });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const openProposalFlow = useCallback((payload?: ProposalFlowPayload) => {
    setProposalState({ open: true, payload: payload ?? null });
  }, []);

  const closeProposalFlow = useCallback(() => {
    setProposalState({ open: false, payload: null });
  }, []);

  const openPostCallFlow = useCallback((payload?: PostCallFlowPayload) => {
    setPostCallState({ open: true, payload: payload ?? null });
  }, []);

  const closePostCallFlow = useCallback(() => {
    setPostCallState({ open: false, payload: null });
  }, []);

  const setGlobalLoading = useCallback((state: { open: boolean; message?: string }) => {
    setLoadingState(state);
  }, []);

  const showMessage = useCallback((state: { type: AlertColor; message: string }) => {
    setSnackbar({ open: true, ...state });
  }, []);

  const generateId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `notif-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const addNotification = useCallback(
    (notification: Omit<AppNotification, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => {
      const id = notification.id || generateId();
      const timestamp = notification.timestamp || Date.now();
      setNotifications((prev) => [{ ...notification, id, timestamp, read: false }, ...prev].slice(0, 30));
    },
    []
  );

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const requestConfirmation = useCallback(
    (config: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm?: () => void;
    }) => {
      setConfirmation({
        open: true,
        ...config,
      });
    },
    []
  );

  const handleConfirm = () => {
    confirmation.onConfirm?.();
    setConfirmation((prev) => ({ ...prev, open: false }));
  };

  const handleCloseConfirm = () => setConfirmation((prev) => ({ ...prev, open: false }));

  const SnackbarTransition = (props: any) => <Slide {...props} direction="left" />;

  return (
    <AppShellContext.Provider
      value={{
        openProposalFlow,
        openPostCallFlow,
        closeProposalFlow,
        closePostCallFlow,
        setGlobalLoading,
        showMessage,
        requestConfirmation,
        addNotification,
        markNotificationsRead,
        notifications,
      }}
    >
      {children}

      <ProposalFlowDialog
        open={proposalState.open}
        payload={proposalState.payload ?? undefined}
        onClose={closeProposalFlow}
        notify={showMessage}
      />

      <PostCallAnalysisDialog
        open={postCallState.open}
        payload={postCallState.payload ?? undefined}
        onClose={closePostCallFlow}
        onRun={() =>
          showMessage({
            type: 'success',
            message: 'Post-call analysis has started.',
          })
        }
      />

      <Backdrop
        open={loadingState.open}
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 2, flexDirection: 'column' }}
      >
        <CircularProgress color="inherit" />
        {loadingState.message && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {loadingState.message}
          </Typography>
        )}
      </Backdrop>

      {snackbar && (
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        TransitionComponent={SnackbarTransition}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.type}
          variant={snackbar.type === 'success' ? 'outlined' : 'filled'}
          icon={
            snackbar.type === 'success' ? (
              <CheckCircle sx={{ color: '#00A48C' }} />
            ) : undefined
          }
          onClose={() => setSnackbar(null)}
          sx={
            snackbar.type === 'success'
              ? {
                  bgcolor: '#FFFDF7',
                  borderColor: '#D5E7E7',
                  color: '#1A385E',
                  boxShadow: '0 10px 24px rgba(0, 35, 72, 0.08)',
                  '& .MuiAlert-icon': { mr: 1 },
                }
              : {}
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    )}

      <Dialog open={confirmation.open} onClose={handleCloseConfirm}>
        <DialogTitle>{confirmation.title ?? 'Are you sure?'}</DialogTitle>
        <DialogContent>
          <Typography>{confirmation.message ?? 'Confirm this action.'}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirm}>{confirmation.cancelLabel ?? 'Cancel'}</Button>
          <Button variant="contained" onClick={handleConfirm}>
            {confirmation.confirmLabel ?? 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppShellContext.Provider>
  );
};

export default AppShellProvider;
