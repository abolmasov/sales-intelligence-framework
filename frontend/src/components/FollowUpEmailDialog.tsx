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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EmailIcon from '@mui/icons-material/Email';
import { apiGet, apiPost } from '../utils/api';

interface FollowUpEmailDraft {
  subject: string;
  body: string;
  actionItems: string[];
  nextSteps: string[];
  recipientEmails: string[];
}

interface FollowUpEmailDialogProps {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  meetingTitle: string;
  companyName: string;
  attendees: Array<{ name: string; email: string; company?: string }>;
  onSend?: () => void;
}

const FollowUpEmailDialog: React.FC<FollowUpEmailDialogProps> = ({
  open,
  onClose,
  meetingId,
  meetingTitle,
  companyName,
  attendees,
  onSend,
}) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<FollowUpEmailDraft | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => {
    if (open && meetingId) {
      fetchExistingDraft();
    }
    // Reset state when dialog closes
    if (!open) {
      setError(null);
      setSuccess(null);
    }
  }, [open, meetingId]);

  const fetchExistingDraft = async () => {
    try {
      const response = await apiGet(`/api/meetings/${meetingId}/followup-email`);
      const data = response?.data ?? response;
      if (data?.success && data?.data) {
        setDraft(data.data);
        setEditedSubject(data.data.subject);
        setEditedBody(data.data.body);
      }
    } catch (err) {
      // No existing draft — that's fine
    }
  };

  const handleGenerateEmail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiPost(`/api/meetings/${meetingId}/generate-followup-email`, {
        companyName,
        senderName: '',
      });
      const data = response?.data ?? response;
      if (data?.success) {
        setDraft(data.data);
        setEditedSubject(data.data.subject);
        setEditedBody(data.data.body);
        setSuccess('Follow-up email generated successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data?.error || data?.message || 'Failed to generate email');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to generate email';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [meetingId, companyName]);

  const handleSendEmail = async () => {
    setSending(true);
    setError(null);
    try {
      const response = await apiPost(`/api/meetings/${meetingId}/send-followup-email`, {
        customSubject: editedSubject !== draft?.subject ? editedSubject : undefined,
        customBody: editedBody !== draft?.body ? editedBody : undefined,
      });
      const data = response?.data ?? response;
      if (data?.success) {
        setSuccess('Follow-up email sent successfully!');
        onSend?.();
        setTimeout(() => {
          setSuccess(null);
          onClose();
        }, 2000);
      } else {
        setError(data?.error || 'Failed to send email');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send email');
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
            <EmailIcon sx={{ color: 'success.main' }} />
            <Typography variant="h6">Post-Call Follow-Up Email</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
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
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
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
              disabled={loading}
              size="large"
              sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.main' } }}
            >
              {loading ? 'Generating from transcript analysis...' : 'Generate Follow-Up Email'}
            </Button>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Uses your transcript analysis to craft a personalized follow-up
            </Typography>
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
              rows={10}
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
                Meeting Recap Notes
              </Typography>
              {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>

            <Collapse in={showDetails}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {/* Action Items */}
                {draft.actionItems && draft.actionItems.length > 0 && (
                  <Paper variant="outlined" sx={{ flex: 1, minWidth: 250, p: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                      <Typography variant="caption" fontWeight={600}>Action Items</Typography>
                    </Box>
                    <List dense disablePadding>
                      {draft.actionItems.map((item, idx) => (
                        <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={item}
                            primaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}

                {/* Next Steps */}
                {draft.nextSteps && draft.nextSteps.length > 0 && (
                  <Paper variant="outlined" sx={{ flex: 1, minWidth: 250, p: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <ArrowForwardIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                      <Typography variant="caption" fontWeight={600}>Next Steps</Typography>
                    </Box>
                    <List dense disablePadding>
                      {draft.nextSteps.map((step, idx) => (
                        <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            <Typography variant="caption" color="text.secondary">{idx + 1}.</Typography>
                          </ListItemIcon>
                          <ListItemText
                            primary={step}
                            primaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
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
              sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.main' } }}
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

export default FollowUpEmailDialog;
