/**
 * AI Chat Assistant Component
 * Enhanced chat interface with action execution, context awareness, draggable panel,
 * and chain-of-thought reasoning display
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  Stack,
  Avatar,
  Chip,
  CircularProgress,
  Fab,
  Zoom,
  InputAdornment,
  Tooltip,
  alpha,
  Collapse,
} from '@mui/material';
import {
  SmartToy,
  Send,
  Close,
  Search,
  Description,
  Refresh,
  ContentCopy,
  Check,
  OpenInFull,
  CloseFullscreen,
  ChevronRight,
  Place,
  HelpOutline,
  Psychology,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../utils/api';
import ReactMarkdown from 'react-markdown';
import { useAppShell } from '../context/AppShellContext';
import { useAppContext, getMinimalContext, getContextSuggestions } from '../hooks/useAppContext';
import {
  EnhancedMessage,
  EnhancedChatResponse,
  AIAction,
  ChatPanelSize,
  DataPreview,
  ThinkingStep,
  ChatWidget,
  AgentStatusWidget,
} from '../types/aiChat';
import { createActionExecutor } from '../services/aiActionExecutor';
import { ActionCard } from './chat/ActionCard';
import { CapabilitiesPanel, QuickCapabilities } from './chat/CapabilitiesPanel';
import ChatWidgetRenderer from './chat/ChatWidgetRenderer';
import QuickReplies from './chat/widgets/QuickReplies';
import AgentProgressWidget from './chat/widgets/AgentProgressWidget';
import { useDealStore } from '../store/dealStore';
import { useAccountsStore } from '../store/accountsStore';
import { useMeetingStore } from '../store/meetingStore';

// Panel size configurations
const PANEL_SIZES: Record<ChatPanelSize, number> = {
  collapsed: 0,
  normal: 420,
  expanded: 600,
  fullscreen: -1, // Special case - full width
};

// Panel dimension constraints
const MIN_WIDTH = 380;
const MAX_WIDTH = 900;

// Storage key for preferences
const CHAT_PREFS_KEY = 'ai_chat_preferences';

const AIChatAssistant: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<EnhancedMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [panelSize, setPanelSize] = useState<ChatPanelSize>('normal');
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // Draggable panel state
  const [panelWidth, setPanelWidth] = useState(PANEL_SIZES.normal);
  const [isResizing, setIsResizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Hooks
  const navigate = useNavigate();
  const appShell = useAppShell();
  const appContext = useAppContext();

  // Stores for action executor
  const dealStore = useDealStore();
  const accountsStore = useAccountsStore();
  const meetingStore = useMeetingStore();

  // Create action executor
  const actionExecutor = useMemo(() => {
    return createActionExecutor(
      navigate,
      appShell,
      {
        deals: dealStore as any,
        accounts: accountsStore as any,
        meetings: meetingStore as any,
      },
      {
        onActionStart: (action) => setExecutingAction(action.id),
        onActionComplete: () => setExecutingAction(null),
      }
    );
  }, [navigate, appShell, dealStore, accountsStore, meetingStore]);

  // Load preferences
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHAT_PREFS_KEY);
      if (stored) {
        const prefs = JSON.parse(stored);
        if (prefs.panelSize) setPanelSize(prefs.panelSize);
        if (prefs.showCapabilities !== undefined) setShowCapabilities(prefs.showCapabilities);
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Save preferences
  useEffect(() => {
    try {
      localStorage.setItem(
        CHAT_PREFS_KEY,
        JSON.stringify({ panelSize, showCapabilities })
      );
    } catch {
      // Ignore errors
    }
  }, [panelSize, showCapabilities]);

  // Calculate drawer width
  const drawerWidth = useMemo(() => {
    if (panelSize === 'fullscreen') return '100vw';
    return panelWidth;
  }, [panelSize, panelWidth]);

  // Handle resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Handle sending a message
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: EnhancedMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Call AI assistant endpoint with context
      const response = await apiPost('/api/ai-assistant/chat', {
        message: userMessage.content,
        history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        context: getMinimalContext(appContext),
      });

      const data: EnhancedChatResponse = response?.data || response;

      const assistantMessage: EnhancedMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data?.response || "I couldn't process that request. Please try again.",
        timestamp: new Date(),
        actions: data?.actions,
        dataPreview: data?.dataPreview,
        navigationHint: data?.navigationHint,
        sources: data?.sources,
        thinking: data?.thinking,
        widgets: data?.widgets as ChatWidget[] | undefined,
        quickReplies: data?.quickReplies,
        agentStatus: data?.agentStatus as AgentStatusWidget | undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Chat error:', error);

      // Fallback response
      const fallbackMessage: EnhancedMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateFallbackResponse(userMessage.content),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Generate a helpful fallback response
  const generateFallbackResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('case stud')) {
      return "To find case studies, I recommend checking:\n\n1. **InternalKnowledge** - Search for case studies in the internal knowledge base\n2. **Analysis Page** - Run research on a company to see related case studies\n3. **RFP Research** - Upload an RFP to find relevant case studies automatically\n\nWould you like me to help you navigate to one of these?";
    }

    if (lowerQuery.includes('meeting') || lowerQuery.includes('calendar')) {
      return "For meeting information:\n\n1. Check the **Calendar** page for upcoming meetings\n2. Click on any meeting to see full details and run pre-call research\n3. Use the **Analysis** page for deep company research\n\nIs there a specific meeting you're looking for?";
    }

    if (lowerQuery.includes('deal') || lowerQuery.includes('pipeline')) {
      return "For deal and pipeline information:\n\n1. Visit the **Deals** page to see your full pipeline\n2. Filter by stage, date, or account\n3. Click any deal for detailed information\n\nWhat specific deal information do you need?";
    }

    if (lowerQuery.includes('company') || lowerQuery.includes('research')) {
      return "To research a company:\n\n1. Go to the **Analysis** page\n2. Enter the company name and any meeting context\n3. Our AI will gather intelligence from multiple sources including InternalKnowledge\n\nWhat company would you like to research?";
    }

    return "I can help you with:\n\n- **Company research** - Deep intelligence on any company\n- **Meeting prep** - Pre-call research and questions\n- **Case studies** - Find relevant past engagements\n- **Deal insights** - Pipeline and opportunity info\n- **RFP analysis** - Answer RFP questions automatically\n\nWhat would you like to know more about?";
  };

  // Handle keyboard input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle suggested question click
  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Programmatically send a text message (used by quick replies and widgets)
  const handleSendText = useCallback((text: string) => {
    setInput(text);
    // Use a short timeout to ensure state is set, then trigger send
    setTimeout(() => {
      setInput('');
      const userMessage: EnhancedMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      apiPost('/api/ai-assistant/chat', {
        message: text,
        history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        context: getMinimalContext(appContext),
      })
        .then((response) => {
          const data: EnhancedChatResponse = response?.data || response;
          const assistantMessage: EnhancedMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data?.response || "I couldn't process that request.",
            timestamp: new Date(),
            actions: data?.actions,
            dataPreview: data?.dataPreview,
            sources: data?.sources,
            thinking: data?.thinking,
            widgets: data?.widgets as ChatWidget[] | undefined,
            quickReplies: data?.quickReplies,
            agentStatus: data?.agentStatus as AgentStatusWidget | undefined,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'assistant' as const,
              content: 'Sorry, something went wrong. Please try again.',
              timestamp: new Date(),
            },
          ]);
        })
        .finally(() => setLoading(false));
    }, 0);
  }, [messages, appContext]);

  // Handle copying message content
  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Handle action execution
  const handleExecuteAction = useCallback(
    async (action: AIAction) => {
      await actionExecutor.execute(action);
      // Close panel after navigation actions
      if (action.type === 'navigate') {
        setTimeout(() => setOpen(false), 300);
      }
    },
    [actionExecutor]
  );

  // Clear chat
  const clearChat = () => {
    setMessages([]);
  };

  // Toggle panel size
  const togglePanelSize = () => {
    const sizes: ChatPanelSize[] = ['normal', 'expanded', 'fullscreen'];
    const currentIdx = sizes.indexOf(panelSize);
    const nextIdx = (currentIdx + 1) % sizes.length;
    const newSize = sizes[nextIdx];
    setPanelSize(newSize);
    if (newSize !== 'fullscreen') {
      setPanelWidth(PANEL_SIZES[newSize]);
    }
  };

  // Shrink panel
  const shrinkPanel = () => {
    if (panelSize === 'fullscreen') {
      setPanelSize('expanded');
      setPanelWidth(PANEL_SIZES.expanded);
    } else if (panelSize === 'expanded') {
      setPanelSize('normal');
      setPanelWidth(PANEL_SIZES.normal);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Zoom in={!open}>
        <Fab
          color="primary"
          onClick={onOpen}
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            bgcolor: 'text.primary',
            '&:hover': { opacity: 0.85 },
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          <SmartToy />
        </Fab>
      </Zoom>

      {/* Chat Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: drawerWidth,
            maxWidth: '100vw',
            bgcolor: 'background.default',
            transition: isResizing ? 'none' : 'width 0.2s ease',
          },
        }}
      >
        {/* Resize Handle */}
        {panelSize !== 'fullscreen' && (
          <Box
            ref={resizeRef}
            onMouseDown={handleResizeStart}
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 6,
              cursor: 'ew-resize',
              bgcolor: isResizing ? 'action.selected' : 'transparent',
              '&:hover': {
                bgcolor: 'action.hover',
              },
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                width: 3,
                height: 40,
                borderRadius: 1,
                bgcolor: isResizing ? 'text.disabled' : 'divider',
                transition: 'background-color 0.15s',
              }}
            />
          </Box>
        )}
        {/* Header */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderBottom: 1, borderColor: 'divider',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: 'action.hover', color: 'text.secondary', width: 32, height: 32 }}>
                <SmartToy sx={{ fontSize: 18 }} />
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight={600} color="#171717">
                  AI Assistant
                </Typography>
                <Typography variant="caption" color="#737373">
                  Ask anything
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={0.5}>
              {/* Panel size controls */}
              {panelSize !== 'normal' && (
                <Tooltip title="Shrink">
                  <IconButton size="small" onClick={shrinkPanel} sx={{ color: 'text.disabled' }}>
                    <ChevronRight fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={panelSize === 'fullscreen' ? 'Exit fullscreen' : 'Expand'}>
                <IconButton size="small" onClick={togglePanelSize} sx={{ color: 'text.disabled' }}>
                  {panelSize === 'fullscreen' ? (
                    <CloseFullscreen fontSize="small" />
                  ) : (
                    <OpenInFull fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>

              <Tooltip title="What can I do?">
                <IconButton
                  size="small"
                  onClick={() => setShowCapabilities(!showCapabilities)}
                  sx={{ color: showCapabilities ? 'text.primary' : 'text.disabled' }}
                >
                  <HelpOutline fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Clear chat">
                <IconButton size="small" onClick={clearChat} sx={{ color: 'text.disabled' }}>
                  <Refresh fontSize="small" />
                </IconButton>
              </Tooltip>

              <IconButton size="small" onClick={onClose} sx={{ color: 'text.disabled' }}>
                <Close fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          {/* Context indicator */}
          {appContext.hasSelectedRecord && (
            <Chip
              size="small"
              icon={<Place sx={{ fontSize: 12 }} />}
              label={appContext.contextSummary}
              sx={{
                mt: 1,
                height: 20,
                fontSize: '0.7rem',
                bgcolor: 'action.hover',
                color: 'text.secondary',
                '& .MuiChip-icon': { color: 'text.disabled' },
              }}
            />
          )}
        </Box>

        {/* Messages Area */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {/* Capabilities Panel */}
          {showCapabilities && (
            <Box sx={{ mb: 2 }}>
              <CapabilitiesPanel
                expanded={showCapabilities}
                onToggle={() => setShowCapabilities(!showCapabilities)}
                onExampleClick={handleSuggestedQuestion}
              />
            </Box>
          )}

          {messages.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <SmartToy sx={{ fontSize: 48, color: 'divider', mb: 2 }} />
              <Typography variant="body1" color="#525252" fontWeight={500} gutterBottom>
                How can I help?
              </Typography>
              <Typography variant="body2" color="#737373" sx={{ mb: 3 }}>
                Research companies, prepare for calls, manage deals, or navigate the app
              </Typography>

              {/* Context-aware suggestions based on current page */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" fontWeight={600} color="#525252" sx={{ mb: 1, display: 'block' }}>
                  {appContext.hasSelectedRecord
                    ? `Suggestions for ${appContext.selectedRecord?.name}`
                    : `Quick actions for ${appContext.pageName}`}
                </Typography>
                <Stack spacing={1}>
                  {getContextSuggestions(appContext.currentPage, appContext.selectedRecord).map((suggestion, idx) => (
                    <Chip
                      key={idx}
                      label={suggestion}
                      size="small"
                      onClick={() => handleSuggestedQuestion(suggestion)}
                      sx={{
                        height: 'auto',
                        py: 0.5,
                        fontSize: '0.75rem',
                        bgcolor: 'background.paper',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        '& .MuiChip-label': {
                          whiteSpace: 'normal',
                        },
                        '&:hover': {
                          bgcolor: 'action.hover',
                          borderColor: 'divider',
                        },
                      }}
                    />
                  ))}
                </Stack>
              </Box>

              <QuickCapabilities onExampleClick={handleSuggestedQuestion} />
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {messages.map((message) => (
                <React.Fragment key={message.id}>
                  <MessageBubble
                    message={message}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                    onExecuteAction={handleExecuteAction}
                    executingAction={executingAction}
                    onSendMessage={handleSendText}
                  />
                  {/* Quick Replies (rendered outside the bubble) */}
                  {message.role === 'assistant' && message.quickReplies && message.quickReplies.length > 0 && (
                    <Box sx={{ pl: 0.5 }}>
                      <QuickReplies replies={message.quickReplies} onReplyClick={handleSendText} />
                    </Box>
                  )}
                </React.Fragment>
              ))}

              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                      borderColor: 'divider',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={14} sx={{ color: 'text.disabled' }} />
                      <Typography variant="body2" color="#737373">
                        Thinking...
                      </Typography>
                    </Stack>
                  </Paper>
                </Box>
              )}

              <div ref={messagesEndRef} />
            </Stack>
          )}
        </Box>

        {/* Input Area */}
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            multiline
            maxRows={3}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    sx={{ color: input.trim() ? 'text.primary' : 'divider' }}
                  >
                    <Send fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                borderRadius: 1.5,
                bgcolor: 'background.default',
                fontSize: '0.875rem',
              },
            }}
          />
        </Box>
      </Drawer>
    </>
  );
};

