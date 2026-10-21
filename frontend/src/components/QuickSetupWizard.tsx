import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Chip,
  Autocomplete,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  AutoAwesome as AutoIcon,
  Business as AccountIcon,
  Handshake as DealIcon,
  Link as LinkIcon,
  CheckCircle as SuccessIcon,
  Edit as EditIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import type { CalendarMeeting } from '../types/calendarMeeting';
import type { AccountSummary, AccountDeal } from '../../../shared/types/account';
import { apiPost, apiPatch } from '../utils/api';
import { deriveCompanyFromMeeting, getDomainFromAttendees } from '../utils/companyDetection';
import { useAccountsStore } from '../store/accountsStore';

interface QuickSetupWizardProps {
  meeting: CalendarMeeting;
  accounts: AccountSummary[];
  onComplete: (result: {
    account: { account_id: string; name: string; created: boolean };
    deal: { deal_id: string; opportunity_name: string };
  }) => void;
  onCancel: () => void;
}

// Company detection functions are now consolidated in utils/companyDetection.ts

const CREATE_NEW_DEAL = '__create_new__';

const QuickSetupWizard: React.FC<QuickSetupWizardProps> = ({
  meeting,
  accounts,
  onComplete,
  onCancel,
}) => {
  const detectedCompany = useMemo(() => deriveCompanyFromMeeting(meeting), [meeting]);
  const detectedDomain = useMemo(() => getDomainFromAttendees(meeting.externalAttendees || []), [meeting]);

  // Account store for fetching deals
  const accountDetails = useAccountsStore((state) => state.accountDetails);
  const fetchAccountDetail = useAccountsStore((state) => state.fetchAccountDetail);

  const [activeStep, setActiveStep] = useState(0);
  const [companyName, setCompanyName] = useState(detectedCompany);
  const [opportunityName, setOpportunityName] = useState(`${detectedCompany} Opportunity`);
  const [selectedAccount, setSelectedAccount] = useState<AccountSummary | null>(null);
  const [useExisting, setUseExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Deal selection state
  const [selectedDealId, setSelectedDealId] = useState<string>(CREATE_NEW_DEAL);
  const [dealsLoading, setDealsLoading] = useState(false);

  // Get deals for the selected account
  const dealsForAccount: AccountDeal[] = useMemo(() => {
    if (!useExisting || !selectedAccount) return [];
    return accountDetails[selectedAccount.account_id]?.deals || [];
  }, [useExisting, selectedAccount, accountDetails]);

  // Fetch deals when an existing account is selected
  useEffect(() => {
    if (useExisting && selectedAccount && !accountDetails[selectedAccount.account_id]) {
      setDealsLoading(true);
      fetchAccountDetail(selectedAccount.account_id)
        .catch(() => undefined)
        .finally(() => setDealsLoading(false));
    }
  }, [useExisting, selectedAccount, accountDetails, fetchAccountDetail]);

  // Check if an account with similar name exists
  const matchingAccount = useMemo(() => {
    if (!companyName) return null;
    return accounts.find(
      (acc) =>
        acc.name.toLowerCase() === companyName.toLowerCase() ||
        (detectedDomain && acc.domain?.toLowerCase() === detectedDomain.toLowerCase())
    );
  }, [companyName, accounts, detectedDomain]);

  // Get selected deal details
  const selectedDeal = useMemo(() => {
    if (selectedDealId === CREATE_NEW_DEAL) return null;
    return dealsForAccount.find((d) => d.deal_id === selectedDealId) || null;
  }, [selectedDealId, dealsForAccount]);

  const handleNext = async () => {
    if (activeStep === 0) {
      // Validate company name
      if (!companyName.trim()) {
        setError('Company name is required');
        return;
      }
      setError(null);
      setActiveStep(1);
    } else if (activeStep === 1) {
      // Execute quick setup
      setLoading(true);
      setError(null);

      try {
        // If using existing deal, link the meeting to it
        if (selectedDeal && useExisting && selectedAccount) {
          const response = await apiPatch(`/api/deals/${selectedDeal.deal_id}/link-meeting`, {
            meetingId: meeting.id,
            calendarEventId: meeting.eventId || meeting.id,
            onlineMeetingId: meeting.onlineMeetingId || null,
            icalUid: meeting.icalUid || null,
            meetingTitle: meeting.title,
            meetingDate: meeting.startDateTime || meeting.date,
            durationMinutes: meeting.duration,
          });

          if (response?.success) {
            setResult({
              account: {
                account_id: selectedAccount.account_id,
                name: selectedAccount.name,
                created: false,
              },
              deal: {
                deal_id: selectedDeal.deal_id,
                opportunity_name: selectedDeal.opportunity_name,
                created: false,
              },
              meeting: { linked: true },
            });
            setActiveStep(2);
          } else {
            setError(response?.error || 'Failed to link meeting to deal');
          }
        } else {
          // Create new deal (and optionally new account)
          // If using an existing account but "Create New Deal" is selected, force create a new deal
          const shouldForceCreateDeal = useExisting && selectedAccount && selectedDealId === CREATE_NEW_DEAL;
          const response = await apiPost('/api/deals/quick-setup', {
            companyName: companyName.trim(),
            opportunityName: opportunityName.trim() || `${companyName.trim()} Opportunity`,
            // Send all 4 meeting ID formats for proper deduplication
            meetingId: meeting.id,
            calendarEventId: meeting.eventId || meeting.id,
            onlineMeetingId: meeting.onlineMeetingId || null,
            icalUid: meeting.icalUid || null,
            // Meeting metadata
            meetingTitle: meeting.title,
            meetingDate: meeting.startDateTime || meeting.date,
            durationMinutes: meeting.duration,
            // Account info
            domain: detectedDomain,
            existingAccountId: useExisting && selectedAccount ? selectedAccount.account_id : null,
            // Force create new deal when user explicitly selects "Create New Deal"
            forceCreateDeal: shouldForceCreateDeal,
          });

          if (response?.success) {
            setResult(response.data);
            setActiveStep(2);
          } else {
            setError(response?.error || 'Failed to create account and deal');
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to create account and deal');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleComplete = () => {
    if (result) {
      onComplete({
        account: result.account,
        deal: {
          deal_id: result.deal.deal_id,
          opportunity_name: result.deal.opportunity_name,
        },
      });
    }
  };

  const steps = ['Detect Company', 'Confirm Setup', 'Done'];

  return (
    <Box
      sx={{
        p: 2,
        border: '2px solid rgba(37, 99, 235, 0.3)',
        borderRadius: 2,
        background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
      }}
    >
      {/* Header */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <AutoIcon sx={{ color: 'secondary.main' }} />
        <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e40af' }}>
          Quick Setup
        </Typography>
      </Stack>

      {/* Stepper */}
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step Content */}
      {activeStep === 0 && (
        <Stack spacing={2}>
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="caption">
              We detected the company from this meeting. Verify or edit before proceeding.
            </Typography>
          </Alert>

          <TextField
            label="Company Name"
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              setOpportunityName(`${e.target.value} Opportunity`);
            }}
            fullWidth
            size="small"
            InputProps={{
              startAdornment: <AccountIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />,
            }}
          />

          {detectedDomain && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Detected domain:
              </Typography>
              <Chip label={detectedDomain} size="small" variant="outlined" />
            </Stack>
          )}

          {matchingAccount && !useExisting && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setUseExisting(true);
                    setSelectedAccount(matchingAccount);
                  }}
                >
                  Use Existing
                </Button>
              }
            >
              <Typography variant="caption">
                An account named "{matchingAccount.name}" already exists.
              </Typography>
            </Alert>
          )}

          {useExisting && (
            <Autocomplete
              options={accounts}
              value={selectedAccount}
              onChange={(_, newValue) => setSelectedAccount(newValue)}
              getOptionLabel={(option) => option.name}
              size="small"
              renderInput={(params) => (
                <TextField {...params} label="Select Existing Account" />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Stack>
                    <Typography variant="body2">{option.name}</Typography>
                    {option.domain && (
                      <Typography variant="caption" color="text.secondary">
                        {option.domain}
                      </Typography>
                    )}
                  </Stack>
                </li>
              )}
            />
          )}

          {/* Deal selection when using existing account */}
          {useExisting && selectedAccount && (
            <FormControl fullWidth size="small">
              <InputLabel>Select Deal</InputLabel>
              <Select
                value={selectedDealId}
                onChange={(e) => setSelectedDealId(e.target.value)}
                label="Select Deal"
                disabled={dealsLoading}
              >
                <MenuItem value={CREATE_NEW_DEAL}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AddIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                    <Typography variant="body2">Create New Deal</Typography>
                  </Stack>
                </MenuItem>
                {dealsLoading ? (
                  <MenuItem disabled>Loading deals...</MenuItem>
                ) : (
                  dealsForAccount.map((deal) => (
                    <MenuItem key={deal.deal_id} value={deal.deal_id}>
                      <Stack>
                        <Typography variant="body2">{deal.opportunity_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {deal.stage} • {deal.estimated_value ? `$${deal.estimated_value.toLocaleString()}` : 'No amount'}
                        </Typography>
                      </Stack>
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          )}

          {useExisting && (
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setUseExisting(false);
                setSelectedAccount(null);
                setSelectedDealId(CREATE_NEW_DEAL);
              }}
            >
              Create new account instead
            </Button>
          )}
        </Stack>
      )}

      {activeStep === 1 && (
        <Stack spacing={2}>
          <Typography variant="caption" color="text.secondary">
            Review what will be created:
          </Typography>

          <Box
            sx={{
              p: 1.5,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid rgba(0, 35, 72, 0.1)',
            }}
          >
            <Stack spacing={1.5}>
              {/* Account */}
              <Stack direction="row" spacing={1.5} alignItems="center">
                <AccountIcon sx={{ color: useExisting ? '#22c55e' : '#2563eb', fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {useExisting ? 'Using Existing Account' : 'New Account'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {useExisting && selectedAccount ? selectedAccount.name : companyName}
                  </Typography>
                </Box>
                {useExisting ? (
                  <Chip label="Existing" size="small" color="success" variant="outlined" />
                ) : (
                  <Chip label="New" size="small" color="primary" variant="outlined" />
                )}
              </Stack>

              <Divider />

              {/* Deal */}
              <Stack direction="row" spacing={1.5} alignItems="center">
                <DealIcon sx={{ color: selectedDeal ? '#22c55e' : '#8b5cf6', fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {selectedDeal ? 'Using Existing Deal' : 'New Deal'}
                  </Typography>
                  {selectedDeal ? (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {selectedDeal.opportunity_name}
                    </Typography>
                  ) : (
                    <TextField
                      value={opportunityName}
                      onChange={(e) => setOpportunityName(e.target.value)}
                      size="small"
                      fullWidth
                      variant="standard"
                      InputProps={{
                        endAdornment: <EditIcon sx={{ fontSize: 14, color: 'text.secondary' }} />,
                      }}
                    />
                  )}
                </Box>
                {selectedDeal ? (
                  <Chip label="Existing" size="small" color="success" variant="outlined" />
                ) : (
                  <Chip label="Prospecting" size="small" variant="outlined" />
                )}</Stack>

              <Divider />

              {/* Meeting Link */}
              <Stack direction="row" spacing={1.5} alignItems="center">
                <LinkIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Link Meeting
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {meeting.title}
                  </Typography>
                </Box>
                <Chip label="Auto" size="small" variant="outlined" />
              </Stack>
            </Stack>
          </Box>
        </Stack>
      )}

      {activeStep === 2 && result && (
        <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
          <SuccessIcon sx={{ fontSize: 48, color: 'success.main' }} />
          <Typography variant="body1" sx={{ fontWeight: 600, color: '#166534', textAlign: 'center' }}>
            Setup Complete!
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            {result.deal.created === false
              ? `Linked meeting to existing deal "${result.deal.opportunity_name}" under "${result.account.name}"`
              : result.account.created
                ? `Created account "${result.account.name}" and deal "${result.deal.opportunity_name}"`
                : `Created deal "${result.deal.opportunity_name}" under "${result.account.name}"`}
          </Typography>
          {result.meeting && (
            <Chip
              icon={<LinkIcon sx={{ fontSize: 14 }} />}
              label="Meeting linked"
              size="small"
              color="success"
              variant="outlined"
            />
          )}
        </Stack>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {/* Actions */}
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
        {activeStep < 2 && (
          <Button variant="text" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        {activeStep === 0 && (
          <Button variant="contained" onClick={handleNext}>
            Continue
          </Button>
        )}
        {activeStep === 1 && (
          <>
            <Button variant="text" onClick={() => setActiveStep(0)} disabled={loading}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoIcon />}
            >
              {loading ? 'Creating...' : 'Create & Link'}
            </Button>
          </>
        )}
        {activeStep === 2 && (
          <Button variant="contained" color="success" onClick={handleComplete}>
            Done
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default QuickSetupWizard;
