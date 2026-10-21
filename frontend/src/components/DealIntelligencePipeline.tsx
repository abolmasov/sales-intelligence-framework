import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Stack,
  IconButton,
  Tooltip,
  Card,
  CardContent,
} from '@mui/material';
import {
  Search,
  Mic,
  Description,
  CheckCircle,
  PlayArrow,
  Refresh,
  Lock,
  AccessTime,
  TrendingUp,
  ArrowForward,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface PipelineStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: 'completed' | 'in_progress' | 'available' | 'locked';
  existingData?: {
    date: string;
    summary?: string;
    count?: number;
  } | null;
  action: () => void;
  actionLabel: string;
}

interface DealIntelligencePipelineProps {
  dealId: string;
  companyName: string;
  researchData: any;
  transcriptAnalyses: any[];
  meetings: any[];
  onStartResearch: () => void;
  onNavigateToMeetings: () => void;
  onNavigateToRFPGenerator: () => void;
  researchLoading?: boolean;
}

const DealIntelligencePipeline: React.FC<DealIntelligencePipelineProps> = ({
  dealId,
  companyName,
  researchData,
  transcriptAnalyses,
  meetings,
  onStartResearch,
  onNavigateToMeetings,
  onNavigateToRFPGenerator,
  researchLoading = false,
}) => {
  const navigate = useNavigate();

  // Calculate pipeline status
  const hasResearch = !!researchData && Object.keys(researchData).length > 0;
  const hasTranscripts = transcriptAnalyses && transcriptAnalyses.length > 0;
  const hasMeetings = meetings && meetings.length > 0;
  const analyzedMeetings = meetings?.filter((m: any) => m.analysis_id) || [];
  const hasAnalyzedMeetings = analyzedMeetings.length > 0;

  // Calculate overall progress
  const calculateProgress = () => {
    let progress = 0;
    if (hasResearch) progress += 40;
    if (hasAnalyzedMeetings || hasTranscripts) progress += 35;
    // RFP generation would add the remaining 25%
    return progress;
  };

  const getResearchDate = () => {
    if (researchData?.metadata?.timestamp) {
      return new Date(researchData.metadata.timestamp).toLocaleDateString();
    }
    return null;
  };

  const steps: PipelineStep[] = [
    {
      id: 'research',
      label: 'Client Research',
      description: hasResearch
        ? `Research completed for ${companyName}. View insights or refresh data.`
        : `Run AI-powered research on ${companyName} to gather company intelligence, opportunities, and strategic insights.`,
      icon: <Search />,
      status: researchLoading ? 'in_progress' : hasResearch ? 'completed' : 'available',
      existingData: hasResearch
        ? {
            date: getResearchDate() || 'Recently',
            summary: researchData?.executiveSummary?.substring(0, 100) + '...' || 'Research data available',
          }
        : null,
      action: onStartResearch,
      actionLabel: hasResearch ? 'Refresh Research' : 'Start Research',
    },
    {
      id: 'meetings',
      label: 'Meeting Analysis',
      description: hasAnalyzedMeetings
        ? `${analyzedMeetings.length} meeting(s) analyzed. Add more meetings or view transcript insights.`
        : hasMeetings
        ? `${meetings.length} meeting(s) scheduled. Analyze transcripts to extract insights.`
        : 'Upload meeting transcripts or sync from calendar to analyze customer conversations.',
      icon: <Mic />,
      status: hasAnalyzedMeetings ? 'completed' : hasResearch ? 'available' : 'locked',
      existingData: hasAnalyzedMeetings
        ? {
            date: 'Multiple meetings',
            count: analyzedMeetings.length,
            summary: `${analyzedMeetings.length} analyzed, ${meetings.length - analyzedMeetings.length} pending`,
          }
        : null,
      action: () => navigate('/app/meetings'),
      actionLabel: hasAnalyzedMeetings ? 'View Analyses' : hasMeetings ? 'Analyze Meetings' : 'Add Meetings',
    },
    {
      id: 'proposal',
      label: 'Generate Solution Proposal',
      description:
        hasResearch && (hasAnalyzedMeetings || hasTranscripts)
          ? 'Generate RFP response or SOW using accumulated intelligence from research and meetings.'
          : 'Complete client research and at least one meeting analysis to unlock solution proposal generation.',
      icon: <Description />,
      status: hasResearch && (hasAnalyzedMeetings || hasTranscripts) ? 'available' : 'locked',
      existingData: null,
      action: () => navigate(`/app/rfp-generator?dealId=${dealId}&company=${encodeURIComponent(companyName)}`),
      actionLabel: 'Generate Solution Proposal',
    },
  ];

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'in_progress':
        return '#3b82f6';
      case 'available':
        return '#f59e0b';
      case 'locked':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'completed':
        return <Chip icon={<CheckCircle />} label="Completed" size="small" color="success" />;
      case 'in_progress':
        return <Chip icon={<AccessTime />} label="In Progress" size="small" color="primary" />;
      case 'available':
        return <Chip icon={<PlayArrow />} label="Ready" size="small" color="warning" />;
      case 'locked':
        return <Chip icon={<Lock />} label="Locked" size="small" disabled />;
      default:
        return null;
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        background: '#FFFFFF',
        border: '1px solid rgba(0, 35, 72, 0.08)',
        borderRadius: 3,
        boxShadow: '0 25px 50px rgba(0, 35, 72, 0.08)',
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
              Deal Intelligence Pipeline
            </Typography>
            <Typography variant="body2" sx={{ color: '#5B6C8F' }}>
              Progressive workflow: Research → Analysis → Proposal
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h4" sx={{ color: 'secondary.main', fontWeight: 700 }}>
              {calculateProgress()}%
            </Typography>
            <Typography variant="caption" sx={{ color: '#5B6C8F' }}>
              Pipeline Progress
            </Typography>
          </Box>
        </Stack>

        {/* Overall Progress Bar */}
        <Box sx={{ position: 'relative', mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={calculateProgress()}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: 'rgba(0, 35, 72, 0.08)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
              },
            }}
          />
          {/* Progress markers */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#5B6C8F' }}>
              Research
            </Typography>
            <Typography variant="caption" sx={{ color: '#5B6C8F' }}>
              Analysis
            </Typography>
            <Typography variant="caption" sx={{ color: '#5B6C8F' }}>
              Proposal
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Pipeline Steps */}
      <Stack spacing={2}>
        {steps.map((step, index) => (
          <Card
            key={step.id}
            sx={{
              backgroundColor: step.status === 'locked' ? '#F4F6FB' : '#FFFFFF',
              border: `1px solid ${step.status === 'completed' ? 'rgba(0, 164, 140, 0.35)' : 'rgba(0, 35, 72, 0.12)'}`,
              transition: 'all 0.2s ease',
              boxShadow: '0 10px 25px rgba(0, 35, 72, 0.08)',
              '&:hover': step.status !== 'locked' ? { borderColor: '#2563eb', boxShadow: '0 16px 32px rgba(0, 35, 72, 0.15)' } : {},
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                {/* Step Number & Icon */}
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: getStepColor(step.status) + '20',
                    color: getStepColor(step.status),
                    flexShrink: 0,
                  }}
                >
                  {step.status === 'completed' ? <CheckCircle /> : step.icon}
                </Box>

                {/* Step Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 600 }}>
                      {index + 1}. {step.label}
                    </Typography>
                    {getStatusChip(step.status)}
                  </Stack>

                  <Typography variant="body2" sx={{ color: '#5B6C8F', mb: 1.5 }}>
                    {step.description}
                  </Typography>

                  {/* Existing Data Tag */}
                  {step.existingData && (
                    <Alert
                      severity="info"
                      icon={<TrendingUp fontSize="small" />}
                      sx={{
                        mb: 1.5,
                        py: 0.5,
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        border: '1px solid rgba(37, 99, 235, 0.2)',
                        '& .MuiAlert-message': { color: '#1A385E' },
                        '& .MuiAlert-icon': { color: 'secondary.main' },
                      }}
                    >
                      <Typography variant="caption">
                        <strong>Existing data:</strong> {step.existingData.summary || step.existingData.date}
                        {step.existingData.count && ` (${step.existingData.count} items)`}
                      </Typography>
                    </Alert>
                  )}

                  {/* Action Button */}
                  <Button
                    variant={step.status === 'completed' ? 'outlined' : 'contained'}
                    size="small"
                    disabled={step.status === 'locked' || step.status === 'in_progress'}
                    onClick={step.action}
                    startIcon={
                      step.status === 'completed' ? (
                        <Refresh />
                      ) : step.status === 'in_progress' ? (
                        <AccessTime />
                      ) : (
                        <ArrowForward />
                      )
                    }
                    sx={{
                      backgroundColor: step.status === 'completed' ? 'transparent' : getStepColor(step.status),
                      borderColor: getStepColor(step.status),
                      color: step.status === 'completed' ? getStepColor(step.status) : '#fff',
                      '&:hover': {
                        backgroundColor:
                          step.status === 'completed'
                            ? getStepColor(step.status) + '20'
                            : getStepColor(step.status),
                        borderColor: getStepColor(step.status),
                      },
                    }}
                  >
                    {step.status === 'in_progress' ? 'Processing...' : step.actionLabel}
                  </Button>
                </Box>

                {/* Arrow to next step */}
                {index < steps.length - 1 && (
                  <Box
                    sx={{
                      display: { xs: 'none', md: 'flex' },
                      alignItems: 'center',
                      color: step.status === 'completed' ? '#10b981' : '#475569',
                    }}
                  >
                    <ArrowForward />
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Quick Stats */}
      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #334155' }}>
        <Stack direction="row" spacing={3} justifyContent="center">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: hasResearch ? '#10b981' : '#64748b' }}>
              {hasResearch ? '1' : '0'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Research Sessions
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: hasMeetings ? '#3b82f6' : '#64748b' }}>
              {meetings?.length || 0}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Meetings
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: hasAnalyzedMeetings ? '#10b981' : '#64748b' }}>
              {analyzedMeetings.length}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Analyzed
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: 'text.secondary' }}>
              0
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Proposals
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
};

export default DealIntelligencePipeline;
