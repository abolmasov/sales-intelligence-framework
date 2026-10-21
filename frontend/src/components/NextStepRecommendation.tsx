import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
} from '@mui/material';
import {
  Psychology as AIIcon,
  PlayArrow as StartIcon,
  Description as TranscriptIcon,
  Article as ProposalIcon,
  Slideshow as PptIcon,
  Link as LinkIcon,
  CheckCircle as DoneIcon,
} from '@mui/icons-material';
import type { CalendarMeeting } from '../types/calendarMeeting';

interface NextStepRecommendationProps {
  meeting: CalendarMeeting;
  isPastMeeting: boolean;
  hasAssociation: boolean;
  preCallComplete: boolean;
  preCallRunning: boolean;
  transcriptComplete: boolean;
  proposalComplete: boolean;
  pptComplete: boolean;
  analysisInProgress: boolean;
  transcriptAvailable: boolean;
  cancelAction?: React.ReactNode;
  onStartPreCall: () => void;
  onLinkDeal: () => void;
  onRunTranscript: () => void;
  onRunProposal: () => void;
  onRunPpt: () => void;
  onViewPreCall: () => void;
}

type NextStepType =
  | 'link_deal'
  | 'start_precall'
  | 'run_transcript'
  | 'run_proposal'
  | 'run_ppt'
  | 'all_done'
  | 'analysis_running'
  | 'missed_precall';

