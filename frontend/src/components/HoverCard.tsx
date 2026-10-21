import React, { useState, useRef, useEffect } from 'react';
import {
  Popper,
  Paper,
  Box,
  Typography,
  Avatar,
  Chip,
  Stack,
  Divider,
  Button,
  CircularProgress,
  Fade,
  ClickAwayListener,
} from '@mui/material';
import {
  Business,
  Person,
  TrendingUp,
  Event,
  Email,
  Phone,
  LinkedIn,
  Launch,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../utils/api';

interface CompanyData {
  name: string;
  industry?: string;
  employeeCount?: string;
  revenue?: string;
  website?: string;
  hasHistory?: boolean;
  pastEngagements?: number;
  activeDealCount?: number;
  lastMeeting?: string;
  recentNews?: string[];
}

interface PersonData {
  name: string;
  email?: string;
  role?: string;
  company?: string;
  phone?: string;
  linkedIn?: string;
  meetingCount?: number;
  lastContact?: string;
  isDecisionMaker?: boolean;
}

interface HoverCardProps {
  children: React.ReactNode;
  type: 'company' | 'person';
  id?: string;
  name: string;
  email?: string; // For person lookup
  preloadedData?: CompanyData | PersonData;
}

const HoverCard: React.FC<HoverCardProps> = ({
  children,
  type,
  id,
  name,
  email,
  preloadedData,
}) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CompanyData | PersonData | null>(preloadedData || null);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
  const leaveTimeout = useRef<NodeJS.Timeout | null>(null);

  const open = Boolean(anchorEl);

  const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
    if (leaveTimeout.current) {
      clearTimeout(leaveTimeout.current);
    }

    hoverTimeout.current = setTimeout(() => {
      setAnchorEl(event.currentTarget);

      // Load data if not preloaded
      if (!data && !loading) {
        loadData();
      }
    }, 500); // Delay before showing
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }

    leaveTimeout.current = setTimeout(() => {
      setAnchorEl(null);
    }, 300); // Delay before hiding
  };

  const handlePopperMouseEnter = () => {
    if (leaveTimeout.current) {
      clearTimeout(leaveTimeout.current);
    }
  };

  const handlePopperMouseLeave = () => {
    leaveTimeout.current = setTimeout(() => {
      setAnchorEl(null);
    }, 300);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (type === 'company') {
        // Try to fetch company data from various sources
        const [dealsRes, meetingsRes] = await Promise.allSettled([
          apiGet(`/api/deals?company=${encodeURIComponent(name)}`),
          apiGet(`/api/meetings?company=${encodeURIComponent(name)}`),
        ]);

        const deals = dealsRes.status === 'fulfilled' ? dealsRes.value?.data || [] : [];
        const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value?.data || [] : [];

        const companyData: CompanyData = {
          name,
          activeDealCount: Array.isArray(deals) ? deals.length : 0,
          pastEngagements: Array.isArray(meetings) ? meetings.length : 0,
          lastMeeting: Array.isArray(meetings) && meetings.length > 0
            ? new Date(meetings[0].start_time).toLocaleDateString()
            : undefined,
          hasHistory: (Array.isArray(deals) && deals.length > 0) || (Array.isArray(meetings) && meetings.length > 0),
        };

        setData(companyData);
      } else {
        // Person data
        const personData: PersonData = {
          name,
          email,
          // Additional data would come from attendee research
        };

        setData(personData);
      }
    } catch (error) {
      console.error('Failed to load hover card data:', error);
      // Set minimal data
      setData(type === 'company' ? { name } : { name, email });
    } finally {
      setLoading(false);
    }
  };

  const handleClickAction = (action: string) => {
    setAnchorEl(null);

    switch (action) {
      case 'research':
        navigate(`/analysis?company=${encodeURIComponent(name)}`);
        break;
      case 'deals':
        navigate(`/deals?search=${encodeURIComponent(name)}`);
        break;
      case 'meetings':
        navigate(`/?search=${encodeURIComponent(name)}`);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
      if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
    };
  }, []);

  return (
    <>
      <Box
        component="span"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          cursor: 'pointer',
          '&:hover': {
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            textDecorationColor: '#00A48C',
          },
        }}
      >
        {children}
      </Box>

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="top-start"
        transition
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 8],
            },
          },
        ]}
        sx={{ zIndex: 1500 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper
              elevation={8}
              onMouseEnter={handlePopperMouseEnter}
              onMouseLeave={handlePopperMouseLeave}
              sx={{
                width: 320,
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: type === 'company' ? '#002348' : '#1e3a5f',
                  color: 'white',
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    sx={{
                      bgcolor: type === 'company' ? '#00A48C' : '#3b82f6',
                      width: 40,
                      height: 40,
                    }}
                  >
                    {type === 'company' ? <Business /> : <Person />}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {name}
                    </Typography>
                    {type === 'person' && email && (
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {email}
                      </Typography>
                    )}
                    {type === 'company' && (data as CompanyData)?.industry && (
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {(data as CompanyData).industry}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Box>

              {/* Content */}
              <Box sx={{ p: 2 }}>
                {loading ? (
                  <Box sx={{ py: 2, textAlign: 'center' }}>
                    <CircularProgress size={24} sx={{ color: '#00A48C' }} />
                  </Box>
                ) : data ? (
                  type === 'company' ? (
                    <CompanyContent data={data as CompanyData} />
                  ) : (
                    <PersonContent data={data as PersonData} />
                  )
                ) : null}
              </Box>

              {/* Actions */}
              <Divider />
              <Box sx={{ p: 1.5, bgcolor: 'background.default' }}>
                <Stack direction="row" spacing={1}>
                  {type === 'company' && (
                    <>
                      <Button
                        size="small"
                        startIcon={<TrendingUp />}
                        onClick={() => handleClickAction('research')}
                        sx={{ color: '#00A48C', textTransform: 'none' }}
                      >
                        Research
                      </Button>
                      <Button
                        size="small"
                        startIcon={<Business />}
                        onClick={() => handleClickAction('deals')}
                        sx={{ color: 'text.disabled', textTransform: 'none' }}
                      >
                        Deals
                      </Button>
                      <Button
                        size="small"
                        startIcon={<Event />}
                        onClick={() => handleClickAction('meetings')}
                        sx={{ color: 'text.disabled', textTransform: 'none' }}
                      >
                        Meetings
                      </Button>
                    </>
                  )}
                  {type === 'person' && (data as PersonData)?.linkedIn && (
                    <Button
                      size="small"
                      startIcon={<LinkedIn />}
                      component="a"
                      href={(data as PersonData).linkedIn}
                      target="_blank"
                      sx={{ color: '#0077b5', textTransform: 'none' }}
                    >
                      LinkedIn
                    </Button>
                  )}
                </Stack>
              </Box>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  );
};

// Company Content Component
const CompanyContent: React.FC<{ data: CompanyData }> = ({ data }) => (
  <Stack spacing={1.5}>
    {/* Relationship Status */}
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: data.hasHistory ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {data.hasHistory ? (
          <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />
        ) : (
          <Warning sx={{ color: 'text.disabled', fontSize: 18 }} />
        )}
        <Typography variant="body2" fontWeight={600}>
          {data.hasHistory ? 'Existing Relationship' : 'New Prospect'}
        </Typography>
      </Stack>
    </Box>

    {/* Quick Stats */}
    <Stack direction="row" spacing={2}>
      {data.activeDealCount !== undefined && data.activeDealCount > 0 && (
        <Box>
          <Typography variant="h6" fontWeight={700} color="#002348">
            {data.activeDealCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Active Deals
          </Typography>
        </Box>
      )}
      {data.pastEngagements !== undefined && data.pastEngagements > 0 && (
        <Box>
          <Typography variant="h6" fontWeight={700} color="#002348">
            {data.pastEngagements}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Past Meetings
          </Typography>
        </Box>
      )}
    </Stack>

    {/* Last Contact */}
    {data.lastMeeting && (
      <Typography variant="body2" color="text.secondary">
        Last meeting: {data.lastMeeting}
      </Typography>
    )}
  </Stack>
);

// Person Content Component
const PersonContent: React.FC<{ data: PersonData }> = ({ data }) => (
  <Stack spacing={1.5}>
    {/* Role & Company */}
    {(data.role || data.company) && (
      <Box>
        {data.role && (
          <Typography variant="body2" fontWeight={600} color="#002348">
            {data.role}
          </Typography>
        )}
        {data.company && (
          <Typography variant="body2" color="text.secondary">
            {data.company}
          </Typography>
        )}
      </Box>
    )}

    {/* Contact Info */}
    <Stack spacing={0.5}>
      {data.email && (
        <Stack direction="row" spacing={1} alignItems="center">
          <Email sx={{ fontSize: 16, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            {data.email}
          </Typography>
        </Stack>
      )}
      {data.phone && (
        <Stack direction="row" spacing={1} alignItems="center">
          <Phone sx={{ fontSize: 16, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            {data.phone}
          </Typography>
        </Stack>
      )}
    </Stack>

    {/* Decision Maker Badge */}
    {data.isDecisionMaker && (
      <Chip
        label="Decision Maker"
        size="small"
        sx={{
          bgcolor: 'rgba(168, 85, 247, 0.15)',
          color: '#a855f7',
          fontWeight: 600,
          alignSelf: 'flex-start',
        }}
      />
    )}

    {/* Meeting Count */}
    {data.meetingCount !== undefined && data.meetingCount > 0 && (
      <Typography variant="body2" color="text.secondary">
        {data.meetingCount} meetings together
        {data.lastContact && ` • Last: ${data.lastContact}`}
      </Typography>
    )}
  </Stack>
);

export default HoverCard;
