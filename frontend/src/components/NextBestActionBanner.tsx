import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Divider,
  Fade,
  IconButton,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import {
  AutoAwesome,
  RecordVoiceOver,
  Event,
  Description,
  TrendingUp,
  Close,
  ChevronRight,
} from '@mui/icons-material';
import { useNextBestActions, NextBestAction } from '../hooks/useNextBestActions';
import { runPostCallAnalysis, openProposalGenerator, runPreCallAnalysis } from '../utils/meetingActions';
import { COLORS } from '../styles/pageStyles';

const accentColorMap: Record<string, string> = {
  upcoming_no_prep: COLORS.warning,
  transcript_ready: COLORS.info,
  completed_no_analysis: COLORS.gray500,
  analyzed_no_proposal: COLORS.accent,
  deal_at_risk: COLORS.error,
};

const iconMap: Record<string, React.ReactNode> = {
  precall: <AutoAwesome />,
  transcript: <RecordVoiceOver />,
  meeting: <Event />,
  proposal: <Description />,
  deal: <TrendingUp />,
};

const NextBestActionBanner: React.FC = () => {
  const navigate = useNavigate();
  const { actions, isEmpty, dismiss, dismissAll } = useNextBestActions();

  if (isEmpty) return null;

  const handleCta = (action: NextBestAction) => {
    switch (action.type) {
      case 'upcoming_no_prep':
        if (action.meeting) {
          runPreCallAnalysis(action.meeting, navigate);
        }
        break;
      case 'transcript_ready':
        if (action.meeting) {
          runPostCallAnalysis(action.meeting, { navigate });
        }
        break;
      case 'completed_no_analysis':
        if (action.meeting) {
          runPostCallAnalysis(action.meeting, { navigate });
        }
        break;
      case 'analyzed_no_proposal':
        if (action.meeting) {
          openProposalGenerator(action.meeting, navigate);
        }
        break;
      case 'deal_at_risk':
        if (action.dealId) {
          navigate(`/app/deals`);
        }
        break;
    }
  };

  return (
    <Fade in timeout={300}>
      <Box
        sx={{
          mb: 3,
          borderRadius: 2,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: 'background.default',
            borderBottom: `1px solid ${COLORS.gray200}`,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: 'text.secondary',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Suggested Actions
            </Typography>
            {actions.length > 1 && (
              <Button
                size="small"
                onClick={dismissAll}
                sx={{
                  fontSize: '0.75rem',
                  color: 'text.disabled',
                  textTransform: 'none',
                  '&:hover': { color: 'text.secondary' },
                }}
              >
                Dismiss all
              </Button>
            )}
          </Stack>
        </Box>

        {/* Action Rows */}
        {actions.map((action, idx) => {
          const accentColor = accentColorMap[action.type] || COLORS.gray400;
          return (
            <React.Fragment key={action.id}>
              {idx > 0 && <Divider />}
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  borderLeft: `3px solid ${accentColor}`,
                  '&:hover': { bgcolor: 'background.default' },
                  transition: 'background-color 0.15s',
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  {/* Icon */}
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      bgcolor: alpha(accentColor, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      '& svg': { fontSize: 18, color: accentColor },
                    }}
                  >
                    {iconMap[action.iconType]}
                  </Box>

                  {/* Text */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, color: 'text.primary' }}
                      noWrap
                    >
                      {action.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                      {action.description}
                    </Typography>
                  </Box>

                  {/* CTA */}
                  <Button
                    size="small"
                    variant="text"
                    endIcon={<ChevronRight sx={{ fontSize: 16 }} />}
                    onClick={() => handleCta(action)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      color: accentColor,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {action.ctaLabel}
                  </Button>

                  {/* Dismiss */}
                  <IconButton
                    size="small"
                    onClick={() => dismiss(action.id)}
                    sx={{
                      color: COLORS.gray300,
                      flexShrink: 0,
                      '&:hover': { color: 'text.secondary' },
                    }}
                  >
                    <Close sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              </Box>
            </React.Fragment>
          );
        })}
      </Box>
    </Fade>
  );
};

export default NextBestActionBanner;
