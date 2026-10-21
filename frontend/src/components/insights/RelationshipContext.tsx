import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Link,
} from '@mui/material';
import {
  History,
  Description,
  People,
  OpenInNew,
  ExpandMore,
  ExpandLess,
  Handshake,
  Article,
  Business,
} from '@mui/icons-material';
import ResponsiveGrid from '../layout/ResponsiveGrid';

export interface PastEngagement {
  id: string;
  date: string;
  type: 'meeting' | 'proposal' | 'email' | 'call' | 'deal';
  title: string;
  description: string;
  outcome?: string;
  participants?: string[];
}

export interface CaseStudy {
  id: string;
  title: string;
  industry: string;
  relevanceScore: number;
  summary: string;
  url?: string;
  highlights?: string[];
}

export interface InternalContact {
  name: string;
  role: string;
  relationship: string;
  lastContact?: string;
}

interface RelationshipContextProps {
  companyName: string;
  pastEngagements: PastEngagement[];
  caseStudies: CaseStudy[];
  internalContacts: InternalContact[];
}

const engagementTypeConfig = {
  meeting: { color: 'text.secondary', icon: <People fontSize="small" /> },
  proposal: { color: 'text.disabled', icon: <Description fontSize="small" /> },
  email: { color: 'text.disabled', icon: <Article fontSize="small" /> },
  call: { color: 'text.secondary', icon: <People fontSize="small" /> },
  deal: { color: '#404040', icon: <Handshake fontSize="small" /> },
};

const RelationshipContext: React.FC<RelationshipContextProps> = ({
  companyName,
  pastEngagements,
  caseStudies,
  internalContacts,
}) => {
  const [expandedEngagement, setExpandedEngagement] = useState<string | null>(null);
  const [showAllEngagements, setShowAllEngagements] = useState(false);

  const displayedEngagements = showAllEngagements
    ? pastEngagements
    : pastEngagements.slice(0, 3);

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
      <Stack spacing={4}>
        {/* Header */}
        <Box>
          <Typography
            variant="h6"
            sx={{
              color: 'text.primary',
              fontWeight: 600,
              mb: 0.5,
            }}
          >
            Relationship Context
          </Typography>
          <Typography variant="body2" color="#737373">
            Past engagement history with {companyName}
          </Typography>
        </Box>

        {/* Past Engagements - Simple List */}
        {pastEngagements.length > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <History sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                Engagement History
              </Typography>
              <Chip
                size="small"
                label={`${pastEngagements.length} interactions`}
                sx={{ bgcolor: 'rgba(82, 82, 82, 0.1)', color: 'text.secondary', fontWeight: 500, fontSize: '0.7rem' }}
              />
            </Stack>

            <Stack spacing={2}>
              {displayedEngagements.map((engagement, idx) => {
                const config = engagementTypeConfig[engagement.type];
                const isExpanded = expandedEngagement === engagement.id;

                return (
                  <Stack key={engagement.id} direction="row" spacing={2}>
                    {/* Timeline dot and line */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          bgcolor: config.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                        }}
                      >
                        {config.icon}
                      </Box>
                      {idx < displayedEngagements.length - 1 && (
                        <Box sx={{ width: 2, flex: 1, bgcolor: '#E5E7EB', mt: 1 }} />
                      )}
                    </Box>

                    {/* Content */}
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                        cursor: 'pointer',
                        flex: 1,
                        '&:hover': {
                          borderColor: 'divider',
                        },
                      }}
                      onClick={() => setExpandedEngagement(isExpanded ? null : engagement.id)}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                              {engagement.title}
                            </Typography>
                            <Chip
                              size="small"
                              label={engagement.type}
                              sx={{
                                bgcolor: `${config.color}20`,
                                color: config.color,
                                fontWeight: 600,
                                fontSize: '0.65rem',
                                height: 20,
                              }}
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(engagement.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Typography>
                        </Box>
                        <IconButton size="small">
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </Stack>

                      <Collapse in={isExpanded}>
                        <Stack spacing={1.5} sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {engagement.description}
                          </Typography>
                          {engagement.outcome && (
                            <Box
                              sx={{
                                p: 1.5,
                                bgcolor: 'rgba(5, 150, 105, 0.08)',
                                borderRadius: 1,
                              }}
                            >
                              <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                                OUTCOME
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {engagement.outcome}
                              </Typography>
                            </Box>
                          )}
                          {engagement.participants && engagement.participants.length > 0 && (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {engagement.participants.map((p, i) => (
                                <Chip
                                  key={i}
                                  size="small"
                                  label={p}
                                  sx={{
                                    bgcolor: 'action.hover',
                                    fontSize: '0.7rem',
                                  }}
                                />
                              ))}
                            </Stack>
                          )}
                        </Stack>
                      </Collapse>
                    </Paper>
                  </Stack>
                );
              })}
            </Stack>

            {pastEngagements.length > 3 && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Chip
                  label={showAllEngagements ? 'Show Less' : `Show ${pastEngagements.length - 3} More`}
                  onClick={() => setShowAllEngagements(!showAllEngagements)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                />
              </Box>
            )}
          </Box>
        )}

        {/* Similar Case Studies */}
        {caseStudies.length > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Description sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                Similar Case Studies
              </Typography>
            </Stack>

            <ResponsiveGrid container spacing={2}>
              {caseStudies.slice(0, 4).map((cs) => (
                <ResponsiveGrid xs={12} md={6} key={cs.id}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                      height: '100%',
                      transition: 'border-color 0.15s',
                      '&:hover': {
                        borderColor: 'divider',
                      },
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                            {cs.title}
                          </Typography>
                          <Typography variant="caption" color="#737373">
                            {cs.industry}
                          </Typography>
                        </Box>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Chip
                            size="small"
                            label={`${Math.round(cs.relevanceScore * 100)}% match`}
                            sx={{
                              bgcolor: 'rgba(82, 82, 82, 0.1)',
                              color: 'text.secondary',
                              fontWeight: 500,
                              fontSize: '0.65rem',
                              height: 20,
                            }}
                          />
                          {cs.url && (
                            <Tooltip title="Open case study">
                              <IconButton
                                size="small"
                                component={Link}
                                href={cs.url}
                                target="_blank"
                              >
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.disabled',
                          fontSize: '0.8rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {cs.summary}
                      </Typography>
                    </Stack>
                  </Paper>
                </ResponsiveGrid>
              ))}
            </ResponsiveGrid>
          </Box>
        )}

        {/* Internal Contacts */}
        {internalContacts.length > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Business sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                Internal Champions
              </Typography>
            </Stack>

            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {internalContacts.map((contact, idx) => (
                <Paper
                  key={idx}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                    minWidth: 200,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    {contact.name}
                  </Typography>
                  <Typography variant="caption" color="#737373">
                    {contact.role}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}
                  >
                    {contact.relationship}
                  </Typography>
                  {contact.lastContact && (
                    <Typography variant="caption" color="#737373" sx={{ display: 'block', mt: 0.5 }}>
                      Last contact: {contact.lastContact}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          </Box>
        )}

        {/* Empty State */}
        {pastEngagements.length === 0 && caseStudies.length === 0 && internalContacts.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <History sx={{ fontSize: 48, color: '#d4d4d4', mb: 1 }} />
            <Typography variant="body2" color="#737373">
              No prior relationship history found.
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default RelationshipContext;
