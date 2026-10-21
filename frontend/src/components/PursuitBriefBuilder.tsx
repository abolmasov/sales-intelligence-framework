import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  Divider,
  Alert,
  Button,
  CircularProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Description,
  CheckCircle,
  Schedule,
  Edit,
  Refresh,
  ArrowForward,
  Save,
  Cancel,
} from '@mui/icons-material';
import { apiGet, apiPut } from '../utils/api';
import ReactMarkdown from 'react-markdown';

interface PursuitBriefBuilderProps {
  dealId: string;
}

interface PursuitBrief {
  id: string;
  deal_id: string;
  created_at: string;
  updated_at: string;
  status: string;
  completeness: number;
  content: string;
  linked_research_sessions: string[];
  linked_transcripts: string[];
  linked_case_studies?: string[];
}

const cardStyles = {
  bgcolor: '#FFFFFF',
  border: '1px solid rgba(0, 35, 72, 0.08)',
  borderRadius: 3,
  boxShadow: '0 18px 40px rgba(0, 35, 72, 0.08)',
};

const dividerColor = 'rgba(0, 35, 72, 0.12)';

const markdownPaperStyles = {
  bgcolor: '#F8FBFF',
  border: '1px solid rgba(0, 35, 72, 0.08)',
  borderRadius: 2,
};

