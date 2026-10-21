import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  InputAdornment,
  Divider,
  CircularProgress,
  Paper,
  Stack,
  Avatar,
} from '@mui/material';
import {
  Search,
  Business,
  Event,
  Description,
  Person,
  TrendingUp,
  History,
  Lightbulb,
  Article,
  Folder,
  Analytics,
  KeyboardReturn,
  KeyboardArrowUp,
  KeyboardArrowDown,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../utils/api';

interface SearchResult {
  id: string;
  type: 'company' | 'meeting' | 'deal' | 'case_study' | 'document' | 'analysis' | 'person';
  title: string;
  subtitle?: string;
  url?: string;
  metadata?: Record<string, any>;
}

const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  company: { icon: <Business />, color: 'secondary.main', label: 'Company' },
  meeting: { icon: <Event />, color: 'success.main', label: 'Meeting' },
  deal: { icon: <TrendingUp />, color: '#a855f7', label: 'Deal' },
  case_study: { icon: <Article />, color: '#f97316', label: 'Case Study' },
  document: { icon: <Description />, color: 'text.disabled', label: 'Document' },
  analysis: { icon: <Analytics />, color: '#00A48C', label: 'Analysis' },
  person: { icon: <Person />, color: '#ec4899', label: 'Person' },
};

const quickActions = [
  { id: 'new-research', label: 'Start new company research', icon: <Search />, action: '/analysis', shortcut: 'R' },
  { id: 'calendar', label: 'View calendar', icon: <Event />, action: '/', shortcut: 'C' },
  { id: 'deals', label: 'View deals pipeline', icon: <TrendingUp />, action: '/deals', shortcut: 'D' },
  { id: 'rfp', label: 'Research RFP', icon: <Description />, action: '/rfp', shortcut: 'F' },
];

