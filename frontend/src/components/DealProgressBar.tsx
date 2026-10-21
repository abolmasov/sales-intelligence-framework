import React from 'react';
import { Box, Typography, Tooltip, Stack } from '@mui/material';
import {
  Search as ProspectingIcon,
  CheckCircleOutline as QualificationIcon,
  Description as ProposalIcon,
  Handshake as NegotiationIcon,
  EmojiEvents as WonIcon,
  Cancel as LostIcon,
} from '@mui/icons-material';
import type { DealStage } from '../../../shared/types/deal';

interface DealProgressBarProps {
  stage: DealStage;
  compact?: boolean;
  onStageClick?: (stage: DealStage) => void;
}

const STAGES: Array<{
  value: DealStage;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  progress: number;
  color: string;
}> = [
  {
    value: 'prospecting',
    label: 'Prospecting',
    shortLabel: 'Prospect',
    icon: <ProspectingIcon sx={{ fontSize: 14 }} />,
    progress: 10,
    color: 'text.secondary',
  },
  {
    value: 'qualification',
    label: 'Qualification',
    shortLabel: 'Qualify',
    icon: <QualificationIcon sx={{ fontSize: 14 }} />,
    progress: 30,
    color: 'secondary.main',
  },
  {
    value: 'proposal_sent',
    label: 'Proposal Sent',
    shortLabel: 'Proposal',
    icon: <ProposalIcon sx={{ fontSize: 14 }} />,
    progress: 50,
    color: '#8b5cf6',
  },
  {
    value: 'negotiation',
    label: 'Negotiation',
    shortLabel: 'Negotiate',
    icon: <NegotiationIcon sx={{ fontSize: 14 }} />,
    progress: 75,
    color: 'warning.main',
  },
  {
    value: 'closed_won',
    label: 'Closed Won',
    shortLabel: 'Won',
    icon: <WonIcon sx={{ fontSize: 14 }} />,
    progress: 100,
    color: 'success.main',
  },
];

const LOST_STAGE = {
  value: 'closed_lost' as DealStage,
  label: 'Closed Lost',
  shortLabel: 'Lost',
  icon: <LostIcon sx={{ fontSize: 14 }} />,
  progress: 100,
  color: 'error.main',
};

const getStageIndex = (stage: DealStage): number => {
  if (stage === 'closed_lost') return -1;
  return STAGES.findIndex((s) => s.value === stage);
};

const DealProgressBar: React.FC<DealProgressBarProps> = ({
  stage,
  compact = false,
  onStageClick,
}) => {
  const currentStageIndex = getStageIndex(stage);
  const isLost = stage === 'closed_lost';
  const isWon = stage === 'closed_won';

  if (compact) {
    // Compact view: just dots
    return (
      <Stack direction="row" spacing={0.5} alignItems="center">
        {STAGES.map((s, idx) => {
          const isActive = idx === currentStageIndex;
          const isPast = idx < currentStageIndex;
          const stageColor = isLost ? LOST_STAGE.color : s.color;

          return (
            <Tooltip key={s.value} title={s.label} arrow placement="top">
              <Box
                onClick={() => onStageClick?.(s.value)}
                sx={{
                  width: isActive ? 24 : 8,
                  height: 8,
                  borderRadius: isActive ? 4 : '50%',
                  bgcolor: isActive || isPast
                    ? isLost ? LOST_STAGE.color : s.color
                    : 'rgba(0, 35, 72, 0.15)',
                  cursor: onStageClick ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '&:hover': onStageClick ? {
                    transform: 'scale(1.2)',
                    bgcolor: s.color,
                  } : {},
                }}
              >
                {isActive && (
                  <Box sx={{ color: '#fff', display: 'flex' }}>
                    {isLost ? LOST_STAGE.icon : s.icon}
                  </Box>
                )}
              </Box>
            </Tooltip>
          );
        })}
        {isLost && (
          <Tooltip title="Closed Lost" arrow placement="top">
            <Box
              sx={{
                width: 24,
                height: 8,
                borderRadius: 4,
                bgcolor: LOST_STAGE.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box sx={{ color: '#fff', display: 'flex' }}>
                {LOST_STAGE.icon}
              </Box>
            </Box>
          </Tooltip>
        )}
      </Stack>
    );
  }

  // Full view with labels
  return (
    <Box sx={{ width: '100%' }}>
      {/* Progress line */}
      <Box
        sx={{
          position: 'relative',
          height: 4,
          bgcolor: 'rgba(0, 35, 72, 0.1)',
          borderRadius: 2,
          mb: 1,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: isLost ? '100%' : `${((currentStageIndex + 1) / STAGES.length) * 100}%`,
            bgcolor: isLost ? LOST_STAGE.color : STAGES[currentStageIndex]?.color || '#64748b',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
      </Box>

      {/* Stage dots with labels */}
      <Stack direction="row" justifyContent="space-between" sx={{ px: 0.5 }}>
        {STAGES.map((s, idx) => {
          const isActive = idx === currentStageIndex;
          const isPast = idx < currentStageIndex;
          const isFuture = idx > currentStageIndex;

          return (
            <Tooltip key={s.value} title={s.label} arrow placement="top">
              <Stack
                alignItems="center"
                spacing={0.5}
                onClick={() => onStageClick?.(s.value)}
                sx={{
                  cursor: onStageClick ? 'pointer' : 'default',
                  opacity: isFuture && !isLost ? 0.4 : 1,
                  transition: 'all 0.2s ease',
                  '&:hover': onStageClick ? {
                    opacity: 1,
                    transform: 'translateY(-2px)',
                  } : {},
                }}
              >
                <Box
                  sx={{
                    width: isActive ? 28 : 20,
                    height: isActive ? 28 : 20,
                    borderRadius: '50%',
                    bgcolor: isActive || isPast
                      ? isLost ? LOST_STAGE.color : s.color
                      : 'rgba(0, 35, 72, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isActive || isPast ? '#fff' : 'rgba(0, 35, 72, 0.5)',
                    boxShadow: isActive ? `0 4px 12px ${isLost ? LOST_STAGE.color : s.color}40` : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isLost && idx === STAGES.length - 1 ? LOST_STAGE.icon : s.icon}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive
                      ? isLost ? LOST_STAGE.color : s.color
                      : isPast ? '#002348' : 'rgba(0, 35, 72, 0.5)',
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}
                >
                  {s.shortLabel}
                </Typography>
              </Stack>
            </Tooltip>
          );
        })}
      </Stack>

      {/* Lost indicator if applicable */}
      {isLost && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 1,
            color: LOST_STAGE.color,
            fontWeight: 600,
          }}
        >
          Deal Closed - Lost
        </Typography>
      )}
    </Box>
  );
};

export default DealProgressBar;
