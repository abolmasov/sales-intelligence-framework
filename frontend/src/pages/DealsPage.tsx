import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
  Avatar,
  Paper,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Divider,
  CircularProgress,
  Fade,
  alpha,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Add as AddIcon,
  TrendingUp,
  Business,
  OpenInNew,
  Delete,
  AttachMoney,
  EmojiEvents,
  Timeline,
  ShowChart,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../utils/api';
import { Deal } from '../../../shared/types';
import { COLORS } from '../styles/pageStyles';

interface AccountOption {
  account_id: string;
  name: string;
  owner?: string | null;
  industry?: string | null;
}

const STAGE_OPTIONS = [
  { value: 'prospecting', label: 'Prospecting', progress: 10, color: '#64748b' },
  { value: 'qualification', label: 'Qualification', progress: 25, color: '#0891b2' },
  { value: 'proposal_sent', label: 'Proposal Sent', progress: 50, color: COLORS.info },
  { value: 'negotiation', label: 'Negotiation', progress: 75, color: COLORS.purple },
  { value: 'closed_won', label: 'Closed-Won', progress: 100, color: COLORS.success },
  { value: 'closed_lost', label: 'Closed-Lost', progress: 100, color: COLORS.error },
];

const getStageInfo = (stage: string) => {
  return STAGE_OPTIONS.find(s => s.value === stage) || STAGE_OPTIONS[0];
};

// Stat Card Component
const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}> = ({ label, value, icon, color, subtitle }) => (
  <Paper
    elevation={0}
    sx={{
      p: 3,
      borderRadius: 3,
      height: '100%',
      background: `linear-gradient(135deg, ${alpha(color, 0.05)} 0%, white 100%)`,
      border: 1,
      borderColor: alpha(color, 0.1),
      transition: 'all 0.3s',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: `0 12px 24px ${alpha(color, 0.15)}`,
      },
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
      <Box>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, color, mt: 0.5 }}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          bgcolor: alpha(color, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& svg': { fontSize: 24, color },
        }}
      >
        {icon}
      </Box>
    </Stack>
  </Paper>
);

