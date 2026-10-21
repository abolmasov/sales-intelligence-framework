import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Collapse,
  Paper,
} from '@mui/material';
import {
  ThumbUp,
  ThumbDown,
  Send,
} from '@mui/icons-material';
import { apiPost } from '../utils/api';

export interface FeedbackWidgetProps {
  /** Category of the output (e.g. 'rfp_research', 'ppt_generation', 'account_research') */
  category: string;
  /** Optional reference ID for the specific output (e.g. jobId, sessionId) */
  referenceId?: string;
  /** Optional event ID to link feedback to a usage event */
  eventId?: string;
  /** Additional metadata to attach to the feedback */
  metadata?: Record<string, any>;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  category,
  referenceId,
  eventId,
  metadata,
}) => {
  const [rating, setRating] = useState<'like' | 'dislike' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiPost('/api/feedback', {
        rating,
        comment: comment || null,
        category,
        referenceId: referenceId || null,
        eventId: eventId || null,
        metadata: metadata || null,
      });
      if (response?.success) {
        setSubmitted(true);
      } else {
        setError('Failed to submit feedback. Please try again.');
      }
    } catch (err) {
      console.error('Feedback submission error:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [rating, comment, category, referenceId, eventId, metadata]);

  if (submitted) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mt: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(5, 150, 105, 0.04)',
        }}
      >
        <Alert
          severity="success"
          sx={{ bgcolor: 'transparent', p: 0, '& .MuiAlert-message': { p: 0 } }}
        >
          Thank you for your feedback!
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mt: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}
      >
        Was this output helpful?
      </Typography>

      <Stack spacing={1.5}>
        {/* Rating Buttons */}
        <Stack direction="row" spacing={1}>
          <Button
            variant={rating === 'like' ? 'contained' : 'outlined'}
            size="small"
            startIcon={<ThumbUp sx={{ fontSize: 16 }} />}
            onClick={() => setRating('like')}
            sx={{
              borderColor: rating === 'like' ? '#059669' : 'divider',
              bgcolor: rating === 'like' ? '#059669' : 'transparent',
              color: rating === 'like' ? '#fff' : 'text.secondary',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              px: 2,
              '&:hover': {
                bgcolor: rating === 'like' ? '#059669' : 'rgba(5, 150, 105, 0.08)',
                borderColor: '#059669',
              },
            }}
          >
            Good
          </Button>
          <Button
            variant={rating === 'dislike' ? 'contained' : 'outlined'}
            size="small"
            startIcon={<ThumbDown sx={{ fontSize: 16 }} />}
            onClick={() => setRating('dislike')}
            sx={{
              borderColor: rating === 'dislike' ? '#dc2626' : 'divider',
              bgcolor: rating === 'dislike' ? '#dc2626' : 'transparent',
              color: rating === 'dislike' ? '#fff' : 'text.secondary',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              px: 2,
              '&:hover': {
                bgcolor: rating === 'dislike' ? '#dc2626' : 'rgba(220, 38, 38, 0.08)',
                borderColor: '#dc2626',
              },
            }}
          >
            Bad
          </Button>
        </Stack>

        {/* Comment Field - appears after selecting rating */}
        <Collapse in={rating !== null}>
          <Stack spacing={1.5}>
            <TextField
              size="small"
              multiline
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any additional comments? (optional)"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.85rem',
                  '& fieldset': { borderColor: 'divider' },
                },
              }}
            />
            <Box>
              <Button
                variant="contained"
                size="small"
                onClick={handleSubmit}
                disabled={!rating || submitting}
                startIcon={
                  submitting ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <Send sx={{ fontSize: 14 }} />
                  )
                }
                sx={{
                  bgcolor: 'text.primary',
                  color: 'background.paper',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  px: 2,
                  '&:hover': { bgcolor: '#333' },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
                }}
              >
                {submitting ? 'Sending...' : 'Submit Feedback'}
              </Button>
            </Box>
          </Stack>
        </Collapse>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ borderRadius: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};

export default FeedbackWidget;
