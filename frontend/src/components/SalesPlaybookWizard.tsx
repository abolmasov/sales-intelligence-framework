import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PlayArrow,
  ArrowForward,
  ArrowBack,
  CheckCircle,
  Refresh,
  QuestionAnswer,
  TrendingUp,
  AttachMoney,
  ContentCopy,
  Check,
  Close,
  Lightbulb,
  AccountTree,
  Business,
  CloudQueue,
  Storage,
  Support,
  School,
  Assessment,
  Timeline,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import {
  DecisionNode,
  DecisionPath,
  DecisionFlowState,
  ATLASSIAN_DECISION_FLOW,
  getDecisionNode,
  getOutcomeDetails,
  generatePreCallQuestions,
  getServiceValueEstimate,
  OutcomeType,
} from '../types/atlassianDecisionFlow';

interface SalesPlaybookWizardProps {
  companyName?: string;
  dealId?: string;
  onComplete?: (outcome: any) => void;
  onGenerateQuestions?: (questions: string[]) => void;
  embedded?: boolean;
}

const getServiceIcon = (serviceName: string) => {
  const lowerName = serviceName.toLowerCase();
  if (lowerName.includes('cloud') || lowerName.includes('migration')) return <CloudQueue />;
  if (lowerName.includes('training') || lowerName.includes('onboarding')) return <School />;
  if (lowerName.includes('managed') || lowerName.includes('support')) return <Support />;
  if (lowerName.includes('assessment') || lowerName.includes('analysis')) return <Assessment />;
  if (lowerName.includes('data center') || lowerName.includes('dc')) return <Storage />;
  return <Business />;
};

