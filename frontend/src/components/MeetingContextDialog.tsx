import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import WorkIcon from '@mui/icons-material/Work';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAccountsStore } from '../store/accountsStore';
import { apiPost, apiPatch, apiGet } from '../utils/api';

interface ExternalAttendee {
  email: string;
  name?: string;
}

interface MeetingData {
  meeting_id: string;
  title: string;
  meeting_date?: string | null;
  external_attendees?: ExternalAttendee[];
  account_id?: string | null;
  deal_id?: string | null;
}

interface MeetingContextDialogProps {
  open: boolean;
  onClose: () => void;
  meeting: MeetingData;
  onContextSet: (accountId: string, dealId: string) => void;
}

// Extract domain from email
const extractDomainFromEmail = (email: string): string | null => {
  const match = email.match(/@([^@]+)$/);
  if (!match) return null;
  const domain = match[1].toLowerCase();
  // Filter out common email providers
  const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
  if (commonProviders.includes(domain)) return null;
  return domain;
};

// Extract company name from domain (simple heuristic)
const domainToCompanyName = (domain: string): string => {
  // Remove TLD and capitalize
  const parts = domain.split('.');
  const name = parts[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
};

// Extract deal name from meeting title
const extractDealName = (title: string): string => {
  // Remove common prefixes
  const cleanTitle = title
    .replace(/^(call with|meeting with|intro|introduction|discovery|follow up|follow-up)\s*/i, '')
    .replace(/\s*@\s*.*$/, '') // Remove @company suffix
    .trim();

  return cleanTitle || 'New Opportunity';
};

export const MeetingContextDialog: React.FC<MeetingContextDialogProps> = ({
  open,
  onClose,
  meeting,
  onContextSet,
}) => {
  // Detect info from meeting
  const detectedDomain = useMemo(() => {
    const attendees = meeting.external_attendees || [];
    for (const attendee of attendees) {
      const domain = extractDomainFromEmail(attendee.email);
      if (domain) return domain;
    }
    return null;
  }, [meeting.external_attendees]);

  const suggestedCompanyName = useMemo(() => {
    if (!detectedDomain) return '';
    return domainToCompanyName(detectedDomain);
  }, [detectedDomain]);

  const suggestedDealName = useMemo(() => {
    return extractDealName(meeting.title);
  }, [meeting.title]);

  // State
  const [mode, setMode] = useState<'quick' | 'custom'>('quick');
  const [accountOption, setAccountOption] = useState<'create' | 'existing'>('create');
  const [dealOption, setDealOption] = useState<'create' | 'existing'>('create');
  const [accountName, setAccountName] = useState(suggestedCompanyName);
  const [accountDomain, setAccountDomain] = useState(detectedDomain || '');
  const [dealName, setDealName] = useState(suggestedDealName);
  const [dealStage, setDealStage] = useState('Discovery');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [existingDeals, setExistingDeals] = useState<Array<{ deal_id: string; opportunity_name: string; stage: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts from store
  const { accounts, fetchAccounts, fetchAccountDetail } = useAccountsStore();

  useEffect(() => {
    if (open && accounts.length === 0) {
      fetchAccounts();
    }
  }, [open, accounts.length, fetchAccounts]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMode('quick');
      setAccountOption('create');
      setDealOption('create');
      setAccountName(suggestedCompanyName);
      setAccountDomain(detectedDomain || '');
      setDealName(suggestedDealName);
      setDealStage('Discovery');
      setSelectedAccountId(null);
      setSelectedDealId(null);
      setExistingDeals([]);
      setError(null);
    }
  }, [open, suggestedCompanyName, detectedDomain, suggestedDealName]);

  // Find matching accounts by domain
  const matchingAccounts = useMemo(() => {
    if (!detectedDomain) return accounts;
    return accounts.filter(
      (a) =>
        a.domain?.toLowerCase() === detectedDomain.toLowerCase() ||
        a.name.toLowerCase().includes(suggestedCompanyName.toLowerCase())
    );
  }, [accounts, detectedDomain, suggestedCompanyName]);

  // Fetch deals when account is selected
  useEffect(() => {
    const fetchDeals = async () => {
      if (selectedAccountId) {
        try {
          const response = await apiGet(`/api/accounts/${selectedAccountId}`);
          if (response?.success && response.data?.deals) {
            setExistingDeals(
              response.data.deals.map((d: any) => ({
                deal_id: d.deal_id,
                opportunity_name: d.opportunity_name,
                stage: d.stage,
              }))
            );
          }
        } catch (err) {
          console.error('Failed to fetch deals:', err);
        }
      } else {
        setExistingDeals([]);
      }
    };
    fetchDeals();
  }, [selectedAccountId]);

  // Handle quick create
  const handleQuickCreate = async () => {
    if (!accountName.trim()) {
      setError('Account name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create account
      const accountResponse = await apiPost('/api/accounts', {
        name: accountName.trim(),
        domain: accountDomain || detectedDomain || undefined,
      });

      if (!accountResponse?.success) {
        throw new Error(accountResponse?.error || 'Failed to create account');
      }

      const newAccountId = accountResponse.data.account_id;

      // Step 2: Create deal
      const dealResponse = await apiPost('/api/deals', {
        opportunityName: dealName.trim() || suggestedDealName,
        companyName: accountName.trim(),
        accountId: newAccountId,
        stage: 'research',
      });

      if (!dealResponse?.success) {
        throw new Error(dealResponse?.error || 'Failed to create deal');
      }

      const newDealId = dealResponse.data.dealId || dealResponse.data.deal_id;

      // Step 3: Link meeting to account and deal
      await apiPatch(`/api/meetings/${meeting.meeting_id}`, {
        accountId: newAccountId,
        dealId: newDealId,
      });

      await fetchAccounts();
      await fetchAccountDetail(newAccountId, true).catch(() => undefined);
      onContextSet(newAccountId, newDealId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create context');
    } finally {
      setLoading(false);
    }
  };

  // Handle custom create
  const handleCustomCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      let finalAccountId: string;
      let finalDealId: string;

      // Step 1: Get or create account
      if (accountOption === 'create') {
        if (!accountName.trim()) {
          throw new Error('Account name is required');
        }

        const accountResponse = await apiPost('/api/accounts', {
          name: accountName.trim(),
          domain: accountDomain || detectedDomain || undefined,
        });

        if (!accountResponse?.success) {
          throw new Error(accountResponse?.error || 'Failed to create account');
        }

        finalAccountId = accountResponse.data.account_id;
      } else {
        if (!selectedAccountId) {
          throw new Error('Please select an account');
        }
        finalAccountId = selectedAccountId;
      }

      // Step 2: Get or create deal
      if (dealOption === 'create') {
        if (!dealName.trim()) {
          throw new Error('Deal name is required');
        }

        const dealResponse = await apiPost('/api/deals', {
          opportunityName: dealName.trim(),
          companyName: accountOption === 'create' ? accountName.trim() :
            accounts.find(a => a.account_id === finalAccountId)?.name || '',
          accountId: finalAccountId,
          stage: dealStage.toLowerCase().replace(' ', '_'),
        });

        if (!dealResponse?.success) {
          throw new Error(dealResponse?.error || 'Failed to create deal');
        }

        finalDealId = dealResponse.data.dealId || dealResponse.data.deal_id;
      } else {
        if (!selectedDealId) {
          throw new Error('Please select a deal');
        }
        finalDealId = selectedDealId;
      }

      // Step 3: Link meeting to account and deal
      await apiPatch(`/api/meetings/${meeting.meeting_id}`, {
        accountId: finalAccountId,
        dealId: finalDealId,
      });

      await fetchAccounts();
      await fetchAccountDetail(finalAccountId, true).catch(() => undefined);
      onContextSet(finalAccountId, finalDealId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to set context');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Set Up Meeting Context</DialogTitle>

      <DialogContent>
        {/* Meeting Info */}
        <Box
          sx={{
            mb: 3,
            p: 2,
            bgcolor: 'grey.50',
            borderRadius: 2,
            border: 1,
            borderColor: 'grey.200',
          }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            {meeting.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {meeting.meeting_date
              ? new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'Date TBD'}
          </Typography>
          {detectedDomain && (
            <Box sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={`Detected: ${detectedDomain}`}
                color="info"
                variant="outlined"
              />
            </Box>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Quick Mode */}
        {mode === 'quick' && (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Quick Setup
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Create account and deal with detected information
              </Typography>

              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BusinessIcon fontSize="small" color="primary" />
                    <Typography variant="body2" color="text.secondary">
                      Account:
                    </Typography>
                  </Stack>
                  <TextField
                    size="small"
                    fullWidth
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Company name"
                    sx={{ mt: 0.5 }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <WorkIcon fontSize="small" color="primary" />
                    <Typography variant="body2" color="text.secondary">
                      Deal:
                    </Typography>
                  </Stack>
                  <TextField
                    size="small"
                    fullWidth
                    value={dealName}
                    onChange={(e) => setDealName(e.target.value)}
                    placeholder="Deal name"
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              </Stack>

              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 3 }}
                onClick={handleQuickCreate}
                disabled={loading || !accountName.trim()}
                startIcon={loading ? <CircularProgress size={16} /> : <CheckCircleIcon />}
              >
                {loading ? 'Creating...' : 'Create & Continue'}
              </Button>

              <Button
                size="small"
                sx={{ mt: 1, display: 'block', mx: 'auto' }}
                onClick={() => setMode('custom')}
              >
                Need more options? Customize...
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Custom Mode */}
        {mode === 'custom' && (
          <Stack spacing={3}>
            {/* Account Section */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Account
              </Typography>
              <RadioGroup
                value={accountOption}
                onChange={(e) => {
                  setAccountOption(e.target.value as 'create' | 'existing');
                  setSelectedAccountId(null);
                  setDealOption('create');
                  setSelectedDealId(null);
                }}
              >
                <FormControlLabel
                  value="create"
                  control={<Radio size="small" />}
                  label={
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="body2">Create new account</Typography>
                      {accountOption === 'create' && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <TextField
                            size="small"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            placeholder="Account name"
                            sx={{ flex: 2 }}
                          />
                          <TextField
                            size="small"
                            value={accountDomain}
                            onChange={(e) => setAccountDomain(e.target.value)}
                            placeholder="Domain"
                            sx={{ flex: 1 }}
                          />
                        </Stack>
                      )}
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', mb: 1 }}
                />
                <FormControlLabel
                  value="existing"
                  control={<Radio size="small" />}
                  label={
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="body2">Link to existing account</Typography>
                      {accountOption === 'existing' && (
                        <FormControl size="small" sx={{ mt: 1, minWidth: 280 }}>
                          <InputLabel>Select account</InputLabel>
                          <Select
                            value={selectedAccountId || ''}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            label="Select account"
                          >
                            {(matchingAccounts.length > 0 ? matchingAccounts : accounts).map((acc) => (
                              <MenuItem key={acc.account_id} value={acc.account_id}>
                                {acc.name}
                                {acc.domain && (
                                  <Typography
                                    component="span"
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ ml: 1 }}
                                  >
                                    ({acc.domain})
                                  </Typography>
                                )}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
              </RadioGroup>
            </Box>

            <Divider />

            {/* Deal Section */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Deal
              </Typography>
              <RadioGroup
                value={dealOption}
                onChange={(e) => {
                  setDealOption(e.target.value as 'create' | 'existing');
                  setSelectedDealId(null);
                }}
              >
                <FormControlLabel
                  value="create"
                  control={<Radio size="small" />}
                  label={
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="body2">Create new deal</Typography>
                      {dealOption === 'create' && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <TextField
                            size="small"
                            value={dealName}
                            onChange={(e) => setDealName(e.target.value)}
                            placeholder="Deal name"
                            sx={{ flex: 2 }}
                          />
                          <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel>Stage</InputLabel>
                            <Select
                              value={dealStage}
                              onChange={(e) => setDealStage(e.target.value)}
                              label="Stage"
                            >
                              <MenuItem value="Discovery">Discovery</MenuItem>
                              <MenuItem value="Proposal">Proposal</MenuItem>
                              <MenuItem value="Negotiation">Negotiation</MenuItem>
                            </Select>
                          </FormControl>
                        </Stack>
                      )}
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', mb: 1 }}
                />
                <FormControlLabel
                  value="existing"
                  control={<Radio size="small" />}
                  disabled={existingDeals.length === 0 && accountOption === 'existing'}
                  label={
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="body2">
                        Link to existing deal
                        {existingDeals.length === 0 && accountOption === 'existing' && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            (No deals for selected account)
                          </Typography>
                        )}
                      </Typography>
                      {dealOption === 'existing' && existingDeals.length > 0 && (
                        <FormControl size="small" sx={{ mt: 1, minWidth: 280 }}>
                          <InputLabel>Select deal</InputLabel>
                          <Select
                            value={selectedDealId || ''}
                            onChange={(e) => setSelectedDealId(e.target.value)}
                            label="Select deal"
                          >
                            {existingDeals.map((deal) => (
                              <MenuItem key={deal.deal_id} value={deal.deal_id}>
                                {deal.opportunity_name}
                                <Chip
                                  size="small"
                                  label={deal.stage}
                                  sx={{ ml: 1, height: 20 }}
                                />
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
              </RadioGroup>
            </Box>

            <Button
              size="small"
              onClick={() => setMode('quick')}
              sx={{ alignSelf: 'flex-start' }}
            >
              ← Back to Quick Setup
            </Button>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        {mode === 'custom' && (
          <Button
            variant="contained"
            onClick={handleCustomCreate}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            {loading ? 'Saving...' : 'Save & Continue'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MeetingContextDialog;