// Thinking Steps component for chain-of-thought display
interface ThinkingStepsProps {
  thinking: ThinkingStep[];
}

const ThinkingSteps: React.FC<ThinkingStepsProps> = ({ thinking }) => {
  const [expanded, setExpanded] = useState(false);

  if (!thinking || thinking.length === 0) return null;

  return (
    <Box sx={{ mb: 1 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          py: 0.5,
          px: 1,
          borderRadius: 1,
          bgcolor: alpha('#8b5cf6', 0.08),
          '&:hover': { bgcolor: alpha('#8b5cf6', 0.12) },
        }}
      >
        <Psychology sx={{ fontSize: 14, color: '#8b5cf6' }} />
        <Typography variant="caption" sx={{ color: '#6b21a8', fontWeight: 500, flex: 1 }}>
          Reasoning ({thinking.length} steps)
        </Typography>
        {expanded ? (
          <ExpandLess sx={{ fontSize: 16, color: '#8b5cf6' }} />
        ) : (
          <ExpandMore sx={{ fontSize: 16, color: '#8b5cf6' }} />
        )}
      </Box>

      <Collapse in={expanded}>
        <Stack spacing={0.5} sx={{ mt: 1, pl: 1, borderLeft: '2px solid', borderColor: alpha('#8b5cf6', 0.3) }}>
          {thinking.map((step) => (
            <Box key={step.step} sx={{ pl: 1 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Chip
                  label={step.step}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.65rem',
                    bgcolor: '#8b5cf6',
                    color: 'white',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {step.action || 'Thinking'}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.25 }}>
                {step.thought}
              </Typography>
              {step.observation && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'success.main',
                    display: 'block',
                    mt: 0.25,
                    fontStyle: 'italic',
                  }}
                >
                  {step.observation}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
};

// Message bubble component
interface MessageBubbleProps {
  message: EnhancedMessage;
  copiedId: string | null;
  onCopy: (content: string, id: string) => void;
  onExecuteAction: (action: AIAction) => void;
  executingAction: string | null;
  onSendMessage?: (text: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  copiedId,
  onCopy,
  onExecuteAction,
  executingAction,
  onSendMessage,
}) => {
  const isUser = message.role === 'user';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          maxWidth: '85%',
          borderRadius: 1.5,
          bgcolor: isUser ? 'primary.main' : 'background.paper',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          border: !isUser ? 1 : 'none',
          borderColor: !isUser ? 'divider' : undefined,
        }}
      >
        {!isUser && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="caption" fontWeight={500} color="#737373">
              Assistant
            </Typography>
            <Box sx={{ flex: 1 }} />
            <IconButton
              size="small"
              onClick={() => onCopy(message.content, message.id)}
              sx={{ p: 0.25 }}
            >
              {copiedId === message.id ? (
                <Check sx={{ fontSize: 12, color: 'success.main' }} />
              ) : (
                <ContentCopy sx={{ fontSize: 12, color: 'text.disabled' }} />
              )}
            </IconButton>
          </Stack>
        )}

        {/* Chain-of-thought reasoning */}
        {!isUser && message.thinking && message.thinking.length > 0 && (
          <ThinkingSteps thinking={message.thinking} />
        )}

        {/* Message content */}
        <Box
          sx={{
            fontSize: '0.875rem',
            lineHeight: 1.5,
            '& p': { m: 0, mb: 0.75 },
            '& p:last-child': { mb: 0 },
            '& ul, & ol': { m: 0, pl: 2.5, mb: 0.75 },
            '& li': { mb: 0.25 },
            '& strong': { fontWeight: 600 },
            '& code': {
              bgcolor: isUser ? 'rgba(255,255,255,0.15)' : 'action.hover',
              px: 0.5,
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
            },
          }}
        >
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </Box>

        {/* Data Preview */}
        {message.dataPreview && (
          <DataPreviewCard preview={message.dataPreview} />
        )}

        {/* Action Cards */}
        {message.actions && message.actions.length > 0 && (
          <ActionCard
            actions={message.actions}
            onExecute={onExecuteAction}
            disabled={!!executingAction}
          />
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <Box sx={{ mt: 1.5, pt: 1, borderTop: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
            <Typography variant="caption" fontWeight={500} color="#737373" sx={{ fontSize: '0.7rem' }}>
              Sources
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {message.sources.map((source, idx) => (
                <Chip
                  key={idx}
                  size="small"
                  label={source.title}
                  icon={source.type === 'internal-kb' ? <Search sx={{ fontSize: 12 }} /> : <Description sx={{ fontSize: 12 }} />}
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                    '& .MuiChip-icon': { color: 'text.disabled' },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Inline Widgets */}
        {message.widgets && message.widgets.length > 0 && (
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {message.widgets.map((widget) => (
              <ChatWidgetRenderer
                key={widget.id}
                widget={widget}
                onFormSubmit={(formId, values) => onSendMessage?.(`[Form: ${formId}] ${JSON.stringify(values)}`)}
                onAgentStart={(agentId) => onSendMessage?.(`Run the ${agentId} agent`)}
                onApprove={(approvalId) => onSendMessage?.(`Approved: ${approvalId}`)}
                onReject={(approvalId) => onSendMessage?.(`Rejected: ${approvalId}`)}
                onAction={onExecuteAction}
              />
            ))}
          </Stack>
        )}

        {/* Agent Progress */}
        {message.agentStatus && (
          <Box sx={{ mt: 1.5 }}>
            <AgentProgressWidget status={message.agentStatus} />
          </Box>
        )}

        {/* Timestamp */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.75,
            fontSize: '0.65rem',
            color: isUser ? 'rgba(255,255,255,0.6)' : 'text.disabled',
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </Paper>
    </Box>
  );
};

// Data preview card component
interface DataPreviewCardProps {
  preview: DataPreview;
}

const DataPreviewCard: React.FC<DataPreviewCardProps> = ({ preview }) => {
  const isArray = Array.isArray(preview.data);
  const items: Record<string, any>[] = isArray ? preview.data.slice(0, 3) : [preview.data];

  return (
    <Box sx={{ mt: 2 }}>
      {preview.title && (
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          {preview.title}
        </Typography>
      )}

      <Stack spacing={1}>
        {items.map((item, idx) => (
          <Paper
            key={idx}
            elevation={0}
            sx={{
              p: 1.5,
              bgcolor: alpha('#00A48C', 0.05),
              border: 1,
              borderColor: alpha('#00A48C', 0.2),
              borderRadius: 1,
            }}
          >
            {preview.type === 'deal' && (
              <Stack spacing={0.5}>
                <Typography variant="body2" fontWeight={600}>
                  {item.name || item.opportunityName}
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Typography variant="caption" color="text.secondary">
                    Stage: {item.stage}
                  </Typography>
                  {item.value && (
                    <Typography variant="caption" color="text.secondary">
                      Value: ${item.value?.toLocaleString()}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            )}

            {preview.type === 'meeting' && (
              <Stack spacing={0.5}>
                <Typography variant="body2" fontWeight={600}>
                  {item.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.date} • {item.attendees?.length || 0} attendees
                </Typography>
              </Stack>
            )}

            {preview.type === 'account' && (
              <Stack spacing={0.5}>
                <Typography variant="body2" fontWeight={600}>
                  {item.name || item.companyName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.industry} {item.revenue && `• Revenue: $${item.revenue.toLocaleString()}`}
                </Typography>
              </Stack>
            )}

            {(preview.type === 'meetings_list' || preview.type === 'deals_list') && (
              <Typography variant="body2">{item.name || item.title}</Typography>
            )}

            {preview.type === 'metrics' && (
              <Stack direction="row" spacing={2}>
                {Object.entries(item).map(([key, value]) => (
                  <Box key={key}>
                    <Typography variant="caption" color="text.secondary">
                      {key}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {String(value)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        ))}
      </Stack>

      {isArray && preview.data.length > 3 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          +{preview.data.length - 3} more...
        </Typography>
      )}
    </Box>
  );
};

export default AIChatAssistant;