const DealsPage: React.FC = () => {
  const navigate = useNavigate();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const [newDeal, setNewDeal] = useState({
    opportunity_name: '',
    account_id: '',
    stage: 'prospecting',
    priority: 'medium',
    owner: '',
    estimated_value: '',
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);

  useEffect(() => {
    fetchDeals();
    fetchAccounts();
  }, [filterStatus]);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      const data = await apiGet(`/api/deals/list?${params}`);
      if (data.success) {
        setDeals(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const data = await apiGet('/api/accounts');
      if (data.success && Array.isArray(data.data)) {
        setAccounts(data.data.map((account: any) => ({
          account_id: account.account_id,
          name: account.name,
          owner: account.owner,
          industry: account.industry,
        })));
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const stats = useMemo(() => {
    const allDeals = deals;
    const active = allDeals.filter(d => d.status === 'active').length;
    const won = allDeals.filter(d => d.status === 'won').length;
    const lost = allDeals.filter(d => d.status === 'lost').length;
    const totalValue = allDeals.reduce((sum, d) => sum + (d.estimated_value || 0), 0);
    return { total: allDeals.length, active, won, lost, totalValue };
  }, [deals]);

  const handleCreateDeal = async () => {
    const selectedAccount = accounts.find(a => a.account_id === newDeal.account_id);
    if (!newDeal.account_id || !newDeal.opportunity_name.trim()) return;

    try {
      const data = await apiPost('/api/deals', {
        opportunityName: newDeal.opportunity_name,
        companyName: selectedAccount?.name || '',
        stage: newDeal.stage,
        priority: newDeal.priority,
        owner: newDeal.owner || undefined,
        estimatedValue: newDeal.estimated_value ? parseFloat(newDeal.estimated_value) : null,
        accountId: newDeal.account_id,
      });

      if (data.success) {
        setCreateDialogOpen(false);
        setNewDeal({
          opportunity_name: '',
          account_id: '',
          stage: 'prospecting',
          priority: 'medium',
          owner: '',
          estimated_value: '',
        });
        navigate(`/app/deals/${data.data.deal_id}`);
      }
    } catch (error) {
      console.error('Error creating deal:', error);
    }
  };

  const handleDeleteClick = (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    setDealToDelete(deal);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!dealToDelete) return;

    try {
      const data = await apiDelete(`/api/deals/${dealToDelete.deal_id}`);
      if (data.success) {
        setDeleteDialogOpen(false);
        setDealToDelete(null);
        fetchDeals();
      }
    } catch (error) {
      console.error('Error deleting deal:', error);
    }
  };

  const statusTabs = ['all', 'active', 'won', 'lost'];

  return (
    <Box sx={{ pb: 4 }}>
      {/* Hero Header */}
      <Paper
        sx={{
          p: 4,
          mb: 4,
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
            width: '50%',
            height: '100%',
            opacity: 0.1,
            background: 'radial-gradient(circle at 50% 50%, white 0%, transparent 70%)',
          }}
        />

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 3,
                bgcolor: alpha('#fff', 0.15),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShowChart sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'white' }}>
                Sales Pipeline
              </Typography>
              <Typography variant="body1" sx={{ color: alpha('#fff', 0.8) }}>
                Manage and track all your opportunities
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{
              bgcolor: 'background.paper',
              color: COLORS.secondary,
              fontWeight: 600,
              px: 3,
              py: 1.5,
              borderRadius: 2,
              '&:hover': { bgcolor: alpha('#fff', 0.9) },
            }}
          >
            New Deal
          </Button>
        </Stack>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Total Deals"
            value={stats.total}
            icon={<Timeline />}
            color={COLORS.info}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Active"
            value={stats.active}
            icon={<TrendingUp />}
            color={COLORS.primary}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Won"
            value={stats.won}
            icon={<EmojiEvents />}
            color={COLORS.success}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Pipeline Value"
            value={`$${(stats.totalValue / 1000).toFixed(0)}K`}
            icon={<AttachMoney />}
            color={COLORS.purple}
          />
        </Grid>
      </Grid>

      {/* Filter Tabs */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          borderRadius: 3,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Tabs
          value={filterStatus}
          onChange={(_, value) => setFilterStatus(value)}
          sx={{
            px: 2,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              minWidth: 100,
              minHeight: 56,
              color: 'text.secondary',
            },
            '& .Mui-selected': {
              color: COLORS.primary,
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              backgroundColor: COLORS.primary,
            },
          }}
        >
          {statusTabs.map((tab) => (
            <Tab
              key={tab}
              value={tab}
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                  {tab === 'active' && stats.active > 0 && (
                    <Chip
                      label={stats.active}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        bgcolor: alpha(COLORS.primary, 0.1),
                        color: COLORS.primary,
                        fontWeight: 600,
                      }}
                    />
                  )}
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {/* Deals List */}
      {loading ? (
        <Fade in>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={40} sx={{ color: COLORS.primary }} />
            <Typography sx={{ color: 'text.secondary', mt: 2 }}>Loading deals...</Typography>
          </Box>
        </Fade>
      ) : deals.length === 0 ? (
        <Fade in>
          <Paper
            elevation={0}
            sx={{
              p: 8,
              textAlign: 'center',
              borderRadius: 4,
              border: '2px dashed',
              borderColor: 'divider',
              bgcolor: 'background.default',
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
                mx: 'auto',
                mb: 3,
              }}
            >
              <Business sx={{ fontSize: 40, color: COLORS.primary }} />
            </Box>
            <Typography variant="h6" sx={{ color: COLORS.secondary, fontWeight: 700, mb: 1 }}>
              No deals found
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Create your first deal to start tracking opportunities
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{
                background: COLORS.gradient,
                px: 4,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
              }}
            >
              Create Deal
            </Button>
          </Paper>
        </Fade>
      ) : (
        <Fade in>
          <Stack spacing={2}>
            {deals.map((deal) => {
              const stageInfo = getStageInfo(deal.stage);
              return (
                <Card
                  key={deal.deal_id}
                  onClick={() => navigate(`/app/deals/${deal.deal_id}`)}
                  sx={{
                    borderRadius: 3,
                    border: 1,
                    borderColor: 'divider',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': {
                      borderColor: COLORS.primary,
                      boxShadow: `0 8px 24px ${alpha(COLORS.primary, 0.12)}`,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      {/* Stage Indicator */}
                      <Box
                        sx={{
                          width: 6,
                          height: 64,
                          borderRadius: 3,
                          bgcolor: stageInfo.color,
                        }}
                      />

                      {/* Company Avatar */}
                      <Avatar
                        sx={{
                          width: 52,
                          height: 52,
                          bgcolor: alpha(COLORS.purple, 0.1),
                          color: COLORS.purple,
                          fontSize: '1.25rem',
                          fontWeight: 700,
                        }}
                      >
                        {deal.company_name.charAt(0).toUpperCase()}
                      </Avatar>

                      {/* Deal Info */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                          {deal.opportunity_name}
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {deal.company_name}
                          </Typography>
                          <Chip
                            label={stageInfo.label}
                            size="small"
                            sx={{
                              bgcolor: alpha(stageInfo.color, 0.1),
                              color: stageInfo.color,
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          />
                          {deal.priority && (
                            <Chip
                              label={deal.priority}
                              size="small"
                              sx={{
                                bgcolor: deal.priority === 'high' ? alpha(COLORS.error, 0.1) : deal.priority === 'low' ? alpha(COLORS.success, 0.1) : alpha(COLORS.warning, 0.1),
                                color: deal.priority === 'high' ? COLORS.error : deal.priority === 'low' ? COLORS.success : COLORS.warning,
                                fontWeight: 600,
                                fontSize: '0.65rem',
                                textTransform: 'capitalize',
                              }}
                            />
                          )}
                        </Stack>
                      </Box>

                      {/* Value */}
                      {deal.estimated_value ? (
                        <Box sx={{ textAlign: 'right', minWidth: 100 }}>
                          <Chip
                            icon={<TrendingUp sx={{ fontSize: 16 }} />}
                            label={`$${(deal.estimated_value / 1000).toFixed(0)}K`}
                            sx={{
                              bgcolor: alpha(COLORS.success, 0.1),
                              color: COLORS.success,
                              fontWeight: 700,
                              '& .MuiChip-icon': { color: COLORS.success },
                            }}
                          />
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.disabled', minWidth: 100, textAlign: 'right' }}>
                          No value
                        </Typography>
                      )}

                      {/* Progress */}
                      <Box sx={{ width: 120 }}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Progress
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: stageInfo.color }}>
                            {deal.progress_percentage}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={deal.progress_percentage}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: alpha(stageInfo.color, 0.1),
                            '& .MuiLinearProgress-bar': {
                              bgcolor: stageInfo.color,
                              borderRadius: 4,
                            },
                          }}
                        />
                      </Box>

                      {/* Actions */}
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Open Deal">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/deals/${deal.deal_id}`);
                            }}
                            sx={{
                              bgcolor: alpha(COLORS.primary, 0.1),
                              color: COLORS.primary,
                              '&:hover': { bgcolor: alpha(COLORS.primary, 0.2) },
                            }}
                          >
                            <OpenInNew fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={(e) => handleDeleteClick(deal, e)}
                            sx={{
                              bgcolor: alpha(COLORS.error, 0.05),
                              color: 'text.disabled',
                              '&:hover': {
                                bgcolor: alpha(COLORS.error, 0.1),
                                color: COLORS.error,
                              },
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Fade>
      )}

      {/* Create Deal Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Create New Deal</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Account</InputLabel>
              <Select
                label="Account"
                value={newDeal.account_id}
                onChange={(e) => setNewDeal(prev => ({ ...prev, account_id: e.target.value }))}
                sx={{ borderRadius: 2 }}
              >
                {accounts.map((account) => (
                  <MenuItem key={account.account_id} value={account.account_id}>
                    {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Opportunity Name"
              required
              fullWidth
              value={newDeal.opportunity_name}
              onChange={(e) => setNewDeal(prev => ({ ...prev, opportunity_name: e.target.value }))}
              placeholder="e.g., Enterprise Transformation"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Stage</InputLabel>
                <Select
                  label="Stage"
                  value={newDeal.stage}
                  onChange={(e) => setNewDeal(prev => ({ ...prev, stage: e.target.value }))}
                  sx={{ borderRadius: 2 }}
                >
                  {STAGE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  label="Priority"
                  value={newDeal.priority}
                  onChange={(e) => setNewDeal(prev => ({ ...prev, priority: e.target.value }))}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Estimated Value"
                type="number"
                fullWidth
                value={newDeal.estimated_value}
                onChange={(e) => setNewDeal(prev => ({ ...prev, estimated_value: e.target.value }))}
                InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary' }}>$</Typography> }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                label="Owner"
                fullWidth
                value={newDeal.owner}
                onChange={(e) => setNewDeal(prev => ({ ...prev, owner: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateDeal}
            disabled={!newDeal.account_id || !newDeal.opportunity_name.trim()}
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

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: COLORS.error, fontWeight: 700 }}>Delete Deal</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: COLORS.secondary }}>
            Are you sure you want to delete this deal? This action cannot be undone.
          </Typography>
          {dealToDelete && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: alpha(COLORS.error, 0.05),
                border: 1,
                borderColor: alpha(COLORS.error, 0.2),
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                {dealToDelete.opportunity_name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {dealToDelete.company_name}
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteConfirm}
            sx={{
              bgcolor: COLORS.error,
              borderRadius: 2,
              '&:hover': { bgcolor: 'error.light' },
            }}
          >
            Delete Deal
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DealsPage;
