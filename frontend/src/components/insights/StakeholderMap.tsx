import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Avatar,
  IconButton,
  Collapse,
  Tooltip,
} from '@mui/material';
import {
  Person,
  LinkedIn,
  ExpandMore,
  ExpandLess,
  Star,
  StarBorder,
  Business,
  Email,
} from '@mui/icons-material';

export interface StakeholderInsight {
  name: string;
  role: string;
  company?: string;
  email?: string;
  influenceLevel: 'high' | 'medium' | 'low';
  talkingPoints: string[];
  linkedInSummary?: string;
  department?: string;
  isDecisionMaker?: boolean;
}

interface StakeholderMapProps {
  stakeholders: StakeholderInsight[];
  companyName: string;
}

const influenceConfig = {
  high: { color: 'success.main', bg: 'rgba(5, 150, 105, 0.1)', label: 'High Influence', stars: 3 },
  medium: { color: 'warning.main', bg: 'rgba(217, 119, 6, 0.1)', label: 'Medium Influence', stars: 2 },
  low: { color: 'text.disabled', bg: 'rgba(115, 115, 115, 0.1)', label: 'Low Influence', stars: 1 },
};

const getInitials = (name: string) => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getAvatarColor = (name: string) => {
  const colors = ['#525252', '#737373', '#404040', '#262626', '#171717', '#525252'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

const StakeholderMap: React.FC<StakeholderMapProps> = ({ stakeholders, companyName }) => {
  const [expandedStakeholder, setExpandedStakeholder] = useState<string | null>(null);

  const toggleExpand = (name: string) => {
    setExpandedStakeholder(expandedStakeholder === name ? null : name);
  };

  const sortedStakeholders = [...stakeholders].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.influenceLevel] - order[b.influenceLevel];
  });

  const decisionMakers = stakeholders.filter(s => s.isDecisionMaker || s.influenceLevel === 'high');

  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 1.5,
        borderColor: 'divider',
        background: '#FFFFFF',
        boxShadow: 'none',
      }}
    >
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography
              variant="h6"
              sx={{
                color: 'text.primary',
                fontWeight: 600,
              }}
            >
              Stakeholder Map
            </Typography>
            <Typography variant="body2" color="#737373">
              {stakeholders.length} attendees from {companyName}
            </Typography>
          </Box>
          {decisionMakers.length > 0 && (
            <Chip
              icon={<Star sx={{ color: '#d97706 !important' }} />}
              label={`${decisionMakers.length} Decision Maker${decisionMakers.length > 1 ? 's' : ''}`}
              sx={{
                bgcolor: 'rgba(217, 119, 6, 0.1)',
                color: 'warning.main',
                fontWeight: 500,
              }}
            />
          )}
        </Stack>

        {/* Stakeholder Cards */}
        <Stack spacing={2}>
          {sortedStakeholders.map((stakeholder) => {
            const isExpanded = expandedStakeholder === stakeholder.name;
            const config = influenceConfig[stakeholder.influenceLevel];
            const avatarColor = getAvatarColor(stakeholder.name);

            return (
              <Paper
                key={stakeholder.name}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  borderColor: stakeholder.isDecisionMaker
                    ? 'rgba(217, 119, 6, 0.3)'
                    : '#e5e5e5',
                  bgcolor: stakeholder.isDecisionMaker
                    ? 'rgba(217, 119, 6, 0.03)'
                    : '#fafafa',
                  transition: 'border-color 0.15s',
                  '&:hover': {
                    borderColor: 'divider',
                  },
                }}
              >
                <Stack direction="row" spacing={2}>
                  {/* Avatar */}
                  <Avatar
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: avatarColor,
                      fontWeight: 600,
                      fontSize: '1rem',
                    }}
                  >
                    {getInitials(stakeholder.name)}
                  </Avatar>

                  {/* Content */}
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography
                            variant="subtitle1"
                            sx={{ color: 'text.primary', fontWeight: 600 }}
                          >
                            {stakeholder.name}
                          </Typography>
                          {stakeholder.isDecisionMaker && (
                            <Tooltip title="Decision Maker">
                              <Star sx={{ color: 'warning.main', fontSize: 18 }} />
                            </Tooltip>
                          )}
                        </Stack>
                        <Typography variant="body2" color="#737373">
                          {stakeholder.role}
                          {stakeholder.department && ` • ${stakeholder.department}`}
                        </Typography>
                      </Box>

                      <Stack direction="row" alignItems="center" spacing={1}>
                        {/* Influence Indicator */}
                        <Chip
                          size="small"
                          label={config.label}
                          sx={{
                            bgcolor: config.bg,
                            color: config.color,
                            fontWeight: 500,
                            fontSize: '0.7rem',
                          }}
                        />

                        {/* Actions */}
                        {stakeholder.email && (
                          <Tooltip title={stakeholder.email}>
                            <IconButton size="small" sx={{ color: 'text.disabled' }}>
                              <Email fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {stakeholder.linkedInSummary && (
                          <Tooltip title="LinkedIn Profile">
                            <IconButton size="small" sx={{ color: 'text.secondary' }}>
                              <LinkedIn fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Expand */}
                        <IconButton size="small" onClick={() => toggleExpand(stakeholder.name)}>
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </Stack>
                    </Stack>

                    {/* Expanded Content */}
                    <Collapse in={isExpanded}>
                      <Stack spacing={2} sx={{ mt: 2 }}>
                        {/* LinkedIn Summary */}
                        {stakeholder.linkedInSummary && (
                          <Box
                            sx={{
                              p: 1.5,
                              bgcolor: 'action.hover',
                              borderRadius: 1,
                              borderLeft: '3px solid #525252',
                            }}
                          >
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                              <LinkedIn sx={{ color: 'text.secondary', fontSize: 16 }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                LINKEDIN SUMMARY
                              </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              {stakeholder.linkedInSummary}
                            </Typography>
                          </Box>
                        )}

                        {/* Talking Points */}
                        {stakeholder.talkingPoints.length > 0 && (
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 1 }}
                            >
                              KEY TALKING POINTS
                            </Typography>
                            <Stack spacing={0.75}>
                              {stakeholder.talkingPoints.map((point, idx) => (
                                <Stack key={idx} direction="row" alignItems="flex-start" spacing={1}>
                                  <Box
                                    sx={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      bgcolor: 'text.secondary',
                                      mt: 0.75,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    {point}
                                  </Typography>
                                </Stack>
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                    </Collapse>
                  </Box>
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        {/* Empty State */}
        {stakeholders.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Person sx={{ fontSize: 48, color: '#d4d4d4', mb: 1 }} />
            <Typography variant="body2" color="#737373">
              No stakeholder information available.
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default StakeholderMap;
