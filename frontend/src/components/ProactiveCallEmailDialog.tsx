import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoAwesomeIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EmailIcon from '@mui/icons-material/Email';

interface OutreachEmailDraft {
  subject: string;
  body: string;
  highlights: string[];
  valueProps: string[];
  agenda: string[];
  recipientEmails: string[];
}

interface ProactiveCallEmailDialogProps {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  meetingTitle: string;
  companyName: string;
  attendees: Array<{ name: string; email: string; company?: string }>;
  companyResearch?: any;
  isProactive?: boolean;
  onSend?: () => void;
}

const ProactiveCallEmailDialog: React.FC<ProactiveCallEmailDialogProps> = ({
  open,
  onClose,
  meetingId,
  meetingTitle,
  companyName,
  attendees,
  companyResearch,
  isProactive: initialIsProactive = false,
  onSend,
}) => {
  const [isProactive, setIsProactive] = useState(initialIsProactive);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<OutreachEmailDraft | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  // Fetch existing draft or proactive status on open
  useEffect(() => {
    if (open && meetingId) {
      fetchProactiveStatus();
      fetchExistingDraft();
    }
  }, [open, meetingId]);

  const fetchProactiveStatus = async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/is-proactive`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setIsProactive(data.data.isProactive);
      }
    } catch (err) {
      console.error('Failed to fetch proactive status:', err);
    }
  };

  const fetchExistingDraft = async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/outreach-email`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data) {
        setDraft(data.data);
        setEditedSubject(data.data.subject);
        setEditedBody(data.data.body);
      }
    } catch (err) {
      console.error('Failed to fetch existing draft:', err);
    }
  };

  const handleGenerateEmail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/generate-outreach-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          companyName,
          companyResearch,
          senderName: '', // Could be populated from user profile
        }),
      });
      const data = await response.json();
      if (data.success) {
        setDraft(data.data);
        setEditedSubject(data.data.subject);
        setEditedBody(data.data.body);
        setSuccess('Email draft generated successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to generate email');
      }
    } catch (err) {
      setError('Failed to generate email');
    } finally {
      setLoading(false);
    }
  }, [meetingId, companyName, companyResearch]);

  const handleToggleProactive = async (checked: boolean) => {
    setIsProactive(checked);
    try {
      await fetch(`/api/meetings/${meetingId}/proactive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isProactive: checked,
          proactiveCallType: checked ? 'outreach' : null,
        }),
      });
    } catch (err) {
      console.error('Failed to update proactive status:', err);
    }
  };

  const handleSendEmail = async () => {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/send-outreach-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customSubject: editedSubject !== draft?.subject ? editedSubject : undefined,
          customBody: editedBody !== draft?.body ? editedBody : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Email sent successfully!');
        onSend?.();
        setTimeout(() => {
          setSuccess(null);
          onClose();
        }, 2000);
      } else {
        setError(data.error || 'Failed to send email');
      }
    } catch (err) {
      setError('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const emailText = `Subject: ${editedSubject}\n\n${editedBody}`;
    try {
      await navigator.clipboard.writeText(emailText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const recipientCount = draft?.recipientEmails?.length || attendees.filter(a => a.email).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmailIcon color="primary" />
            <Typography variant="h6">Outreach Email Draft</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Proactive Toggle */}
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={isProactive}
                onChange={(e) => handleToggleProactive(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  Mark as Proactive Call
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Enable to draft an outreach email for this meeting
                </Typography>
              </Box>
            }
          />
        </Box>

        {/* Error/Success Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Meeting Context */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>
            Meeting: {meetingTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Company: {companyName}
          </Typography>
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {attendees.slice(0, 3).map((a, idx) => (
              <Chip key={idx} label={a.name} size="small" variant="outlined" />
            ))}
            {attendees.length > 3 && (
              <Chip label={`+${attendees.length - 3} more`} size="small" />
            )}
          </Box>
        </Paper>

        {/* Generate Button */}
        {!draft && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={handleGenerateEmail}
              disabled={loading || !isProactive}
              size="large"
            >
              {loading ? 'Generating...' : 'Generate Outreach Email'}
            </Button>
            {!isProactive && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Enable "Mark as Proactive Call" to generate an email
              </Typography>
            )}
          </Box>
        )}

        {/* Email Draft */}
        {draft && (
          <Box>
            {/* Subject */}
            <TextField
              fullWidth
              label="Subject"
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
              sx={{ mb: 2 }}
              variant="outlined"
            />

            {/* Body */}
            <TextField
              fullWidth
              label="Email Body"
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              multiline
              rows={8}
              sx={{ mb: 2 }}
              variant="outlined"
            />

            {/* Recipients */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Recipients ({recipientCount})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(draft.recipientEmails || attendees.filter(a => a.email).map(a => a.email)).map((email, idx) => (
                  <Chip key={idx} label={email} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Collapsible Details */}
            <Box
              sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
              onClick={() => setShowDetails(!showDetails)}
            >
              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                Preparation Notes
              </Typography>
              {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>

            <Collapse in={showDetails}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {/* Highlights */}
                <Paper variant="outlined" sx={{ flex: 1, minWidth: 200, p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <LightbulbIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                    <Typography variant="caption" fontWeight={600}>Company Highlights</Typography>
                  </Box>
                  <List dense disablePadding>
                    {draft.highlights.map((h, idx) => (
                      <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={h}
                          primaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>

                {/* Value Props */}
                <Paper variant="outlined" sx={{ flex: 1, minWidth: 200, p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="caption" fontWeight={600}>Value Propositions</Typography>
                  </Box>
                  <List dense disablePadding>
                    {draft.valueProps.map((v, idx) => (
                      <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <CheckCircleIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={v}
                          primaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>

                {/* Agenda */}
                <Paper variant="outlined" sx={{ flex: 1, minWidth: 200, p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <FormatListBulletedIcon sx={{ fontSize: 18, color: 'info.main' }} />
                    <Typography variant="caption" fontWeight={600}>Suggested Agenda</Typography>
                  </Box>
                  <List dense disablePadding>
                    {draft.agenda.map((a, idx) => (
                      <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <Typography variant="caption" color="text.secondary">{idx + 1}.</Typography>
                        </ListItemIcon>
                        <ListItemText
                          primary={a}
                          primaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Box>
            </Collapse>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {draft && (
          <>
            <Button
              variant="outlined"
              startIcon={loading ? <CircularProgress size={18} /> : <AutoAwesomeIcon />}
              onClick={handleGenerateEmail}
              disabled={loading}
            >
              Regenerate
            </Button>
            <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
              <Button
                variant="outlined"
                startIcon={copied ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                onClick={handleCopyToClipboard}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              onClick={handleSendEmail}
              disabled={sending || !editedSubject || !editedBody}
            >
              {sending ? 'Sending...' : 'Send via Outlook'}
            </Button>
          </>
        )}
        {!draft && (
          <Button onClick={onClose}>Close</Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ProactiveCallEmailDialog;
