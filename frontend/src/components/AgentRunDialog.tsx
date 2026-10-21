import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import {
  Close,
  AccountTree,
  CheckCircle,
  CalendarMonth,
  Business,
  Handshake,
  Info,
  Workspaces,
} from '@mui/icons-material';
import { apiPost, apiGet } from '../utils/api';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import { useDealStore } from '../store/dealStore';
import { useAccountsStore } from '../store/accountsStore';
import { COLORS } from '../styles/pageStyles';

type AgentCategory = 'analysis' | 'generation' | 'research' | 'automation';

interface InputField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'textarea' | 'deal_select' | 'account_select' | 'meeting_select' | 'workspace_select';
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  requiresTranscript?: boolean;
}

export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: AgentCategory;
  capabilities: string[];
  inputFields?: InputField[];
  prerequisite?: string;
  status: 'available' | 'running' | 'disabled';
}

interface AgentRunDialogProps {
  open: boolean;
  onClose: () => void;
  agent: AgentMetadata | null;
}

type RunPhase = 'input' | 'running' | 'completed' | 'error';

export const AgentRunDialog: React.FC<AgentRunDialogProps> = ({ open, onClose, agent }) => {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<RunPhase>('input');
  const [statusText, setStatusText] = useState('Starting agent...');
  const [errorMessage, setErrorMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Workspace data (inline fetch — no store needed)
  const [workspaces, setWorkspaces] = useState<Array<{ workspace_id: string; name: string; status: string; workspace_type?: string; client_name?: string }>>([]);

  // Pull real data from stores for selectors
  const meetings = useCalendarMeetingsStore((s) => s.meetings);
  const fetchMeetings = useCalendarMeetingsStore((s) => s.fetchMeetings);
  const deals = useDealStore((s) => s.deals);
  const fetchDeals = useDealStore((s) => s.fetchDeals);
  const accounts = useAccountsStore((s) => s.accounts);
  const fetchAccounts = useAccountsStore((s) => s.fetchAccounts);

  // Build option lists from store data
  const meetingOptions = meetings.map((m) => ({
    id: m.id,
    label: `${m.title} — ${m.company}`,
    secondary: m.date ? new Date(m.date).toLocaleDateString() : '',
    hasTranscript: !!m.transcriptAvailable,
  }));

  const dealOptions = deals.map((d) => ({
    id: d.deal_id,
    label: d.opportunity_name,
    secondary: d.company_name || '',
    stage: d.stage,
  }));

  const accountOptions = accounts.map((a) => ({
    id: a.account_id,
    label: a.name,
    secondary: [a.industry, a.owner].filter(Boolean).join(' · '),
  }));

  // Fetch store data when dialog opens
  useEffect(() => {
    if (!open || !agent) return;

    const fields = agent.inputFields || [];
    const needsMeetings = fields.some((f) => f.type === 'meeting_select');
    const needsDeals = fields.some((f) => f.type === 'deal_select');
    const needsAccounts = fields.some((f) => f.type === 'account_select');
    const needsWorkspaces = fields.some((f) => f.type === 'workspace_select');

    if (needsMeetings && meetings.length === 0) fetchMeetings({ pastDays: 30, futureDays: 14 });
    if (needsDeals && deals.length === 0) fetchDeals();
    if (needsAccounts && accounts.length === 0) fetchAccounts();
    if (needsWorkspaces) {
      apiGet('/api/workspaces')
        .then((res: any) => {
          const list = res?.data?.workspaces || res?.data || [];
          setWorkspaces(Array.isArray(list) ? list : []);
        })
        .catch(() => setWorkspaces([]));
    }
  }, [open, agent]);

  // Reset state when dialog opens or agent changes
  useEffect(() => {
    if (open && agent) {
      setFormValues({});
      setPhase('input');
      setStatusText('Starting agent...');
      setErrorMessage('');
    }
  }, [open, agent]);

  // Clean up polling on unmount or close
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleStart = async () => {
    if (!agent) return;

    const missing = (agent.inputFields || []).filter(
      (f) => f.required && !formValues[f.name]?.trim()
    );
    if (missing.length > 0) return;

    setPhase('running');
    setStatusText('Starting agent...');

    try {
      const res = await apiPost(`/api/agents/${agent.id}/run`, formValues);
      const result = res?.data || res;
      const jobId = result?.jobId || result?.job_id || result?.id;

      if (!jobId) {
        setPhase('error');
        setErrorMessage('No job ID returned from server.');
        return;
      }

      setStatusText('Agent is running...');

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await apiGet(`/api/agents/runs/${jobId}/status`);
          const status = statusRes?.data || statusRes;
          const state = status?.status || status?.state;

          if (state === 'completed' || state === 'done' || state === 'success') {
            stopPolling();
            setPhase('completed');
          } else if (state === 'failed' || state === 'error') {
            stopPolling();
            setPhase('error');
            setErrorMessage(status.error || status.message || 'Agent run failed.');
          } else {
            setStatusText(status.message || status.statusText || 'Agent is running...');
          }
        } catch {
          stopPolling();
          setPhase('error');
          setErrorMessage('Failed to check agent status.');
        }
      }, 5000);
    } catch (err: any) {
      setPhase('error');
      setErrorMessage(err?.message || 'Failed to start agent.');
    }
  };

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  if (!agent) return null;

  const isFormValid = (agent.inputFields || [])
    .filter((f) => f.required)
    .every((f) => formValues[f.name]?.trim());

  const renderField = (field: InputField) => {
    const inputSx = {
      '& .MuiOutlinedInput-root': {
        borderRadius: 1.5,
        '& fieldset': { borderColor: 'divider' },
        '&:hover fieldset': { borderColor: 'divider' },
        '&.Mui-focused fieldset': { borderColor: COLORS.accent },
      },
    };

    if (field.type === 'meeting_select') {
      const filteredMeetings = field.requiresTranscript
        ? meetingOptions.filter((o) => o.hasTranscript)
        : meetingOptions;
      const selected = filteredMeetings.find((o) => o.id === formValues[field.name]) || null;
      return (
        <Box key={field.name}>
          <Autocomplete
            options={filteredMeetings}
            value={selected}
            onChange={(_, val) => handleFieldChange(field.name, val?.id || '')}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                  <CalendarMonth sx={{ fontSize: 18, color: 'text.disabled' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }} noWrap>
                      {option.label}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {option.secondary}
                      </Typography>
                      {option.hasTranscript && (
                        <Chip
                          label="Transcript"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: alpha(COLORS.success, 0.1),
                            color: COLORS.success,
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={field.label}
                required={field.required}
                placeholder="Search meetings..."
                size="small"
                sx={inputSx}
              />
            )}
            noOptionsText={
              field.requiresTranscript
                ? 'No meetings with transcripts — sync your calendar or upload a transcript first'
                : 'No meetings found — sync your calendar first'
            }
            fullWidth
          />
          {field.helpText && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, ml: 0.5, display: 'block' }}>
              {field.helpText}
            </Typography>
          )}
        </Box>
      );
    }

    if (field.type === 'deal_select') {
      const selected = dealOptions.find((o) => o.id === formValues[field.name]) || null;
      return (
        <Box key={field.name}>
          <Autocomplete
            options={dealOptions}
            value={selected}
            onChange={(_, val) => handleFieldChange(field.name, val?.id || '')}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                  <Handshake sx={{ fontSize: 18, color: 'text.disabled' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }} noWrap>
                      {option.label}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {option.secondary}
                      </Typography>
                      {option.stage && (
                        <Chip
                          label={option.stage.replace('_', ' ')}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: 'action.hover',
                            color: 'text.secondary',
                            textTransform: 'capitalize',
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={field.label}
                required={field.required}
                placeholder="Search deals..."
                size="small"
                sx={inputSx}
              />
            )}
            noOptionsText="No deals found — create a deal first"
            fullWidth
          />
          {field.helpText && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, ml: 0.5, display: 'block' }}>
              {field.helpText}
            </Typography>
          )}
        </Box>
      );
    }

    if (field.type === 'workspace_select') {
      const workspaceOptions = workspaces
        .filter((w) => !['analyzing', 'miro_generating', 'pptx_generating'].includes(w.status))
        .map((w) => ({
          id: w.workspace_id,
          label: w.name,
          status: w.status,
          type: w.workspace_type,
          clientName: w.client_name,
        }));
      const selected = workspaceOptions.find((o) => o.id === formValues[field.name]) || null;
      return (
        <Box key={field.name}>
          <Autocomplete
            options={workspaceOptions}
            value={selected}
            onChange={(_, val) => handleFieldChange(field.name, val?.id || '')}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                  <Workspaces sx={{ fontSize: 18, color: 'text.disabled' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }} noWrap>
                      {option.label}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Chip
                        label={option.status}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          bgcolor: option.status === 'completed'
                            ? alpha(COLORS.success, 0.1)
                            : COLORS.gray100,
                          color: option.status === 'completed'
                            ? COLORS.success
                            : COLORS.gray600,
                          textTransform: 'capitalize',
                        }}
                      />
                      {option.type && (
                        <Chip
                          label={option.type.replace(/_/g, ' ')}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: 'action.hover',
                            color: 'text.secondary',
                            textTransform: 'capitalize',
                          }}
                        />
                      )}
                      {option.clientName && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {option.clientName}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={field.label}
                required={field.required}
                placeholder="Search workspaces..."
                size="small"
                sx={inputSx}
              />
            )}
            noOptionsText="No workspaces found — create a workspace first"
            fullWidth
          />
          {field.helpText && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, ml: 0.5, display: 'block' }}>
              {field.helpText}
            </Typography>
          )}
        </Box>
      );
    }

    if (field.type === 'account_select') {
      const selected = accountOptions.find((o) => o.id === formValues[field.name]) || null;
      return (
        <Box key={field.name}>
          <Autocomplete
            options={accountOptions}
            value={selected}
            onChange={(_, val) => handleFieldChange(field.name, val?.id || '')}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                  <Business sx={{ fontSize: 18, color: 'text.disabled' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }} noWrap>
                      {option.label}
                    </Typography>
                    {option.secondary && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {option.secondary}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={field.label}
                required={field.required}
                placeholder="Search accounts..."
                size="small"
                sx={inputSx}
              />
            )}
            noOptionsText="No accounts found — add an account first"
            fullWidth
          />
          {field.helpText && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, ml: 0.5, display: 'block' }}>
              {field.helpText}
            </Typography>
          )}
        </Box>
      );
    }

    // Default: text / textarea
    return (
      <Box key={field.name}>
        <TextField
          label={field.label}
          placeholder={field.placeholder}
          required={field.required}
          multiline={field.type === 'textarea'}
          rows={field.type === 'textarea' ? 4 : undefined}
          value={formValues[field.name] || ''}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          fullWidth
          size="small"
          sx={inputSx}
        />
        {field.helpText && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, ml: 0.5, display: 'block' }}>
            {field.helpText}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          borderColor: 'divider',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, pr: 6 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: alpha(agent.color, 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AccountTree sx={{ fontSize: 20, color: agent.color }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {agent.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {agent.description}
            </Typography>
          </Box>
        </Stack>
        <IconButton
          onClick={handleClose}
          sx={{ position: 'absolute', top: 8, right: 8, color: 'text.disabled' }}
        >
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Input Phase */}
        {phase === 'input' && (
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {agent.prerequisite && (
              <Alert
                severity="info"
                icon={<Info fontSize="small" />}
                sx={{ borderRadius: 1.5, '& .MuiAlert-message': { fontSize: '0.82rem' } }}
              >
                {agent.prerequisite}
              </Alert>
            )}
            {(agent.inputFields || []).map((field) => renderField(field))}
            <Button
              variant="contained"
              onClick={handleStart}
              disabled={!isFormValid}
              fullWidth
              sx={{
                mt: 1,
                bgcolor: 'primary.main',
                fontWeight: 500,
                borderRadius: 1.5,
                boxShadow: 'none',
                py: 1.2,
                '&:hover': { bgcolor: 'text.primary', boxShadow: 'none' },
                '&.Mui-disabled': { bgcolor: 'action.selected', color: 'text.disabled' },
              }}
            >
              Start Agent
            </Button>
          </Stack>
        )}

        {/* Running Phase */}
        {phase === 'running' && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <AccountTree sx={{ fontSize: 40, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              {statusText}
            </Typography>
            <LinearProgress
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: agent.color, borderRadius: 2 },
              }}
            />
          </Box>
        )}

        {/* Completed Phase */}
        {phase === 'completed' && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 48, color: COLORS.success, mb: 1.5 }} />
            <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5 }}>
              Agent completed successfully.
            </Alert>
            <Button
              variant="contained"
              onClick={handleClose}
              sx={{
                bgcolor: 'primary.main',
                fontWeight: 500,
                borderRadius: 1.5,
                boxShadow: 'none',
                '&:hover': { bgcolor: 'text.primary', boxShadow: 'none' },
              }}
            >
              Done
            </Button>
          </Box>
        )}

        {/* Error Phase */}
        {phase === 'error' && (
          <Box sx={{ py: 3 }}>
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
              {errorMessage}
            </Alert>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={() => setPhase('input')}
                sx={{
                  borderColor: 'divider',
                  color: 'text.secondary',
                  borderRadius: 1.5,
                  '&:hover': { borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', bgcolor: 'background.default' },
                }}
              >
                Try Again
              </Button>
              <Button
                variant="contained"
                onClick={handleClose}
                sx={{
                  bgcolor: 'primary.main',
                  fontWeight: 500,
                  borderRadius: 1.5,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: 'text.primary', boxShadow: 'none' },
                }}
              >
                Close
              </Button>
            </Stack>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