const PursuitBriefBuilder: React.FC<PursuitBriefBuilderProps> = ({ dealId }) => {
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState<PursuitBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPursuitBrief();
  }, [dealId]);

  const fetchPursuitBrief = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet(`/api/pursuit-brief/deal/${dealId}`);

      if (data.success) {
        setBrief(data.data);
        setEditContent(data.data.content || '');
      } else {
        setError('Failed to load pursuit brief');
      }
    } catch (error) {
      console.error('Error fetching pursuit brief:', error);
      setError('Failed to load pursuit brief');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContent = async () => {
    if (!brief) return;

    try {
      setSaving(true);
      const data = await apiPut(`/api/pursuit-brief/${brief.id}/content`, {
        content: editContent,
      });

      if (data.success) {
        setBrief({
          ...brief,
          content: editContent,
          completeness: data.data.completeness,
          status: data.data.status,
        });
        setEditDialogOpen(false);
      }
    } catch (error) {
      console.error('Error saving pursuit brief:', error);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'in_progress':
        return 'warning';
      case 'ready_for_review':
        return 'info';
      case 'ready_for_proposal':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').toUpperCase();
  };

  if (loading) {
    return (
      <Card
        elevation={0}
        sx={cardStyles}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        elevation={0}
        sx={cardStyles}
      >
        <CardContent>
          <Alert severity="error">{error}</Alert>
          <Button
            startIcon={<Refresh />}
            onClick={fetchPursuitBrief}
            sx={{ mt: 2 }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!brief) {
    return (
      <Card
        elevation={0}
        sx={cardStyles}
      >
        <CardContent>
          <Alert severity="info">
            Pursuit brief will be automatically created when you run AI research on this deal.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card elevation={0} sx={cardStyles}>
        <CardContent>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                <Description /> Pursuit Brief
              </Typography>
              <Typography variant="caption" sx={{ color: '#5B6C8F' }}>
                Last updated: {new Date(brief.updated_at).toLocaleString()}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip
                label={getStatusLabel(brief.status)}
                color={getStatusColor(brief.status)}
                size="small"
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => setEditDialogOpen(true)}
              >
                Edit
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Refresh />}
                onClick={fetchPursuitBrief}
              >
                Refresh
              </Button>
            </Stack>
          </Box>

          {/* Completeness Progress */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Completeness
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {brief.completeness}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={brief.completeness}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(0, 35, 72, 0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: '#00A48C' },
              }}
            />
          </Box>

          {/* Linked Sources */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              Sources
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {brief.linked_research_sessions.length > 0 && (
                <Chip
                  icon={<CheckCircle />}
                  label={`${brief.linked_research_sessions.length} Research Session${brief.linked_research_sessions.length > 1 ? 's' : ''}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              {brief.linked_transcripts.length > 0 && (
                <Chip
                  icon={<CheckCircle />}
                  label={`${brief.linked_transcripts.length} Post-Call Analysis${brief.linked_transcripts.length > 1 ? 's' : ''}`}
                  size="small"
                  color="success"
                  variant="outlined"
                />
              )}
              {brief.linked_case_studies && brief.linked_case_studies.length > 0 && (
                <Chip
                  icon={<CheckCircle />}
                  label={`${brief.linked_case_studies.length} Case Stud${brief.linked_case_studies.length > 1 ? 'ies' : 'y'}`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
              )}
              {brief.linked_research_sessions.length === 0 && brief.linked_transcripts.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No sources linked yet. Run research or analyze meetings to populate this brief.
                </Typography>
              )}
            </Stack>
          </Box>

          <Divider sx={{ my: 3, borderColor: dividerColor }} />

          {/* Content */}
          {brief.content ? (
            <Paper
              sx={{
                ...markdownPaperStyles,
                p: 3,
                maxHeight: '600px',
                overflow: 'auto',
              }}
            >
              <ReactMarkdown
                components={{
                  h1: ({ children }: any) => (
                    <Typography variant="h4" gutterBottom fontWeight="bold" color="#002348">
                      {children}
                    </Typography>
                  ),
                  h2: ({ children }: any) => (
                    <Typography variant="h5" gutterBottom fontWeight="medium" color="#1A385E" sx={{ mt: 3 }}>
                      {children}
                    </Typography>
                  ),
                  h3: ({ children }: any) => (
                    <Typography variant="h6" gutterBottom color="#5B6C8F" sx={{ mt: 2 }}>
                      {children}
                    </Typography>
                  ),
                  p: ({ children }: any) => (
                    <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                      {children}
                    </Typography>
                  ),
                  ul: ({ children }: any) => (
                    <Box component="ul" sx={{ pl: 3, my: 1 }}>
                      {children}
                    </Box>
                  ),
                  li: ({ children }: any) => (
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                      {children}
                    </Typography>
                  ),
                  strong: ({ children }: any) => (
                    <Typography component="strong" fontWeight="bold" color="#005849">
                      {children}
                    </Typography>
                  ),
                  em: ({ children }: any) => (
                    <Typography component="em" fontStyle="italic" color="#5B6C8F">
                      {children}
                    </Typography>
                  ),
                  hr: () => <Divider sx={{ my: 2, borderColor: dividerColor }} />,
                }}
              >
                {brief.content}
              </ReactMarkdown>
            </Paper>
          ) : (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Description sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Pursuit Brief is Empty
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This brief will be automatically populated when you:
              </Typography>
              <Stack direction="column" spacing={1} sx={{ mt: 2, textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle fontSize="small" color="primary" />
                  <Typography variant="body2">Run AI research on the company</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle fontSize="small" color="success" />
                  <Typography variant="body2">Upload and analyze meeting transcripts</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Edit fontSize="small" color="action" />
                  <Typography variant="body2">Manually edit the content</Typography>
                </Box>
              </Stack>
            </Box>
          )}

          {/* Next Steps / Stage Navigation */}
          {brief.completeness >= 30 && (
            <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: dividerColor }}>
              <Alert
                severity="success"
                icon={<ArrowForward />}
                sx={{
                  bgcolor: 'rgba(0, 164, 140, 0.08)',
                  border: '1px solid rgba(0, 164, 140, 0.2)',
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Ready for Next Stage
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Your pursuit brief is progressing well. Continue to the next stage to gather more insights.
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  endIcon={<ArrowForward />}
                  onClick={() => {
                    // Navigate to post call analysis page
                    window.location.href = '/app/calendar';
                  }}
                  sx={{ mt: 1 }}
                >
                  Schedule Discovery Meeting
                </Button>
              </Alert>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !saving && setEditDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Edit Pursuit Brief</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={20}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Enter pursuit brief content in Markdown format..."
            sx={{ mt: 2 }}
            slotProps={{
              input: {
                style: { fontFamily: 'monospace', fontSize: '14px' },
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Supports Markdown formatting (headings, lists, bold, italic, etc.)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditDialogOpen(false)}
            startIcon={<Cancel />}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveContent}
            startIcon={saving ? <CircularProgress size={16} /> : <Save />}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PursuitBriefBuilder;