const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const onClose = () => setOpen(false);

  // Listen for global open event
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-command-palette', handleOpen);
    return () => window.removeEventListener('open-command-palette', handleOpen);
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      // Search multiple endpoints in parallel
      const [meetingsRes, dealsRes, analysesRes] = await Promise.allSettled([
        apiGet('/api/meetings'),
        apiGet('/api/deals'),
        apiGet('/api/research/history'),
      ]);

      const allResults: SearchResult[] = [];
      const lowerQuery = searchQuery.toLowerCase();

      // Process meetings
      if (meetingsRes.status === 'fulfilled' && meetingsRes.value?.data) {
        const meetings = Array.isArray(meetingsRes.value.data) ? meetingsRes.value.data : [];
        meetings
          .filter((m: any) =>
            m.subject?.toLowerCase().includes(lowerQuery) ||
            m.company_name?.toLowerCase().includes(lowerQuery) ||
            m.attendees?.some((a: any) => a.name?.toLowerCase().includes(lowerQuery))
          )
          .slice(0, 5)
          .forEach((m: any) => {
            allResults.push({
              id: m.meeting_id,
              type: 'meeting',
              title: m.subject || 'Untitled Meeting',
              subtitle: m.company_name || (m.start_time ? new Date(m.start_time).toLocaleDateString() : ''),
              url: `/meeting/${m.meeting_id}`,
            });
          });
      }

      // Process deals
      if (dealsRes.status === 'fulfilled' && dealsRes.value?.data) {
        const deals = Array.isArray(dealsRes.value.data) ? dealsRes.value.data : [];
        deals
          .filter((d: any) =>
            d.opportunity_name?.toLowerCase().includes(lowerQuery) ||
            d.company_name?.toLowerCase().includes(lowerQuery)
          )
          .slice(0, 5)
          .forEach((d: any) => {
            allResults.push({
              id: d.deal_id,
              type: 'deal',
              title: d.opportunity_name || d.company_name || 'Untitled Deal',
              subtitle: `${d.stage || 'Unknown Stage'} • ${d.company_name || ''}`,
              url: `/deals/${d.deal_id}`,
            });
          });
      }

      // Process analyses/research history
      if (analysesRes.status === 'fulfilled' && analysesRes.value?.data) {
        const analyses = Array.isArray(analysesRes.value.data) ? analysesRes.value.data : [];
        analyses
          .filter((a: any) =>
            a.company_name?.toLowerCase().includes(lowerQuery) ||
            a.subject?.toLowerCase().includes(lowerQuery)
          )
          .slice(0, 5)
          .forEach((a: any) => {
            allResults.push({
              id: a.session_id || a.id,
              type: 'analysis',
              title: a.company_name || a.subject || 'Analysis',
              subtitle: a.created_at ? new Date(a.created_at).toLocaleDateString() : '',
              url: `/analysis?sessionId=${a.session_id || a.id}`,
            });
          });
      }

      setResults(allResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (query.length >= 2) {
      searchTimeout.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query, performSearch]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = query.length < 2 ? quickActions.length : results.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        handleSelect();
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  const handleSelect = () => {
    if (query.length < 2) {
      // Quick action
      const action = quickActions[selectedIndex];
      if (action) {
        navigate(action.action);
        onClose();
      }
    } else {
      // Search result
      const result = results[selectedIndex];
      if (result?.url) {
        // Save to recent searches
        const newRecent = [query, ...recentSearches.filter((s) => s !== query)].slice(0, 5);
        setRecentSearches(newRecent);
        localStorage.setItem('recentSearches', JSON.stringify(newRecent));

        navigate(result.url);
        onClose();
      }
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.url) {
      navigate(result.url);
      onClose();
    }
  };

  const handleQuickActionClick = (action: typeof quickActions[0]) => {
    navigate(action.action);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          position: 'fixed',
          top: '15%',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        },
      }}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
        },
      }}
    >
      <Box sx={{ p: 0 }}>
        {/* Search Input */}
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder="Search companies, meetings, deals, or type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {loading ? (
                  <CircularProgress size={20} sx={{ color: '#00A48C' }} />
                ) : (
                  <Search sx={{ color: 'text.disabled' }} />
                )}
              </InputAdornment>
            ),
            sx: {
              fontSize: '1.1rem',
              py: 1.5,
              px: 2,
              '& fieldset': { border: 'none' },
            },
          }}
          autoComplete="off"
        />

        <Divider />

        <DialogContent sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
          {/* Show quick actions when no query */}
          {query.length < 2 && (
            <Box>
              <Typography
                variant="caption"
                sx={{ px: 2, py: 1, display: 'block', color: 'text.disabled', fontWeight: 600 }}
              >
                QUICK ACTIONS
              </Typography>
              <List dense>
                {quickActions.map((action, index) => (
                  <ListItem
                    key={action.id}
                    onClick={() => handleQuickActionClick(action)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: selectedIndex === index ? 'rgba(0, 164, 140, 0.1)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(0, 164, 140, 0.08)' },
                      mx: 1,
                      borderRadius: 1.5,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: '#00A48C' }}>
                      {action.icon}
                    </ListItemIcon>
                    <ListItemText primary={action.label} />
                    <Chip
                      label={action.shortcut}
                      size="small"
                      sx={{
                        height: 24,
                        bgcolor: 'rgba(0, 35, 72, 0.08)',
                        color: 'text.disabled',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    />
                  </ListItem>
                ))}
              </List>

              {recentSearches.length > 0 && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography
                    variant="caption"
                    sx={{ px: 2, py: 1, display: 'block', color: 'text.disabled', fontWeight: 600 }}
                  >
                    RECENT SEARCHES
                  </Typography>
                  <List dense>
                    {recentSearches.map((search, index) => (
                      <ListItem
                        key={index}
                        onClick={() => setQuery(search)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(0, 164, 140, 0.08)' },
                          mx: 1,
                          borderRadius: 1.5,
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40, color: 'text.disabled' }}>
                          <History fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={search} primaryTypographyProps={{ color: 'text.disabled' }} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Box>
          )}

          {/* Search Results */}
          {query.length >= 2 && (
            <Box>
              {results.length > 0 ? (
                <List dense>
                  {results.map((result, index) => {
                    const config = typeConfig[result.type];
                    return (
                      <ListItem
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: selectedIndex === index ? 'rgba(0, 164, 140, 0.1)' : 'transparent',
                          '&:hover': { bgcolor: 'rgba(0, 164, 140, 0.08)' },
                          mx: 1,
                          borderRadius: 1.5,
                          py: 1.5,
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 44 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: `${config.color}20`,
                              color: config.color,
                            }}
                          >
                            {config.icon}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={result.title}
                          secondary={result.subtitle}
                          primaryTypographyProps={{ fontWeight: 600, color: 'text.primary' }}
                          secondaryTypographyProps={{ fontSize: '0.8rem' }}
                        />
                        <Chip
                          label={config.label}
                          size="small"
                          sx={{
                            height: 22,
                            bgcolor: `${config.color}15`,
                            color: config.color,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                !loading && (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Lightbulb sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No results found for "{query}"
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Try searching for a company name, meeting subject, or deal
                    </Typography>
                  </Box>
                )
              )}
            </Box>
          )}
        </DialogContent>

        {/* Footer with keyboard hints */}
        <Divider />
        <Box
          sx={{
            px: 2,
            py: 1,
            bgcolor: 'background.default',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Stack direction="row" spacing={2}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                sx={{
                  px: 0.75,
                  py: 0.25,
                  bgcolor: 'background.paper',
                  borderRadius: 0.5,
                  borderColor: 'divider',
                  fontSize: '0.7rem',
                }}
              >
                <KeyboardArrowUp sx={{ fontSize: 14 }} />
              </Box>
              <Box
                sx={{
                  px: 0.75,
                  py: 0.25,
                  bgcolor: 'background.paper',
                  borderRadius: 0.5,
                  borderColor: 'divider',
                  fontSize: '0.7rem',
                }}
              >
                <KeyboardArrowDown sx={{ fontSize: 14 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Navigate
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                sx={{
                  px: 0.75,
                  py: 0.25,
                  bgcolor: 'background.paper',
                  borderRadius: 0.5,
                  borderColor: 'divider',
                  fontSize: '0.7rem',
                }}
              >
                <KeyboardReturn sx={{ fontSize: 14 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Select
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                sx={{
                  px: 0.75,
                  py: 0.25,
                  bgcolor: 'background.paper',
                  borderRadius: 0.5,
                  borderColor: 'divider',
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                }}
              >
                esc
              </Box>
              <Typography variant="caption" color="text.secondary">
                Close
              </Typography>
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            ⌘K to open
          </Typography>
        </Box>
      </Box>
    </Dialog>
  );
};

export default CommandPalette;
