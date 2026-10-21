import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Paper,
  IconButton,
  Chip,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Fade,
  Tooltip,
  Card,
  CardContent,
  Stack,
  alpha,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import {
  Send,
  TravelExplore,
  Business,
  Language,
  LocationOn,
  SaveAlt,
  CheckCircle,
  ContentCopy,
  Person,
  Add,
  ExpandMore,
  ExpandLess,
  Search,
  Psychology,
  Delete,
  MenuBook,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { apiPost, apiGet, apiDelete } from '../utils/api';
import { useAccountsStore } from '../store/accountsStore';
import SaveBookmarkButton from '../components/SaveBookmarkButton';
import ExpiryBadge from '../components/ExpiryBadge';

interface DiscoveryAccount {
  name: string;
  domain?: string;
  industry?: string;
  location?: string;
  summary?: string;
}

interface DiscoverySource {
  title: string;
  url: string;
}

interface ThinkingStep {
  step: string;
  detail: string;
}

interface InternalKnowledgeResult {
  summary: string;
  documents: Array<{ id: string; title: string; content: string; url?: string; relevanceScore: number; documentType?: string }>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  accounts?: DiscoveryAccount[];
  sources?: DiscoverySource[];
  thinking?: ThinkingStep[];
  internalKbResults?: InternalKnowledgeResult;
}

interface SessionSummary {
  sessionId: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  isSaved: boolean;
  messageCount: number;
}

const THEME = {
  primary: '#171717',
  accent: '#2563eb',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
};

const SUGGESTED_PROMPTS = [
  {
    label: 'Company Research',
    prompt: 'Research Atlassian and their competitive landscape in the project management space',
    icon: <Business sx={{ fontSize: 18 }} />,
  },
  {
    label: 'Find Leads',
    prompt: 'Find qualified leads in the healthcare SaaS industry in the United States',
    icon: <Person sx={{ fontSize: 18 }} />,
  },
  {
    label: 'Key Contacts',
    prompt: 'Who are the key decision makers at Salesforce for enterprise deals?',
    icon: <Person sx={{ fontSize: 18 }} />,
  },
  {
    label: 'Market Analysis',
    prompt: 'Analyze the enterprise DevOps tools market and identify top players',
    icon: <TravelExplore sx={{ fontSize: 18 }} />,
  },
];

// Thinking steps display component
const ThinkingSteps: React.FC<{ steps: ThinkingStep[] }> = ({ steps }) => {
  const [expanded, setExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

  const stepIcons: Record<string, React.ReactNode> = {
    'Searching the web': <Search sx={{ fontSize: 14, color: THEME.accent }} />,
    'Searching internal knowledge base': <MenuBook sx={{ fontSize: 14, color: 'success.main' }} />,
    'Searching Sales Intelligence': <MenuBook sx={{ fontSize: 14, color: 'success.main' }} />,
    'Synthesizing findings': <Psychology sx={{ fontSize: 14, color: '#7c3aed' }} />,
  };

  return (
    <Box
      sx={{
        mb: 1,
        bgcolor: 'rgba(37, 99, 235, 0.04)',
        border: `1px solid ${THEME.slate200}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.06)' },
        }}
      >
        <Psychology sx={{ fontSize: 16, color: THEME.slate500 }} />
        <Typography sx={{ fontSize: '0.75rem', color: THEME.slate500, fontWeight: 600 }}>
          {steps.length} thinking step{steps.length !== 1 ? 's' : ''}
        </Typography>
        {expanded ? (
          <ExpandLess sx={{ fontSize: 16, color: THEME.slate400, ml: 'auto' }} />
        ) : (
          <ExpandMore sx={{ fontSize: 16, color: THEME.slate400, ml: 'auto' }} />
        )}
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 1.5 }}>
          {steps.map((step, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
              {stepIcons[step.step] || <Psychology sx={{ fontSize: 14, color: THEME.slate400 }} />}
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: THEME.slate600 }}>
                  {step.step}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: THEME.slate500 }}>
                  {step.detail}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

// InternalKnowledge results display component
const InternalKnowledgeResultsSection: React.FC<{ results: InternalKnowledgeResult }> = ({ results }) => {
  const [expanded, setExpanded] = useState(false);

  if (!results || !results.documents || results.documents.length === 0) return null;

  return (
    <Box
      sx={{
        mt: 1.5,
        bgcolor: 'rgba(5, 150, 105, 0.04)',
        border: '1px solid rgba(5, 150, 105, 0.2)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(5, 150, 105, 0.06)' },
        }}
      >
        <MenuBook sx={{ fontSize: 16, color: 'success.main' }} />
        <Typography sx={{ fontSize: '0.75rem', color: 'success.main', fontWeight: 600 }}>
          Internal Knowledge ({results.documents.length} document{results.documents.length !== 1 ? 's' : ''})
        </Typography>
        {expanded ? (
          <ExpandLess sx={{ fontSize: 16, color: 'success.main', ml: 'auto' }} />
        ) : (
          <ExpandMore sx={{ fontSize: 16, color: 'success.main', ml: 'auto' }} />
        )}
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 1.5 }}>
          {results.summary && (
            <Typography sx={{ fontSize: '0.8rem', color: THEME.slate600, mb: 1, lineHeight: 1.5 }}>
              {results.summary}
            </Typography>
          )}
          {results.documents.slice(0, 5).map((doc, idx) => (
            <Box
              key={idx}
              sx={{
                py: 0.75,
                borderTop: idx > 0 ? `1px solid ${THEME.slate200}` : undefined,
              }}
            >
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: THEME.primary }}>
                {doc.title}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: THEME.slate500, lineHeight: 1.4 }}>
                {doc.content.length > 200 ? doc.content.substring(0, 200) + '...' : doc.content}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

const DiscoveryPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<Set<string>>(new Set());
  const [savingAccount, setSavingAccount] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { createAccount } = useAccountsStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const response = await apiGet('/api/discovery/sessions');
      if (response?.success) {
        setSessions(response.data || []);
      }
    } catch {
      // Silent fail — sidebar will show empty
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setSavedAccounts(new Set());
  };

  const handleLoadSession = async (sid: string) => {
    try {
      const response = await apiGet(`/api/discovery/sessions/${sid}`);
      if (response?.success && response.data) {
        setSessionId(sid);
        const rawMessages = (response.data.messages || []) as any[];
        const loadedMessages: Message[] = rawMessages.map((m: any, idx: number) => ({
          id: `${m.role}-${idx}`,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp || response.data.createdAt),
          accounts: m.accounts,
          sources: m.sources,
          thinking: m.thinking,
          internalKbResults: m.internalKbResults,
        }));
        setMessages(loadedMessages);
        setSavedAccounts(new Set());
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to load session', severity: 'error' });
    }
  };

  const handleDeleteSession = async (sid: string) => {
    try {
      await apiDelete(`/api/discovery/sessions/${sid}`);
      if (sessionId === sid) {
        handleNewChat();
      }
      fetchSessions();
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete session', severity: 'error' });
    }
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await apiPost('/api/discovery/chat', {
        message: messageText,
        sessionId,
      });

      if (response?.success && response.data) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date(),
          accounts: response.data.accounts,
          sources: response.data.sources,
          thinking: response.data.thinking,
          internalKbResults: response.data.internalKbResults,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Track session ID
        if (response.data.sessionId && !sessionId) {
          setSessionId(response.data.sessionId);
        }

        // Refresh sessions list
        fetchSessions();
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${error.message || 'Failed to get response. Please try again.'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccount = async (account: DiscoveryAccount) => {
    setSavingAccount(account.name);
    try {
      const result = await createAccount({
        name: account.name,
        domain: account.domain,
        industry: account.industry,
        location: account.location,
        summary: account.summary,
      });
      if (result) {
        setSavedAccounts((prev) => new Set(prev).add(account.name));
        setSnackbar({ open: true, message: `"${account.name}" saved to Accounts`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'Failed to save account', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to save account', severity: 'error' });
    } finally {
      setSavingAccount(null);
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <Fade in timeout={400}>
      <Box sx={{ minHeight: '100vh', bgcolor: THEME.slate50 }}>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          {/* Header - dark banner */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 3,
              borderRadius: 3,
              bgcolor: THEME.primary,
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
            <Stack direction="row" spacing={3} alignItems="center">
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
                <TravelExplore sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                  Discovery
                </Typography>
                <Typography variant="body1" sx={{ color: alpha('#fff', 0.85) }}>
                  Research companies, find qualified leads, and analyze competitive landscapes with AI-powered web search and internal knowledge
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Main content: sidebar + chat */}
          <Paper
            elevation={0}
            sx={{
              border: `1px solid ${THEME.slate200}`,
              borderRadius: 2,
              overflow: 'hidden',
              display: 'flex',
              height: 'calc(100vh - 280px)',
              bgcolor: 'background.paper',
            }}
          >
            {/* Session sidebar */}
            <Box
              sx={{
                width: 260,
                minWidth: 260,
                borderRight: `1px solid ${THEME.slate200}`,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: THEME.slate50,
              }}
            >
              <Box sx={{ p: 1.5 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Add sx={{ fontSize: 18 }} />}
                  onClick={handleNewChat}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    borderColor: THEME.slate200,
                    color: THEME.primary,
                    borderRadius: 2,
                    py: 1,
                    '&:hover': {
                      borderColor: THEME.accent,
                      bgcolor: 'rgba(37, 99, 235, 0.04)',
                    },
                  }}
                >
                  New Chat
                </Button>
              </Box>

              <Divider />

              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: THEME.slate300, borderRadius: 2 },
                }}
              >
                {sessionsLoading && sessions.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={20} sx={{ color: THEME.slate400 }} />
                  </Box>
                ) : sessions.length === 0 ? (
                  <Typography sx={{ px: 2, py: 3, fontSize: '0.78rem', color: THEME.slate400, textAlign: 'center' }}>
                    No conversations yet
                  </Typography>
                ) : (
                  <List disablePadding>
                    {sessions.map((s) => (
                      <ListItemButton
                        key={s.sessionId}
                        selected={sessionId === s.sessionId}
                        onClick={() => handleLoadSession(s.sessionId)}
                        sx={{
                          px: 1.5,
                          py: 1,
                          borderBottom: `1px solid ${THEME.slate100}`,
                          '&.Mui-selected': {
                            bgcolor: 'rgba(37, 99, 235, 0.06)',
                            borderLeft: `3px solid ${THEME.accent}`,
                          },
                          '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.03)' },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography
                              sx={{
                                fontSize: '0.78rem',
                                fontWeight: sessionId === s.sessionId ? 600 : 400,
                                color: THEME.primary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {s.title || 'Untitled'}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                              <Typography sx={{ fontSize: '0.68rem', color: THEME.slate400 }}>
                                {formatTimeAgo(s.updatedAt)}
                              </Typography>
                              <ExpiryBadge
                                createdAt={s.createdAt}
                                isSaved={s.isSaved}
                              />
                            </Box>
                          }
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 0.5 }}>
                          <SaveBookmarkButton
                            modelType="discoverySession"
                            id={s.sessionId}
                            isSaved={s.isSaved}
                            onToggle={() => fetchSessions()}
                            size="small"
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(s.sessionId);
                            }}
                            sx={{ color: THEME.slate400, '&:hover': { color: 'error.main' } }}
                          >
                            <Delete sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>
            </Box>

            {/* Chat area */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Messages area */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  px: { xs: 2, md: 4 },
                  py: 3,
                  '&::-webkit-scrollbar': { width: 6 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: THEME.slate300, borderRadius: 3 },
                }}
              >
                {messages.length === 0 ? (
                  /* Empty state with suggestions */
                  <Fade in>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        gap: 4,
                      }}
                    >
                      <Box sx={{ textAlign: 'center' }}>
                        <Box
                          sx={{
                            width: 72,
                            height: 72,
                            borderRadius: '50%',
                            bgcolor: 'rgba(37, 99, 235, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 2,
                          }}
                        >
                          <Psychology sx={{ fontSize: 36, color: THEME.accent }} />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: THEME.primary, mb: 1 }}>
                          What would you like to discover?
                        </Typography>
                        <Typography sx={{ color: THEME.slate500, maxWidth: 500, mx: 'auto' }}>
                          Research companies, analyze markets, find decision makers, and identify qualified leads — powered by web search and internal knowledge.
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          gap: 1.5,
                          maxWidth: 700,
                          width: '100%',
                        }}
                      >
                        {SUGGESTED_PROMPTS.map((suggestion) => (
                          <Paper
                            key={suggestion.label}
                            onClick={() => handleSend(suggestion.prompt)}
                            sx={{
                              p: 2,
                              cursor: 'pointer',
                              border: `1px solid ${THEME.slate200}`,
                              borderRadius: 2,
                              transition: 'all 0.15s',
                              '&:hover': {
                                borderColor: THEME.accent,
                                bgcolor: 'rgba(37, 99, 235, 0.03)',
                                transform: 'translateY(-1px)',
                              },
                            }}
                            elevation={0}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Box sx={{ color: THEME.accent }}>{suggestion.icon}</Box>
                              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: THEME.primary }}>
                                {suggestion.label}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontSize: '0.8rem', color: THEME.slate500, lineHeight: 1.4 }}>
                              {suggestion.prompt}
                            </Typography>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  </Fade>
                ) : (
                  /* Message thread */
                  <Box sx={{ maxWidth: 900, mx: 'auto', width: '100%' }}>
                    {messages.map((msg) => (
                      <Box
                        key={msg.id}
                        sx={{
                          display: 'flex',
                          justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                          mb: 2.5,
                        }}
                      >
                        {msg.role === 'user' ? (
                          /* User message bubble */
                          <Box
                            sx={{
                              maxWidth: '70%',
                              bgcolor: THEME.accent,
                              color: '#fff',
                              px: 2.5,
                              py: 1.5,
                              borderRadius: '18px 18px 4px 18px',
                              fontSize: '0.9rem',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {msg.content}
                          </Box>
                        ) : (
                          /* Assistant message */
                          <Box sx={{ maxWidth: '85%', width: '100%' }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <TravelExplore sx={{ fontSize: 16, color: '#fff' }} />
                              </Box>
                              <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', color: THEME.slate500 }}>
                                Discovery AI
                              </Typography>
                              <Tooltip title={copiedId === msg.id ? 'Copied!' : 'Copy response'}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleCopy(msg.content, msg.id)}
                                  sx={{ color: THEME.slate400, ml: 'auto' }}
                                >
                                  {copiedId === msg.id ? (
                                    <CheckCircle sx={{ fontSize: 16 }} />
                                  ) : (
                                    <ContentCopy sx={{ fontSize: 16 }} />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </Box>

                            {/* Chain-of-thought thinking steps */}
                            {msg.thinking && <ThinkingSteps steps={msg.thinking} />}

                            <Paper
                              elevation={0}
                              sx={{
                                bgcolor: THEME.slate50,
                                border: `1px solid ${THEME.slate200}`,
                                borderRadius: 2.5,
                                px: 2.5,
                                py: 2,
                              }}
                            >
                              <Box
                                sx={{
                                  fontSize: '0.88rem',
                                  lineHeight: 1.7,
                                  color: 'text.primary',
                                  '& h1, & h2, & h3, & h4': {
                                    fontWeight: 600,
                                    mt: 2,
                                    mb: 1,
                                    color: THEME.primary,
                                    '&:first-of-type': { mt: 0 },
                                  },
                                  '& h2': { fontSize: '1.1rem' },
                                  '& h3': { fontSize: '1rem' },
                                  '& p': { mb: 1.5, '&:last-child': { mb: 0 } },
                                  '& ul, & ol': { pl: 2.5, mb: 1.5 },
                                  '& li': { mb: 0.5 },
                                  '& strong': { fontWeight: 600 },
                                  '& a': { color: THEME.accent, textDecoration: 'none' },
                                  '& code': {
                                    bgcolor: THEME.slate100,
                                    px: 0.5,
                                    py: 0.25,
                                    borderRadius: 0.5,
                                    fontSize: '0.85em',
                                  },
                                }}
                              >
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </Box>
                            </Paper>

                            {/* InternalKnowledge results */}
                            {msg.internalKbResults && <InternalKnowledgeResultsSection results={msg.internalKbResults} />}

                            {/* Account cards */}
                            {msg.accounts && msg.accounts.length > 0 && (
                              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: THEME.slate500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Discovered Companies
                                </Typography>
                                {msg.accounts.map((account, idx) => (
                                  <Card
                                    key={`${msg.id}-account-${idx}`}
                                    variant="outlined"
                                    sx={{
                                      borderRadius: 2,
                                      borderColor: savedAccounts.has(account.name) ? '#059669' : THEME.slate200,
                                      bgcolor: savedAccounts.has(account.name) ? 'rgba(5, 150, 105, 0.04)' : '#fff',
                                    }}
                                  >
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <Box sx={{ flex: 1 }}>
                                          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: THEME.primary }}>
                                            {account.name}
                                          </Typography>
                                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                                            {account.industry && (
                                              <Chip
                                                icon={<Business sx={{ fontSize: 14 }} />}
                                                label={account.industry}
                                                size="small"
                                                sx={{ height: 22, fontSize: '0.7rem' }}
                                              />
                                            )}
                                            {account.location && (
                                              <Chip
                                                icon={<LocationOn sx={{ fontSize: 14 }} />}
                                                label={account.location}
                                                size="small"
                                                sx={{ height: 22, fontSize: '0.7rem' }}
                                              />
                                            )}
                                            {account.domain && (
                                              <Chip
                                                icon={<Language sx={{ fontSize: 14 }} />}
                                                label={account.domain}
                                                size="small"
                                                sx={{ height: 22, fontSize: '0.7rem' }}
                                              />
                                            )}
                                          </Box>
                                          {account.summary && (
                                            <Typography sx={{ fontSize: '0.8rem', color: THEME.slate500, mt: 1, lineHeight: 1.4 }}>
                                              {account.summary}
                                            </Typography>
                                          )}
                                        </Box>
                                        <Box sx={{ ml: 2 }}>
                                          {savedAccounts.has(account.name) ? (
                                            <Chip
                                              icon={<CheckCircle sx={{ fontSize: 14 }} />}
                                              label="Saved"
                                              size="small"
                                              sx={{
                                                height: 26,
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                bgcolor: 'rgba(5, 150, 105, 0.1)',
                                                color: 'success.main',
                                              }}
                                            />
                                          ) : (
                                            <Button
                                              variant="outlined"
                                              size="small"
                                              startIcon={
                                                savingAccount === account.name ? (
                                                  <CircularProgress size={14} />
                                                ) : (
                                                  <SaveAlt sx={{ fontSize: 16 }} />
                                                )
                                              }
                                              disabled={savingAccount === account.name}
                                              onClick={() => handleSaveAccount(account)}
                                              sx={{
                                                fontSize: '0.75rem',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                borderColor: THEME.accent,
                                                color: THEME.accent,
                                                '&:hover': {
                                                  bgcolor: 'rgba(37, 99, 235, 0.04)',
                                                  borderColor: THEME.accent,
                                                },
                                              }}
                                            >
                                              Save to Accounts
                                            </Button>
                                          )}
                                        </Box>
                                      </Box>
                                    </CardContent>
                                  </Card>
                                ))}
                              </Box>
                            )}

                            {/* Source links */}
                            {msg.sources && msg.sources.length > 0 && (
                              <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                {msg.sources.slice(0, 5).map((source, idx) => (
                                  <Chip
                                    key={`${msg.id}-source-${idx}`}
                                    label={source.title.length > 40 ? source.title.substring(0, 40) + '...' : source.title}
                                    size="small"
                                    component="a"
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    clickable
                                    sx={{
                                      height: 24,
                                      fontSize: '0.7rem',
                                      bgcolor: 'rgba(37, 99, 235, 0.06)',
                                      color: THEME.accent,
                                      '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.12)' },
                                    }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    ))}

                    {/* Loading indicator */}
                    {loading && (
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <TravelExplore sx={{ fontSize: 16, color: '#fff' }} />
                        </Box>
                        <Paper
                          elevation={0}
                          sx={{
                            bgcolor: THEME.slate50,
                            border: `1px solid ${THEME.slate200}`,
                            borderRadius: 2,
                            px: 2.5,
                            py: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                          }}
                        >
                          <CircularProgress size={16} sx={{ color: THEME.accent }} />
                          <Typography sx={{ fontSize: '0.85rem', color: THEME.slate500 }}>
                            Searching the web and analyzing results...
                          </Typography>
                        </Paper>
                      </Box>
                    )}

                    <div ref={messagesEndRef} />
                  </Box>
                )}
              </Box>

              {/* Input bar */}
              <Box
                sx={{
                  borderTop: `1px solid ${THEME.slate200}`,
                  px: { xs: 2, md: 4 },
                  py: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ maxWidth: 900, mx: 'auto', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                  <TextField
                    ref={inputRef}
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder="Ask about companies, industries, contacts, or market trends..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2.5,
                        fontSize: '0.9rem',
                        bgcolor: THEME.slate50,
                        '& fieldset': { borderColor: THEME.slate200 },
                        '&:hover fieldset': { borderColor: THEME.slate300 },
                        '&.Mui-focused fieldset': { borderColor: THEME.accent },
                      },
                    }}
                  />
                  <IconButton
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    sx={{
                      bgcolor: THEME.accent,
                      color: '#fff',
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      '&:hover': { bgcolor: 'secondary.main' },
                      '&.Mui-disabled': { bgcolor: THEME.slate200, color: THEME.slate400 },
                    }}
                  >
                    <Send sx={{ fontSize: 20 }} />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Container>

        {/* Snackbar for save feedback */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            variant="filled"
            sx={{ borderRadius: 2 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Fade>
  );
};

export default DiscoveryPage;
