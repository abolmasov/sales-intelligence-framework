import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import { AccountMeeting } from '../../../shared/types/account';

type PipelineStatus = 'pending' | 'ready' | 'running' | 'completed' | 'error';

interface MeetingPipelineRowProps {
  meeting: AccountMeeting;
  onRunPreCall: () => void;
  onRunPostCall: () => void;
  onGenerateProposal: () => void;
  onGeneratePptx: () => void;
  onSetupContext: () => void;
  onViewMeeting?: () => void;
  compact?: boolean;
}

const getStepStatus = (
  done: boolean | undefined,
  jobStatus?: string | null
): PipelineStatus => {
  if (done) return 'completed';
  if (jobStatus === 'processing' || jobStatus === 'pending') return 'running';
  return 'pending';
};

interface PipelineStepProps {
  label: string;
  status: PipelineStatus;
  onAction: () => void;
  actionLabel: string;
  disabled: boolean;
  downloadUrl?: string | null;
  compact?: boolean;
}

const PipelineStep: React.FC<PipelineStepProps> = ({
  label,
  status,
  onAction,
  actionLabel,
  disabled,
  downloadUrl,
  compact = false,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: compact ? 60 : 80,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 0.5, fontSize: compact ? '0.65rem' : '0.75rem' }}
      >
        {label}
      </Typography>

      {status === 'running' ? (
        <Chip
          size="small"
          icon={<CircularProgress size={12} />}
          label="Running"
          color="info"
          variant="outlined"
          sx={{ height: compact ? 24 : 28 }}
        />
      ) : status === 'completed' ? (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip
            size="small"
            icon={<CheckCircleIcon />}
            label="Done"
            color="success"
            variant="outlined"
            sx={{ height: compact ? 24 : 28 }}
          />
          {downloadUrl && (
            <Tooltip title="Download">
              <IconButton
                size="small"
                href={downloadUrl}
                target="_blank"
                sx={{ p: 0.5 }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ) : (
        <Button
          size="small"
          variant="outlined"
          disabled={disabled}
          onClick={onAction}
          startIcon={<PlayArrowIcon />}
          sx={{
            minWidth: compact ? 50 : 65,
            height: compact ? 24 : 28,
            fontSize: compact ? '0.65rem' : '0.75rem',
            px: 1,
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

export const MeetingPipelineRow: React.FC<MeetingPipelineRowProps> = ({
  meeting,
  onRunPreCall,
  onRunPostCall,
  onGenerateProposal,
  onGeneratePptx,
  onSetupContext,
  onViewMeeting,
  compact = false,
}) => {
  const needsContext = !meeting.deal_id;
  const analysisJob = meeting.analysis_job;

  // Determine status for each step
  const preCallStatus = getStepStatus(meeting.pre_call_done);
  const postCallStatus = getStepStatus(
    meeting.post_call_done,
    analysisJob?.transcript_status
  );
  const proposalStatus = getStepStatus(
    meeting.proposal_generated,
    analysisJob?.proposal_status
  );
  const pptxStatus = getStepStatus(
    !!analysisJob?.ppt_download_url,
    analysisJob?.ppt_status
  );

  // Determine if steps are actionable
  const canRunPostCall = meeting.pre_call_done && !meeting.post_call_done;
  const canGenerateProposal = meeting.post_call_done && !meeting.proposal_generated;
  const canGeneratePptx = meeting.proposal_generated && !analysisJob?.ppt_download_url;

  const pipelineSteps = [
    {
      key: 'pre_call',
      label: 'Pre-Call',
      status: preCallStatus,
      action: onRunPreCall,
      actionLabel: 'Run',
      disabled: needsContext,
    },
    {
      key: 'post_call',
      label: 'Post-Call',
      status: postCallStatus,
      action: onRunPostCall,
      actionLabel: 'Run',
      disabled: !canRunPostCall,
    },
    {
      key: 'proposal',
      label: 'Proposal',
      status: proposalStatus,
      action: onGenerateProposal,
      actionLabel: 'Gen',
      disabled: !canGenerateProposal,
    },
    {
      key: 'pptx',
      label: 'PPTX',
      status: pptxStatus,
      action: onGeneratePptx,
      actionLabel: 'Gen',
      disabled: !canGeneratePptx,
      downloadUrl: analysisJob?.ppt_download_url,
    },
  ];

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1,
        borderRadius: 2,
        transition: 'box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 35, 72, 0.1)',
        },
      }}
    >
      <CardContent sx={{ py: compact ? 1 : 1.5, '&:last-child': { pb: compact ? 1 : 1.5 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={1}
        >
          {/* Meeting Info */}
          <Box
            sx={{
              minWidth: 180,
              maxWidth: { xs: '100%', sm: 220 },
              cursor: onViewMeeting ? 'pointer' : 'default',
            }}
            onClick={onViewMeeting}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {meeting.title}
              </Typography>
              {onViewMeeting && (
                <IconButton size="small" sx={{ p: 0.25 }}>
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {meeting.meeting_date
                ? new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'Date TBD'}
            </Typography>
          </Box>

          {/* Pipeline Steps or Setup Button */}
          {needsContext ? (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={onSetupContext}
              startIcon={<SettingsIcon />}
              sx={{ minWidth: 140 }}
            >
              Set Up Context
            </Button>
          ) : (
            <Stack direction="row" spacing={compact ? 0.5 : 1} alignItems="center">
              {pipelineSteps.map((step, index) => (
                <Box key={step.key} sx={{ display: 'flex', alignItems: 'center' }}>
                  {index > 0 && (
                    <ArrowForwardIcon
                      fontSize="small"
                      sx={{
                        color: 'grey.400',
                        mx: compact ? 0.25 : 0.5,
                        fontSize: compact ? '0.875rem' : '1rem',
                      }}
                    />
                  )}
                  <PipelineStep
                    label={step.label}
                    status={step.status}
                    onAction={step.action}
                    actionLabel={step.actionLabel}
                    disabled={step.disabled}
                    downloadUrl={step.downloadUrl}
                    compact={compact}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default MeetingPipelineRow;
