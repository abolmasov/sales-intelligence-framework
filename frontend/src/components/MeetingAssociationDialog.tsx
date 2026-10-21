import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Divider,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAccountsStore } from '../store/accountsStore';
import { apiPost } from '../utils/api';
import type { AccountSummary, AccountDeal } from '../../../shared/types/account';

interface MeetingAssociationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (params: {
    accountId: string | null;
    dealId: string | null;
    accountName?: string | null;
    dealName?: string | null;
  }) => void;
  defaultAccountId?: string | null;
  defaultDealId?: string | null;
  allowSkip?: boolean;
}

const CREATE_NEW_DEAL_VALUE = '__create_new__';

const MeetingAssociationDialog: React.FC<MeetingAssociationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  defaultAccountId = null,
  defaultDealId = null,
  allowSkip = true,
}) => {
  const accounts = useAccountsStore((state) => state.accounts);
  const accountDetails = useAccountsStore((state) => state.accountDetails);
  const fetchAccounts = useAccountsStore((state) => state.fetchAccounts);
  const fetchAccountDetail = useAccountsStore((state) => state.fetchAccountDetail);
  const loading = useAccountsStore((state) => state.loading);

  const [accountId, setAccountId] = useState<string | null>(defaultAccountId);
  const [dealId, setDealId] = useState<string | null>(defaultDealId);
  const [detailLoading, setDetailLoading] = useState(false);

  // New deal creation state
  const [isCreatingNewDeal, setIsCreatingNewDeal] = useState(false);
  const [newDealName, setNewDealName] = useState('');
  const [createDealLoading, setCreateDealLoading] = useState(false);
  const [createDealError, setCreateDealError] = useState<string | null>(null);

  useEffect(() => {
    if (open && accounts.length === 0) {
      fetchAccounts().catch(() => undefined);
    }
  }, [open, accounts.length, fetchAccounts]);

  useEffect(() => {
    if (!open) return;

    if (accountId && !accountDetails[accountId]) {
      setDetailLoading(true);
      fetchAccountDetail(accountId)
        .catch(() => undefined)
        .finally(() => setDetailLoading(false));
    } else {
      setDetailLoading(false);
    }
  }, [open, accountId, accountDetails, fetchAccountDetail]);

  // Track whether the dialog was just opened to prevent resetting user input
  const prevOpenRef = React.useRef(open);
  useEffect(() => {
    const wasJustOpened = !prevOpenRef.current && open;
    prevOpenRef.current = open;

    // Only reset state when the dialog is freshly opened, not on every dependency change
    if (wasJustOpened) {
      setAccountId(defaultAccountId);
      setDealId(defaultDealId);
      setIsCreatingNewDeal(false);
      setNewDealName('');
      setCreateDealError(null);
    }
  }, [open, defaultAccountId, defaultDealId]);

  const dealsForAccount: AccountDeal[] = useMemo(() => {
    if (!accountId) return [];
    return accountDetails[accountId]?.deals || [];
  }, [accountId, accountDetails]);

  const selectedAccountName =
    accounts.find((account) => account.account_id === accountId)?.name || null;
  const selectedDealName =
    dealsForAccount.find((deal) => deal.deal_id === dealId)?.opportunity_name || null;

  const handleDealChange = (value: string) => {
    if (value === CREATE_NEW_DEAL_VALUE) {
      setIsCreatingNewDeal(true);
      setDealId(null);
      // Default name based on account
      setNewDealName(selectedAccountName ? `${selectedAccountName} Opportunity` : 'New Opportunity');
    } else {
      setIsCreatingNewDeal(false);
      setDealId(value || null);
      setNewDealName('');
    }
    setCreateDealError(null);
  };

  const handleCreateDeal = async () => {
    const trimmedName = newDealName.trim();
    console.log('[MeetingAssociationDialog] handleCreateDeal called', {
      accountId,
      newDealName,
      trimmedName,
    });

    if (!accountId || !trimmedName) {
      setCreateDealError('Deal name is required');
      return;
    }

    setCreateDealLoading(true);
    setCreateDealError(null);

    const payload = {
      opportunityName: trimmedName,
      accountId: accountId,
      stage: 'prospecting',
      status: 'active',
    };
    console.log('[MeetingAssociationDialog] Sending payload:', payload);

    try {
      const response = await apiPost('/api/deals', payload);
      console.log('[MeetingAssociationDialog] Response received:', response);

      if (response?.success && response?.data?.deal_id) {
        // Force refresh account details to get the new deal
        await fetchAccountDetail(accountId, true);

        // Set the newly created deal as selected
        setDealId(response.data.deal_id);
        setIsCreatingNewDeal(false);
        setNewDealName('');
      } else {
        console.log('[MeetingAssociationDialog] Error in response:', response?.error);
        setCreateDealError(response?.error || 'Failed to create deal');
      }
    } catch (err: any) {
      console.log('[MeetingAssociationDialog] Caught error:', err);
      setCreateDealError(err.message || 'Failed to create deal');
    } finally {
      setCreateDealLoading(false);
    }
  };

  const handleConfirm = () => {
    onConfirm({
      accountId,
      dealId: dealId || null,
      accountName: selectedAccountName,
      dealName: selectedDealName,
    });
  };

  const handleSkip = () => {
    onConfirm({ accountId: null, dealId: null, accountName: null, dealName: null });
  };

  const noAccounts = !loading && accounts.length === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Link this meeting</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose the account and deal this meeting belongs to. This helps keep your account
          hub organized and ensures analyses roll up to the right client.
        </Typography>

        {noAccounts ? (
          <Alert severity="info">
            No accounts available yet.{' '}
            <Button component={RouterLink} to="/app/accounts" size="small">
              Create an account
            </Button>
          </Alert>
        ) : (
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="meeting-account-label">Account</InputLabel>
              <Select
                labelId="meeting-account-label"
                label="Account"
                value={accountId || ''}
                onChange={(event) => {
                  setAccountId(event.target.value || null);
                  setDealId(null);
                  setIsCreatingNewDeal(false);
                  setNewDealName('');
                  setCreateDealError(null);
                }}
              >
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {accounts.map((account: AccountSummary) => (
                  <MenuItem key={account.account_id} value={account.account_id}>
                    {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {accountId && (
              <>
                <FormControl fullWidth size="small" disabled={detailLoading}>
                  <InputLabel id="meeting-deal-label">Deal</InputLabel>
                  <Select
                    labelId="meeting-deal-label"
                    label="Deal"
                    value={isCreatingNewDeal ? CREATE_NEW_DEAL_VALUE : (dealId || '')}
                    onChange={(event) => handleDealChange(event.target.value)}
                  >
                    <MenuItem value="">
                      <em>Not linked to a deal</em>
                    </MenuItem>
                    <Divider />
                    <MenuItem value={CREATE_NEW_DEAL_VALUE}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AddIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                        <Typography variant="body2" color="primary">
                          Create new deal
                        </Typography>
                      </Stack>
                    </MenuItem>
                    {dealsForAccount.length > 0 && <Divider />}
                    {dealsForAccount.map((deal) => (
                      <MenuItem key={deal.deal_id} value={deal.deal_id}>
                        {deal.opportunity_name}
                      </MenuItem>
                    ))}
                  </Select>
                  {detailLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <CircularProgress size={18} sx={{ mr: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        Loading deals…
                      </Typography>
                    </Box>
                  )}
                </FormControl>

                {/* New deal creation form */}
                {isCreatingNewDeal && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'rgba(37, 99, 235, 0.04)',
                      borderRadius: 1,
                      border: '1px solid rgba(37, 99, 235, 0.2)',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'primary.main' }}>
                      Create New Deal
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        label="Deal Name"
                        value={newDealName}
                        onChange={(e) => setNewDealName(e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="e.g., Acme Corp Q1 Engagement"
                        autoFocus
                      />
                      {createDealError && (
                        <Alert severity="error" sx={{ py: 0 }}>
                          {createDealError}
                        </Alert>
                      )}
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          onClick={() => {
                            setIsCreatingNewDeal(false);
                            setNewDealName('');
                            setCreateDealError(null);
                          }}
                          disabled={createDealLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleCreateDeal}
                          disabled={createDealLoading || !newDealName.trim()}
                          startIcon={createDealLoading ? <CircularProgress size={16} /> : <AddIcon />}
                        >
                          {createDealLoading ? 'Creating...' : 'Create Deal'}
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {allowSkip && (
          <Button onClick={handleSkip} color="inherit" disabled={loading || detailLoading || createDealLoading}>
            Skip for now
          </Button>
        )}
        <Button onClick={onClose} color="inherit" disabled={createDealLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading || detailLoading || createDealLoading || isCreatingNewDeal || (!accountId && !allowSkip)}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MeetingAssociationDialog;
