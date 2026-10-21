import { trackFeature } from '../hooks/useAnalytics';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Tooltip,
  Avatar,
  LinearProgress,
  Menu,
  Fade,
  alpha,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import BusinessIcon from '@mui/icons-material/Business';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EventIcon from '@mui/icons-material/Event';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CloudIcon from '@mui/icons-material/Cloud';
import { useAccountsStore } from '../store/accountsStore';
import { AccountSummary, AccountDeal } from '../../../shared/types/account';
import { apiPost } from '../utils/api';
import { useAppShell } from '../context/AppShellContext';
import { COLORS } from '../styles/pageStyles';

const DEAL_STAGE_OPTIONS = [
  { value: 'prospecting', label: 'Prospecting', progress: 10 },
  { value: 'qualification', label: 'Qualification', progress: 25 },
  { value: 'proposal_sent', label: 'Proposal Sent', progress: 50 },
  { value: 'negotiation', label: 'Negotiation', progress: 75 },
  { value: 'closed_won', label: 'Closed-Won', progress: 100 },
  { value: 'closed_lost', label: 'Closed-Lost', progress: 100 },
];

const getStageColor = (stage: string) => {
  switch (stage) {
    case 'closed_won': return COLORS.success;
    case 'closed_lost': return COLORS.error;
    case 'negotiation': return COLORS.purple;
    case 'proposal_sent': return COLORS.info;
    case 'qualification': return '#0891b2';
    default: return COLORS.slate500;
  }
};