interface NextStep {
  type: NextStepType;
  title: string;
  description: string;
  buttonLabel: string;
  buttonIcon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

const getNextStep = (props: NextStepRecommendationProps): NextStep => {
  const {
    isPastMeeting,
    hasAssociation,
    preCallComplete,
    preCallRunning,
    transcriptComplete,
    proposalComplete,
    pptComplete,
    analysisInProgress,
    transcriptAvailable,
  } = props;

  // If analysis is running, show waiting state
  if (analysisInProgress || preCallRunning) {
    return {
      type: 'analysis_running',
      title: 'Analysis In Progress',
      description: 'Please wait while the AI processes your request. This typically takes 1-3 minutes.',
      buttonLabel: 'Running...',
      buttonIcon: <AIIcon />,
      color: '#0ea5e9',
      bgColor: 'rgba(14, 165, 233, 0.08)',
      borderColor: 'rgba(14, 165, 233, 0.3)',
    };
  }

  // All stages complete
  if (preCallComplete && transcriptComplete && proposalComplete && pptComplete) {
    return {
      type: 'all_done',
      title: 'All Stages Complete',
      description: 'Great work! All analysis stages have been completed for this meeting.',
      buttonLabel: 'View Results',
      buttonIcon: <DoneIcon />,
      color: 'success.main',
      bgColor: 'rgba(34, 197, 94, 0.08)',
      borderColor: 'rgba(34, 197, 94, 0.3)',
    };
  }

  // For upcoming meetings - recommend pre-call first
  if (!isPastMeeting && !preCallComplete) {
    return {
      type: 'start_precall',
      title: 'Start Pre-Call Research',
      description: 'Prepare for your meeting with AI-powered company research and discovery questions.',
      buttonLabel: 'Start Pre-Call',
      buttonIcon: <StartIcon />,
      color: 'secondary.main',
      bgColor: 'rgba(37, 99, 235, 0.08)',
      borderColor: 'rgba(37, 99, 235, 0.3)',
    };
  }

  // For past meetings without pre-call
  if (isPastMeeting && !preCallComplete && !transcriptComplete) {
    // Check if we need to link a deal first
    if (!hasAssociation) {
      return {
        type: 'link_deal',
        title: 'Link to a Deal',
        description: 'Connect this meeting to a deal to enable transcript analysis and proposal generation.',
        buttonLabel: 'Link Deal',
        buttonIcon: <LinkIcon />,
        color: 'warning.main',
        bgColor: 'rgba(245, 158, 11, 0.08)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
      };
    }

    // Recommend transcript analysis
    if (transcriptAvailable) {
      return {
        type: 'run_transcript',
        title: 'Analyze Meeting Transcript',
        description: 'Extract key insights, action items, and pain points from the meeting recording.',
        buttonLabel: 'Analyze Transcript',
        buttonIcon: <TranscriptIcon />,
        color: 'success.main',
        bgColor: 'rgba(22, 163, 74, 0.08)',
        borderColor: 'rgba(22, 163, 74, 0.3)',
      };
    } else {
      return {
        type: 'missed_precall',
        title: 'Upload Transcript',
        description: 'This meeting has passed. Upload a transcript to continue with analysis.',
        buttonLabel: 'Run Analysis',
        buttonIcon: <TranscriptIcon />,
        color: 'text.secondary',
        bgColor: 'rgba(100, 116, 139, 0.08)',
        borderColor: 'rgba(100, 116, 139, 0.3)',
      };
    }
  }

  // Need to link deal before proceeding
  if (!hasAssociation && (isPastMeeting || preCallComplete)) {
    return {
      type: 'link_deal',
      title: 'Link to a Deal',
      description: 'Connect this meeting to a deal to enable transcript analysis and proposal generation.',
      buttonLabel: 'Link Deal',
      buttonIcon: <LinkIcon />,
      color: 'warning.main',
      bgColor: 'rgba(245, 158, 11, 0.08)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
    };
  }

  // Transcript analysis is next
  if (!transcriptComplete) {
    return {
      type: 'run_transcript',
      title: 'Analyze Meeting Transcript',
      description: transcriptAvailable
        ? 'Extract key insights, action items, and pain points from the Teams recording.'
        : 'Upload a transcript to extract key insights, action items, and pain points.',
      buttonLabel: 'Run Transcript Analysis',
      buttonIcon: <TranscriptIcon />,
      color: 'success.main',
      bgColor: 'rgba(22, 163, 74, 0.08)',
      borderColor: 'rgba(22, 163, 74, 0.3)',
    };
  }

  // Proposal is next
  if (!proposalComplete) {
    return {
      type: 'run_proposal',
      title: 'Generate Solution Proposal',
      description: 'Create a tailored proposal based on the transcript insights and company research.',
      buttonLabel: 'Generate Proposal',
      buttonIcon: <ProposalIcon />,
      color: '#8b5cf6',
      bgColor: 'rgba(139, 92, 246, 0.08)',
      borderColor: 'rgba(139, 92, 246, 0.3)',
    };
  }

  // PPT is next
  if (!pptComplete) {
    return {
      type: 'run_ppt',
      title: 'Generate Presentation Deck',
      description: 'Create an executive-ready presentation deck from the solution proposal.',
      buttonLabel: 'Generate Deck',
      buttonIcon: <PptIcon />,
      color: '#ea580c',
      bgColor: 'rgba(234, 88, 12, 0.08)',
      borderColor: 'rgba(234, 88, 12, 0.3)',
    };
  }

  // Fallback - all done
  return {
    type: 'all_done',
    title: 'All Stages Complete',
    description: 'All analysis stages have been completed for this meeting.',
    buttonLabel: 'View Results',
    buttonIcon: <DoneIcon />,
    color: 'success.main',
    bgColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  };
};

const NextStepRecommendation: React.FC<NextStepRecommendationProps> = (props) => {
  const {
    analysisInProgress,
    preCallRunning,
    cancelAction,
    onStartPreCall,
    onLinkDeal,
    onRunTranscript,
    onRunProposal,
    onRunPpt,
  } = props;

  const nextStep = getNextStep(props);

  const handleAction = () => {
    switch (nextStep.type) {
      case 'start_precall':
        onStartPreCall();
        break;
      case 'link_deal':
        onLinkDeal();
        break;
      case 'run_transcript':
      case 'missed_precall':
        onRunTranscript();
        break;
      case 'run_proposal':
        onRunProposal();
        break;
      case 'run_ppt':
        onRunPpt();
        break;
      default:
        break;
    }
  };

  const isDisabled = analysisInProgress || preCallRunning || nextStep.type === 'analysis_running';
  const showPrimaryButton = nextStep.type !== 'all_done' && nextStep.type !== 'analysis_running';

  return (
    <Paper
      sx={{
        p: 2.5,
        background: nextStep.bgColor,
        border: `1px solid ${nextStep.borderColor}`,
        borderRadius: 2,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <AIIcon sx={{ color: nextStep.color, fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: nextStep.color }}>
              Recommended Next Step
            </Typography>
            {nextStep.type === 'all_done' && (
              <Chip
                label="Complete"
                size="small"
                sx={{
                  bgcolor: nextStep.color,
                  color: 'white',
                  fontWeight: 600,
                  height: 22,
                }}
              />
            )}
          </Stack>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
            {nextStep.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {nextStep.description}
          </Typography>
        </Box>
        {nextStep.type === 'analysis_running' ? (
          cancelAction || null
        ) : showPrimaryButton ? (
          <Button
            variant="contained"
            startIcon={nextStep.buttonIcon}
            onClick={handleAction}
            disabled={isDisabled}
            sx={{
              bgcolor: nextStep.color,
              '&:hover': {
                bgcolor: nextStep.color,
                filter: 'brightness(0.9)',
              },
              '&:disabled': {
                bgcolor: `${nextStep.color}66`,
                color: 'white',
              },
              minWidth: 160,
              fontWeight: 600,
            }}
          >
            {nextStep.buttonLabel}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
};

export default NextStepRecommendation;
