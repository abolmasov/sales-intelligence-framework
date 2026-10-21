import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  alpha,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { AccountTree, PlayArrow, OpenInNew } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../utils/api';
import { AgentRunDialog, AgentMetadata } from '../components/AgentRunDialog';
import {
  COLORS,
  modernTabsStyles,
  modernCardStyles,
} from '../styles/pageStyles';

type AgentCategory = 'analysis' | 'generation' | 'research' | 'automation';

const CATEGORY_TABS: Array<{ label: string; value: AgentCategory | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Analysis', value: 'analysis' },
  { label: 'Generation', value: 'generation' },
  { label: 'Research', value: 'research' },
  { label: 'Automation', value: 'automation' },
];

// Map agents to their related pages for cross-linking
const AGENT_PAGE_LINKS: Record<string, { label: string; path: string }> = {
  'transcript-analysis': { label: 'Post-Call Analysis', path: '/app/analysis/postcall' },
  'pre-call-research': { label: 'Pre-Call Research', path: '/app/analysis' },
  'proposal-generation': { label: 'Solution Proposals', path: '/app/rfp-sow-generator' },
  'pptx-generation': { label: 'Presentation Generator', path: '/app/ppt-generator' },
  'discovery': { label: 'Discovery', path: '/app/discovery' },
  'workshop-analysis': { label: 'Workspaces', path: '/app/workspaces' },
  'user-story-generation': { label: 'Workspaces', path: '/app/workspaces' },
  'bulk-analysis': { label: 'Post-Call Analysis', path: '/app/analysis/postcall' },
};

const AgentHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<AgentCategory | 'all'>('all');
  const [selectedAgent, setSelectedAgent] = useState<AgentMetadata | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await apiGet('/api/agents');
        const payload = res?.data || res;
        const list = Array.isArray(payload) ? payload : payload?.agents || [];
        setAgents(list);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  const filteredAgents = useMemo(() => {
    if (categoryFilter === 'all') return agents;
    return agents.filter((a) => a.category === categoryFilter);
  }, [agents, categoryFilter]);

  const handleRunClick = (agent: AgentMetadata) => {
    setSelectedAgent(agent);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedAgent(null);
  };

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Hero Header */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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
        <Stack direction="row" spacing={3} alignItems="center" sx={{ position: 'relative' }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 3,
              bgcolor: alpha('#fff', 0.15),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AccountTree sx={{ fontSize: 32, color: '#fff' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', mb: 0.5 }}>
              Agent Hub
            </Typography>
            <Typography variant="body1" sx={{ color: alpha('#fff', 0.7) }}>
              AI-powered agents that automate analysis, content generation, and research across your sales workflow
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Category Filter Tabs */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          borderColor: 'divider',
          mb: 3,
          px: 1,
        }}
      >
        <Tabs
          value={categoryFilter}
          onChange={(_, val) => setCategoryFilter(val)}
          sx={modernTabsStyles}
        >
          {CATEGORY_TABS.map((tab) => (
            <Tab key={tab.value} label={tab.label} value={tab.value} />
          ))}
        </Tabs>
      </Paper>

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} sx={{ color: 'text.disabled' }} />
        </Box>
      )}

      {/* Empty State */}
      {!loading && filteredAgents.length === 0 && (
        <Box
          sx={{
            py: 6,
            textAlign: 'center',
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: `1px dashed ${COLORS.gray300}`,
          }}
        >
          <AccountTree sx={{ fontSize: 40, color: COLORS.gray300, mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No agents found{categoryFilter !== 'all' ? ` in "${categoryFilter}"` : ''}.
          </Typography>
        </Box>
      )}

      {/* Agent Grid */}
      {!loading && filteredAgents.length > 0 && (
        <Grid container spacing={2.5}>
          {filteredAgents.map((agent) => {
            const pageLink = AGENT_PAGE_LINKS[agent.id];
            return (
              <Grid key={agent.id} size={{ xs: 12, md: 6 }}>
                <Card
                  sx={{
                    ...(modernCardStyles as any),
                    bgcolor: 'background.paper',
                    height: '100%',
                  }}
                >
                  <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Stack spacing={2}>
                      {/* Top row: icon + name + status */}
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            bgcolor: alpha(agent.color, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <AccountTree sx={{ fontSize: 22, color: agent.color }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, color: 'text.primary' }}
                            >
                              {agent.name}
                            </Typography>
                            {agent.status === 'available' && (
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: COLORS.success,
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </Stack>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'text.secondary',
                              mt: 0.25,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {agent.description}
                          </Typography>
                        </Box>
                      </Stack>

                      {/* Category + Capabilities chips */}
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Chip
                          label={agent.category}
                          size="small"
                          sx={{
                            borderRadius: 1,
                            fontSize: '0.7rem',
                            height: 22,
                            bgcolor: alpha(agent.color, 0.1),
                            color: agent.color,
                            fontWeight: 500,
                            textTransform: 'capitalize',
                          }}
                        />
                        {agent.capabilities.slice(0, 3).map((cap) => (
                          <Chip
                            key={cap}
                            label={cap}
                            size="small"
                            variant="outlined"
                            sx={{
                              borderRadius: 1,
                              fontSize: '0.7rem',
                              height: 22,
                              borderColor: 'divider',
                              color: 'text.secondary',
                            }}
                          />
                        ))}
                      </Stack>

                      {/* Actions row: Run + cross-link */}
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<PlayArrow sx={{ fontSize: 16 }} />}
                          disabled={agent.status === 'disabled'}
                          onClick={() => handleRunClick(agent)}
                          sx={{
                            bgcolor: 'primary.main',
                            fontWeight: 500,
                            borderRadius: 1.5,
                            boxShadow: 'none',
                            textTransform: 'none',
                            px: 2,
                            '&:hover': { bgcolor: 'text.primary', boxShadow: 'none' },
                            '&.Mui-disabled': {
                              bgcolor: 'action.selected',
                              color: 'text.disabled',
                            },
                          }}
                        >
                          Run Agent
                        </Button>
                        {pageLink && (
                          <Button
                            size="small"
                            endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                            onClick={() => navigate(pageLink.path)}
                            sx={{
                              color: 'text.secondary',
                              fontWeight: 500,
                              textTransform: 'none',
                              fontSize: '0.75rem',
                              '&:hover': { color: 'text.secondary', bgcolor: 'background.default' },
                            }}
                          >
                            {pageLink.label}
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Run Dialog */}
      <AgentRunDialog open={dialogOpen} onClose={handleDialogClose} agent={selectedAgent} />
    </Box>
  );
};

export default AgentHubPage;