const SalesPlaybookWizard: React.FC<SalesPlaybookWizardProps> = ({
  companyName = 'the customer',
  dealId,
  onComplete,
  onGenerateQuestions,
  embedded = false,
}) => {
  const [flowState, setFlowState] = useState<DecisionFlowState>({
    currentNodeId: 'start',
    path: [],
    completed: false,
  });
  const [showSummary, setShowSummary] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showPathHistory, setShowPathHistory] = useState(false);

  const currentNode = getDecisionNode(flowState.currentNodeId);

  const handleSelectOption = useCallback((optionValue: string, nextNodeId: string) => {
    setFlowState(prev => {
      const newPath: DecisionPath[] = [
        ...prev.path,
        {
          nodeId: prev.currentNodeId,
          selectedOption: optionValue,
          timestamp: new Date(),
        },
      ];

      const nextNode = getDecisionNode(nextNodeId);
      const isComplete = nextNode?.type === 'outcome';

      return {
        currentNodeId: nextNodeId,
        path: newPath,
        completed: isComplete,
        outcome: isComplete && nextNode ? {
          type: nextNode.outcome as OutcomeType,
          title: nextNode.recommendation || '',
          description: getOutcomeDetails(nextNode.outcome as OutcomeType).description,
          recommendedServices: (nextNode.services || []).map(s => ({
            name: s,
            category: 'consulting' as const,
            description: '',
            valueProposition: '',
            estimatedEngagement: '',
          })),
          talkingPoints: nextNode.talkingPoints || [],
          nextSteps: nextNode.nextSteps || [],
          estimatedValue: getServiceValueEstimate(nextNode.services || []),
          urgency: getOutcomeDetails(nextNode.outcome as OutcomeType).urgency,
          relatedQuestions: generatePreCallQuestions(newPath),
        } : undefined,
      };
    });
  }, []);

  const handleBack = useCallback(() => {
    setFlowState(prev => {
      if (prev.path.length === 0) return prev;

      const newPath = [...prev.path];
      const lastStep = newPath.pop();

      return {
        currentNodeId: lastStep?.nodeId || 'start',
        path: newPath,
        completed: false,
        outcome: undefined,
      };
    });
  }, []);

  const handleReset = useCallback(() => {
    setFlowState({
      currentNodeId: 'start',
      path: [],
      completed: false,
    });
    setShowSummary(false);
  }, []);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleGenerateQuestions = () => {
    if (flowState.outcome?.relatedQuestions && onGenerateQuestions) {
      onGenerateQuestions(flowState.outcome.relatedQuestions);
    }
  };

  const handleComplete = () => {
    if (flowState.outcome && onComplete) {
      onComplete(flowState.outcome);
    }
    setShowSummary(true);
  };

  const progressPercent = Math.min(
    ((flowState.path.length + (flowState.completed ? 1 : 0)) / 5) * 100,
    100
  );

  // Render the current question
  const renderQuestion = () => {
    if (!currentNode || currentNode.type !== 'question') return null;

    return (
      <Box>
        <Typography variant="h6" sx={{ color: 'text.primary', mb: 3, fontWeight: 600 }}>
          {currentNode.question}
        </Typography>

        <Stack spacing={1.5}>
          {currentNode.options?.map((option, idx) => (
            <Card
              key={option.value}
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid rgba(0, 35, 72, 0.12)',
                '&:hover': {
                  borderColor: '#00A48C',
                  boxShadow: '0 4px 12px rgba(0, 164, 140, 0.15)',
                  transform: 'translateX(4px)',
                },
              }}
              onClick={() => handleSelectOption(option.value, option.nextNodeId)}
            >
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        bgcolor: 'rgba(0, 164, 140, 0.1)',
                        color: '#00A48C',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                      }}
                    >
                      {String.fromCharCode(65 + idx)}
                    </Box>
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {option.label}
                      </Typography>
                      {option.hint && (
                        <Typography variant="caption" color="text.secondary">
                          {option.hint}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  <ArrowForward sx={{ color: '#00A48C', opacity: 0.5 }} />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    );
  };

  // Render the outcome
  const renderOutcome = () => {
    if (!currentNode || currentNode.type !== 'outcome' || !flowState.outcome) return null;

    const outcome = flowState.outcome;
    const outcomeDetails = getOutcomeDetails(outcome.type);

    return (
      <Box>
        <Alert
          severity="success"
          icon={<CheckCircle />}
          sx={{ mb: 3, bgcolor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Recommendation: {outcome.title}
          </Typography>
          <Typography variant="body2">
            {outcome.description}
          </Typography>
        </Alert>

        {/* Recommended Services */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Recommended Services
            </Typography>
            <Chip
              icon={<AttachMoney sx={{ fontSize: 16 }} />}
              label={outcome.estimatedValue}
              size="small"
              color="success"
              variant="outlined"
            />
          </Stack>
          <Stack spacing={1}>
            {currentNode.services?.map((service, idx) => (
              <Stack key={idx} direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ color: '#00A48C' }}>{getServiceIcon(service)}</Box>
                <Typography variant="body2">{service}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>

        {/* Talking Points */}
        {currentNode.talkingPoints && currentNode.talkingPoints.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                <QuestionAnswer sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
                Talking Points
              </Typography>
              <Tooltip title={copiedText === 'talking' ? 'Copied!' : 'Copy all'}>
                <IconButton
                  size="small"
                  onClick={() => handleCopy(currentNode.talkingPoints!.join('\n\n'), 'talking')}
                >
                  {copiedText === 'talking' ? <Check sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>
            </Stack>
            <List dense disablePadding>
              {currentNode.talkingPoints.map((point, idx) => (
                <ListItem key={idx} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <Lightbulb sx={{ fontSize: 16, color: 'warning.main' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={point}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {/* Next Steps */}
        {currentNode.nextSteps && currentNode.nextSteps.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              <Timeline sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
              Recommended Next Steps
            </Typography>
            <Stepper orientation="vertical" sx={{ ml: 1 }}>
              {currentNode.nextSteps.map((step, idx) => (
                <Step key={idx} active>
                  <StepLabel>
                    <Typography variant="body2">{step}</Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>
        )}

        {/* Pre-Call Questions */}
        {outcome.relatedQuestions && outcome.relatedQuestions.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'rgba(0, 164, 140, 0.05)' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                <QuestionAnswer sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle', color: '#00A48C' }} />
                Suggested Discovery Questions
              </Typography>
              {onGenerateQuestions && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ArrowForward />}
                  onClick={handleGenerateQuestions}
                  sx={{ borderColor: '#00A48C', color: '#00A48C' }}
                >
                  Add to Pre-Call
                </Button>
              )}
            </Stack>
            <List dense disablePadding>
              {outcome.relatedQuestions.map((question, idx) => (
                <ListItem key={idx} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <Typography variant="body2" color="primary" fontWeight={600}>
                      {idx + 1}.
                    </Typography>
                  </ListItemIcon>
                  <ListItemText
                    primary={question}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {/* Action Buttons */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleReset}
          >
            Start Over
          </Button>
          <Button
            variant="contained"
            startIcon={<CheckCircle />}
            onClick={handleComplete}
            sx={{ bgcolor: '#00A48C', '&:hover': { bgcolor: '#008770' } }}
          >
            Complete & Save
          </Button>
        </Stack>
      </Box>
    );
  };

  // Render path history
  const renderPathHistory = () => {
    if (flowState.path.length === 0) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          onClick={() => setShowPathHistory(!showPathHistory)}
          sx={{ cursor: 'pointer', mb: 1 }}
        >
          <AccountTree sx={{ fontSize: 18, mr: 1, color: '#5B6C8F' }} />
          <Typography variant="caption" color="text.secondary">
            Decision Path ({flowState.path.length} steps)
          </Typography>
          {showPathHistory ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
        </Stack>

        <Collapse in={showPathHistory}>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {flowState.path.map((step, idx) => {
              const node = getDecisionNode(step.nodeId);
              const option = node?.options?.find(o => o.value === step.selectedOption);
              return (
                <Chip
                  key={idx}
                  label={option?.label || step.selectedOption}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              );
            })}
          </Stack>
        </Collapse>
      </Box>
    );
  };

  const containerSx = embedded
    ? { p: 0 }
    : {
        p: 3,
        borderRadius: 3,
        border: '1px solid rgba(0, 35, 72, 0.08)',
        boxShadow: '0 25px 50px rgba(0, 35, 72, 0.08)',
      };

  return (
    <Paper elevation={0} sx={containerSx}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
              <AccountTree sx={{ fontSize: 20, mr: 1, verticalAlign: 'middle', color: '#00A48C' }} />
              Atlassian Services Playbook
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Guided decision flow for {companyName}
            </Typography>
          </Box>
          <Chip
            label={flowState.completed ? 'Complete' : `Step ${flowState.path.length + 1}`}
            color={flowState.completed ? 'success' : 'primary'}
            size="small"
          />
        </Stack>

        {/* Progress Bar */}
        <Box>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(0, 35, 72, 0.08)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                bgcolor: flowState.completed ? '#10b981' : '#00A48C',
              },
            }}
          />
        </Box>
      </Box>

      {/* Path History */}
      {renderPathHistory()}

      {/* Navigation */}
      {flowState.path.length > 0 && !flowState.completed && (
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={handleBack}
            size="small"
            sx={{ color: '#5B6C8F' }}
          >
            Back
          </Button>
        </Box>
      )}

      {/* Content */}
      {flowState.completed ? renderOutcome() : renderQuestion()}

      {/* Summary Dialog */}
      <Dialog open={showSummary} onClose={() => setShowSummary(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Playbook Complete</Typography>
            <IconButton size="small" onClick={() => setShowSummary(false)}>
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {flowState.outcome && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">{flowState.outcome.title}</Typography>
                <Typography variant="body2">{flowState.outcome.description}</Typography>
              </Alert>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Estimated Opportunity Value
              </Typography>
              <Typography variant="h5" color="success.main" sx={{ mb: 2 }}>
                {flowState.outcome.estimatedValue}
              </Typography>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Services to Propose
              </Typography>
              <Stack spacing={0.5} sx={{ mb: 2 }}>
                {flowState.outcome.recommendedServices.map((service, idx) => (
                  <Chip key={idx} label={service.name} size="small" variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleReset}>Start New Assessment</Button>
          <Button
            variant="contained"
            onClick={() => setShowSummary(false)}
            sx={{ bgcolor: '#00A48C' }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default SalesPlaybookWizard;