// Compact Stat Card Component
const AccountsPage = () => {
  const navigate = useNavigate();
  const params = useParams<{ accountId?: string }>();
  const {
    accounts,
    accountDetails,
    loading: accountsLoading,
    error,
    fetchAccounts,
    fetchAccountDetail,
    createAccount,
    updateAccount,
  } = useAccountsStore();
  const { showMessage } = useAppShell();

  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState({
    name: '',
    domain: '',
    owner: '',
    industry: '',
    location: '',
  });
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);
  const [newDealData, setNewDealData] = useState({
    account_id: '',
    opportunity_name: '',
    company_name: '',
    stage: DEAL_STAGE_OPTIONS[0].value,
    priority: 'medium',
    owner: '',
    estimated_value: '',
  });
  const [summaryDraft, setSummaryDraft] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());

  // Account menu state
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<null | HTMLElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editAccount, setEditAccount] = useState({
    name: '',
    domain: '',
    owner: '',
    industry: '',
    location: '',
  });

  const selectedAccountId = params.accountId || (accounts[0]?.account_id ?? null);
  const selectedAccountSummary = selectedAccountId
    ? accounts.find((account) => account.account_id === selectedAccountId) || null
    : null;
  const selectedAccountDetail = selectedAccountId ? accountDetails[selectedAccountId] || null : null;

  useEffect(() => {
    if (accounts.length === 0) {
      fetchAccounts().catch(() => undefined);
    }
  }, [accounts.length, fetchAccounts]);

  useEffect(() => {
    if (!params.accountId && accounts.length > 0) {
      navigate(`/app/accounts/${accounts[0].account_id}`, { replace: true });
    }
  }, [accounts, navigate, params.accountId]);

  useEffect(() => {
    if (selectedAccountId) {
      setDetailLoading(true);
      fetchAccountDetail(selectedAccountId)
        .catch(() => undefined)
        .finally(() => setDetailLoading(false));
    }
  }, [selectedAccountId, fetchAccountDetail]);

  useEffect(() => {
    if (selectedAccountDetail) {
      setSummaryDraft(selectedAccountDetail.summary || '');
      setEditingSummary(false);
    }
  }, [selectedAccountDetail?.summary, selectedAccountId]);

  useEffect(() => {
    if (selectedAccountSummary) {
      setNewDealData((prev) => ({
        ...prev,
        account_id: selectedAccountSummary.account_id,
        company_name: selectedAccountSummary.name,
      }));
    }
  }, [selectedAccountSummary?.account_id, selectedAccountSummary?.name]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const matchesSearch =
        account.name.toLowerCase().includes(search.toLowerCase()) ||
        (account.industry || '').toLowerCase().includes(search.toLowerCase()) ||
        (account.domain || '').toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [accounts, search]);

  const handleAccountSelect = (account: AccountSummary) => {
    navigate(`/app/accounts/${account.account_id}`);
  };

  const handleCreateAccount = async () => {
    if (!newAccount.name.trim()) {
      setCreateError('Account name is required.');
      return;
    }

    const created = await createAccount({
      name: newAccount.name,
      owner: newAccount.owner || undefined,
      industry: newAccount.industry || undefined,
      domain: newAccount.domain || undefined,
      location: newAccount.location || undefined,
    });

    if (created) {
      trackFeature('account_research', 'account_created', { accountName: newAccount.name });
      setNewAccount({ name: '', domain: '', owner: '', industry: '', location: '' });
      setCreateDialogOpen(false);
      setCreateError(null);
      navigate(`/app/accounts/${created.account_id}`);
    }
  };

  const handleCreateDeal = async () => {
    const trimmedName = newDealData.opportunity_name.trim();
    const trimmedCompany = newDealData.company_name.trim();

    if (!newDealData.account_id) {
      setDealError('Account selection is required.');
      return;
    }
    if (!trimmedName) {
      setDealError('Opportunity name is required.');
      return;
    }

    try {
      await apiPost('/api/deals', {
        opportunityName: trimmedName,
        companyName: trimmedCompany || selectedAccountSummary?.name,
        stage: newDealData.stage,
        priority: newDealData.priority,
        owner: newDealData.owner || undefined,
        estimatedValue: newDealData.estimated_value ? Number(newDealData.estimated_value) : undefined,
        accountId: newDealData.account_id,
      });
      setDealDialogOpen(false);
      setDealError(null);
      setNewDealData({
        account_id: selectedAccountSummary?.account_id || '',
        opportunity_name: '',
        company_name: selectedAccountSummary?.name || '',
        stage: DEAL_STAGE_OPTIONS[0].value,
        priority: 'medium',
        owner: '',
        estimated_value: '',
      });
      if (selectedAccountId) {
        await fetchAccountDetail(selectedAccountId, true);
      }
      showMessage({ type: 'success', message: 'Deal created successfully' });
    } catch (err: any) {
      setDealError(err?.message || 'Failed to create deal');
    }
  };

  const handleSaveSummary = async () => {
    if (!selectedAccountId) return;
    await updateAccount(selectedAccountId, { summary: summaryDraft });
    setEditingSummary(false);
    showMessage({ type: 'success', message: 'Summary updated' });
  };

  const handleOpenEditDialog = () => {
    if (selectedAccountSummary) {
      setEditAccount({
        name: selectedAccountSummary.name || '',
        domain: selectedAccountSummary.domain || '',
        owner: selectedAccountSummary.owner || '',
        industry: selectedAccountSummary.industry || '',
        location: selectedAccountSummary.location || '',
      });
      setEditError(null);
      setEditDialogOpen(true);
      setAccountMenuAnchor(null);
    }
  };

  const handleSaveEditAccount = async () => {
    if (!selectedAccountId) return;
    if (!editAccount.name.trim()) {
      setEditError('Account name is required.');
      return;
    }

    const updated = await updateAccount(selectedAccountId, {
      name: editAccount.name.trim(),
      domain: editAccount.domain.trim() || undefined,
      owner: editAccount.owner.trim() || undefined,
      industry: editAccount.industry.trim() || undefined,
      location: editAccount.location.trim() || undefined,
    });

    if (updated) {
      setEditDialogOpen(false);
      setEditError(null);
      showMessage({ type: 'success', message: 'Account updated' });
      await fetchAccountDetail(selectedAccountId, true);
    }
  };

  const dealsForAccount: AccountDeal[] = selectedAccountDetail?.deals || [];

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', bgcolor: 'background.default' }}>
      {/* Left Sidebar - Account List */}
      <Paper
        elevation={0}
        sx={{
          width: 320,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
        }}
      >
        {/* Sidebar Header */}
        <Box
          sx={{
            p: 3,
            background: COLORS.gradient,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: alpha('#fff', 0.15),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AccountBalanceIcon sx={{ color: 'white', fontSize: 22 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
                Accounts
              </Typography>
            </Stack>
            <Tooltip title="New Account">
              <IconButton
                size="small"
                onClick={() => setCreateDialogOpen(true)}
                sx={{
                  bgcolor: alpha('#fff', 0.15),
                  color: 'white',
                  '&:hover': { bgcolor: alpha('#fff', 0.25) },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <TextField
            size="small"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: alpha('#fff', 0.6), mr: 1 }} fontSize="small" />,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: alpha('#fff', 0.1),
                color: 'white',
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: alpha('#fff', 0.3) },
                '&.Mui-focused fieldset': { borderColor: alpha('#fff', 0.5) },
                '& input::placeholder': { color: alpha('#fff', 0.6) },
              },
            }}
          />
        </Box>

        {/* Account Count */}
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'background.default', borderBottom: '1px solid', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {/* Account List */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {accountsLoading && accounts.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={28} sx={{ color: COLORS.primary }} />
            </Box>
          ) : filteredAccounts.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <BusinessIcon sx={{ fontSize: 48, color: COLORS.slate300, mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                No accounts found
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredAccounts.map((account) => (
                <ListItemButton
                  key={account.account_id}
                  selected={account.account_id === selectedAccountId}
                  onClick={() => handleAccountSelect(account)}
                  sx={{
                    py: 2,
                    px: 2.5,
                    borderLeft: `4px solid ${account.account_id === selectedAccountId ? COLORS.primary : 'transparent'}`,
                    bgcolor: account.account_id === selectedAccountId ? alpha(COLORS.primary, 0.08) : 'transparent',
                    '&:hover': { bgcolor: account.account_id === selectedAccountId ? alpha(COLORS.primary, 0.08) : COLORS.slate50 },
                    transition: 'all 0.2s',
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                    <Avatar
                      sx={{
                        width: 44,
                        height: 44,
                        bgcolor: account.account_id === selectedAccountId ? COLORS.primary : alpha(COLORS.purple, 0.1),
                        color: account.account_id === selectedAccountId ? 'white' : COLORS.purple,
                        fontSize: '1rem',
                        fontWeight: 700,
                      }}
                    >
                      {account.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: COLORS.secondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {account.name}
                        {account.salesforce_id && (
                          <Tooltip title="Synced with Salesforce">
                            <CloudIcon sx={{ fontSize: 14, ml: 0.5, color: '#00A1E0', verticalAlign: 'middle' }} />
                          </Tooltip>
                        )}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {account.industry || 'No industry'}
                      </Typography>
                    </Box>
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 4, bgcolor: 'background.default' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {!selectedAccountSummary ? (
          <Fade in>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: alpha(COLORS.primary, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                <BusinessIcon sx={{ fontSize: 40, color: COLORS.primary }} />
              </Box>
              <Typography variant="h6" sx={{ color: COLORS.secondary, fontWeight: 600, mb: 1 }}>
                Select an Account
              </Typography>
              <Typography color="text.secondary">
                Choose an account from the sidebar to view details
              </Typography>
            </Box>
          </Fade>
        ) : (
          <Fade in>
            <Stack spacing={3}>
              {/* Account Header Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: 4,
                  background: COLORS.gradient,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Background Pattern */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '40%',
                    height: '100%',
                    opacity: 0.1,
                    background: 'radial-gradient(circle at 50% 50%, white 0%, transparent 70%)',
                  }}
                />

                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ position: 'relative', zIndex: 1 }}>
                  <Stack direction="row" spacing={3} alignItems="center">
                    <Avatar
                      sx={{
                        width: 72,
                        height: 72,
                        bgcolor: alpha('#fff', 0.15),
                        color: 'white',
                        fontSize: '2rem',
                        fontWeight: 800,
                      }}
                    >
                      {selectedAccountSummary.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>
                        {selectedAccountSummary.name}
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center">
                        {selectedAccountSummary.domain && (
                          <Typography variant="body2" sx={{ color: alpha('#fff', 0.8) }}>
                            {selectedAccountSummary.domain}
                          </Typography>
                        )}
                        {selectedAccountSummary.industry && (
                          <Chip
                            label={selectedAccountSummary.industry}
                            size="small"
                            sx={{
                              bgcolor: alpha('#fff', 0.15),
                              color: 'white',
                              fontWeight: 600,
                            }}
                          />
                        )}
                        {selectedAccountSummary.location && (
                          <Typography variant="body2" sx={{ color: alpha('#fff', 0.8) }}>
                            {selectedAccountSummary.location}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                  <IconButton
                    onClick={(e) => setAccountMenuAnchor(e.currentTarget)}
                    sx={{ color: 'white', bgcolor: alpha('#fff', 0.1), '&:hover': { bgcolor: alpha('#fff', 0.2) } }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                  <Menu
                    anchorEl={accountMenuAnchor}
                    open={Boolean(accountMenuAnchor)}
                    onClose={() => setAccountMenuAnchor(null)}
                    PaperProps={{ sx: { borderRadius: 2, mt: 1 } }}
                  >
                    <MenuItem onClick={handleOpenEditDialog}>Edit Account</MenuItem>
                  </Menu>
                </Stack>
              </Paper>

              {/* Account Summary - Only show if there's content or editing */}
              {(selectedAccountDetail?.summary || editingSummary) && (
                <Paper elevation={0} sx={{ p: 3, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                      Account Summary
                    </Typography>
                    {editingSummary ? (
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => setEditingSummary(false)} sx={{ color: 'text.secondary' }}>
                          Cancel
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleSaveSummary}
                          sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'text.primary' } }}
                        >
                          Save
                        </Button>
                      </Stack>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => setEditingSummary(true)}
                        sx={{ color: COLORS.primary, fontSize: '0.75rem' }}
                      >
                        Edit
                      </Button>
                    )}
                  </Stack>
                  {editingSummary ? (
                    <TextField
                      multiline
                      minRows={3}
                      fullWidth
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                      placeholder="Add account summary, key contacts, strategic notes..."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                        },
                      }}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ color: COLORS.secondary, lineHeight: 1.6 }}>
                      {selectedAccountDetail?.summary}
                    </Typography>
                  )}
                </Paper>
              )}

              {/* Deals Section */}
              <Paper elevation={0} sx={{ p: 3, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        bgcolor: alpha(COLORS.info, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TrendingUpIcon sx={{ color: COLORS.info, fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: COLORS.secondary, lineHeight: 1.2 }}>
                        Deals
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {dealsForAccount.length} opportunit{dealsForAccount.length !== 1 ? 'ies' : 'y'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    size="small"
                    onClick={() => setDealDialogOpen(true)}
                    sx={{
                      bgcolor: 'primary.main',
                      borderRadius: 1.5,
                      fontWeight: 600,
                      '&:hover': { bgcolor: 'text.primary' },
                    }}
                  >
                    New Deal
                  </Button>
                </Stack>

                {detailLoading ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <CircularProgress size={24} sx={{ color: COLORS.primary }} />
                  </Box>
                ) : dealsForAccount.length === 0 ? (
                  <Box
                    sx={{
                      py: 4,
                      textAlign: 'center',
                      bgcolor: 'background.default',
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                      No deals yet
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    {dealsForAccount.map((deal) => (
                      <Card
                        key={deal.deal_id}
                        sx={{
                          borderRadius: 2,
                          border: 1,
                          borderColor: 'divider',
                          boxShadow: 'none',
                          transition: 'border-color 0.2s',
                          '&:hover': {
                            borderColor: 'divider',
                          },
                        }}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                              <Box
                                sx={{
                                  width: 4,
                                  height: 40,
                                  borderRadius: 2,
                                  bgcolor: getStageColor(deal.stage),
                                }}
                              />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.secondary }}>
                                  {deal.opportunity_name}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                  <Chip
                                    label={DEAL_STAGE_OPTIONS.find(s => s.value === deal.stage)?.label || deal.stage}
                                    size="small"
                                    sx={{
                                      bgcolor: alpha(getStageColor(deal.stage), 0.1),
                                      color: getStageColor(deal.stage),
                                      fontWeight: 600,
                                      fontSize: '0.65rem',
                                      height: 20,
                                    }}
                                  />
                                  {deal.meetings?.length > 0 && (
                                    <Chip
                                      icon={<EventIcon sx={{ fontSize: 12 }} />}
                                      label={`${deal.meetings.length} meeting${deal.meetings.length !== 1 ? 's' : ''}`}
                                      size="small"
                                      variant="outlined"
                                      sx={{ fontWeight: 500, fontSize: '0.65rem', height: 20, '& .MuiChip-icon': { ml: 0.5 } }}
                                    />
                                  )}
                                </Stack>
                              </Box>
                            </Stack>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Box sx={{ width: 100, textAlign: 'right' }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                  Progress
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: getStageColor(deal.stage) }}>
                                  {deal.progress_percentage}%
                                </Typography>
                              </Box>
                              <IconButton
                                size="small"
                                onClick={() => setExpandedDeals(prev => {
                                  const next = new Set(prev);
                                  next.has(deal.deal_id) ? next.delete(deal.deal_id) : next.add(deal.deal_id);
                                  return next;
                                })}
                                sx={{
                                  bgcolor: 'action.hover',
                                  width: 28,
                                  height: 28,
                                  '&:hover': { bgcolor: 'action.selected' },
                                }}
                              >
                                {expandedDeals.has(deal.deal_id) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              </IconButton>
                              <Tooltip title="Open Deal">
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/app/deals/${deal.deal_id}`)}
                                  sx={{
                                    bgcolor: alpha(COLORS.primary, 0.1),
                                    color: COLORS.primary,
                                    width: 28,
                                    height: 28,
                                    '&:hover': { bgcolor: alpha(COLORS.primary, 0.2) },
                                  }}
                                >
                                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Stack>

                          {/* Expanded Meetings */}
                          <Collapse in={expandedDeals.has(deal.deal_id)} timeout="auto" unmountOnExit>
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                                Linked Meetings
                              </Typography>
                              {deal.meetings.length > 0 ? (
                                <Stack spacing={1}>
                                  {deal.meetings.map((meeting) => (
                                    <Box
                                      key={meeting.meeting_id}
                                      sx={{
                                        p: 1.5,
                                        bgcolor: 'background.default',
                                        borderRadius: 1.5,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: 'action.hover' },
                                      }}
                                      onClick={() => navigate(`/app/calendar/meetings/${encodeURIComponent(meeting.meeting_id)}`)}
                                    >
                                      <Stack direction="row" spacing={1.5} alignItems="center">
                                        <EventIcon sx={{ fontSize: 16, color: COLORS.purple }} />
                                        <Box>
                                          <Typography variant="body2" sx={{ fontWeight: 500, color: COLORS.secondary, fontSize: '0.8rem' }}>
                                            {meeting.title}
                                          </Typography>
                                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                                            {meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : 'No date'}
                                          </Typography>
                                        </Box>
                                      </Stack>
                                      <Stack direction="row" spacing={0.5}>
                                        {meeting.analysis_job?.transcript_status === 'completed' && (
                                          <Chip
                                            label="Transcript"
                                            size="small"
                                            sx={{
                                              bgcolor: alpha(COLORS.success, 0.1),
                                              color: COLORS.success,
                                              fontWeight: 600,
                                              fontSize: '0.6rem',
                                              height: 18,
                                            }}
                                          />
                                        )}
                                        {meeting.analysis_job?.proposal_status === 'completed' && (
                                          <Chip
                                            label="Proposal"
                                            size="small"
                                            sx={{
                                              bgcolor: alpha(COLORS.purple, 0.1),
                                              color: COLORS.purple,
                                              fontWeight: 600,
                                              fontSize: '0.6rem',
                                              height: 18,
                                            }}
                                          />
                                        )}
                                      </Stack>
                                    </Box>
                                  ))}
                                </Stack>
                              ) : (
                                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                  No meetings linked
                                </Typography>
                              )}
                            </Box>
                          </Collapse>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Fade>
        )}
      </Box>

      {/* Create Account Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Create New Account</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Account Name"
              required
              fullWidth
              value={newAccount.name}
              onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
              autoFocus
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              label="Domain"
              fullWidth
              value={newAccount.domain}
              onChange={(e) => setNewAccount(prev => ({ ...prev, domain: e.target.value }))}
              placeholder="example.com"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Industry"
                fullWidth
                value={newAccount.industry}
                onChange={(e) => setNewAccount(prev => ({ ...prev, industry: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                label="Location"
                fullWidth
                value={newAccount.location}
                onChange={(e) => setNewAccount(prev => ({ ...prev, location: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Stack>
            <TextField
              label="Owner"
              fullWidth
              value={newAccount.owner}
              onChange={(e) => setNewAccount(prev => ({ ...prev, owner: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            {createError && (
              <Alert severity="error" onClose={() => setCreateError(null)} sx={{ borderRadius: 2 }}>
                {createError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateAccount}
            disabled={!newAccount.name.trim()}
            sx={{
              bgcolor: 'primary.main',
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'text.primary' },
            }}
          >
            Create Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Edit Account</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Account Name"
              required
              fullWidth
              value={editAccount.name}
              onChange={(e) => setEditAccount(prev => ({ ...prev, name: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              label="Domain"
              fullWidth
              value={editAccount.domain}
              onChange={(e) => setEditAccount(prev => ({ ...prev, domain: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Industry"
                fullWidth
                value={editAccount.industry}
                onChange={(e) => setEditAccount(prev => ({ ...prev, industry: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                label="Location"
                fullWidth
                value={editAccount.location}
                onChange={(e) => setEditAccount(prev => ({ ...prev, location: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Stack>
            <TextField
              label="Owner"
              fullWidth
              value={editAccount.owner}
              onChange={(e) => setEditAccount(prev => ({ ...prev, owner: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            {editError && (
              <Alert severity="error" onClose={() => setEditError(null)} sx={{ borderRadius: 2 }}>
                {editError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setEditDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEditAccount}
            disabled={!editAccount.name.trim()}
            sx={{
              bgcolor: 'primary.main',
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'text.primary' },
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Deal Dialog */}
      <Dialog
        open={dealDialogOpen}
        onClose={() => setDealDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Create New Deal</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Opportunity Name"
              required
              fullWidth
              value={newDealData.opportunity_name}
              onChange={(e) => setNewDealData(prev => ({ ...prev, opportunity_name: e.target.value }))}
              placeholder="e.g., Enterprise Agile Transformation"
              autoFocus
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <FormControl fullWidth>
              <InputLabel>Stage</InputLabel>
              <Select
                label="Stage"
                value={newDealData.stage}
                onChange={(e) => setNewDealData(prev => ({ ...prev, stage: e.target.value }))}
                sx={{ borderRadius: 2 }}
              >
                {DEAL_STAGE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  label="Priority"
                  value={newDealData.priority}
                  onChange={(e) => setNewDealData(prev => ({ ...prev, priority: e.target.value }))}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Estimated Value"
                type="number"
                fullWidth
                value={newDealData.estimated_value}
                onChange={(e) => setNewDealData(prev => ({ ...prev, estimated_value: e.target.value }))}
                InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary' }}>$</Typography> }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Stack>
            <TextField
              label="Owner"
              fullWidth
              value={newDealData.owner}
              onChange={(e) => setNewDealData(prev => ({ ...prev, owner: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            {dealError && (
              <Alert severity="error" onClose={() => setDealError(null)} sx={{ borderRadius: 2 }}>
                {dealError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setDealDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateDeal}
            disabled={!newDealData.opportunity_name.trim()}
            sx={{
              bgcolor: 'primary.main',
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'text.primary' },
            }}
          >
            Create Deal
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountsPage;
