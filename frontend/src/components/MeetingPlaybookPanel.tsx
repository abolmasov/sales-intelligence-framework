import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Tabs,
  Tab,
  Chip,
  Button,
  IconButton,
  Collapse,
  Alert,
  Divider,
  Card,
  CardContent,
  Tooltip,
} from '@mui/material';
import {
  AccountTree,
  QuestionAnswer,
  Assessment,
  ExpandMore,
  ExpandLess,
  Lightbulb,
  TrendingUp,
  PlayArrow,
  CheckCircle,
  ContentCopy,
  Check,
  Add,
} from '@mui/icons-material';
import SalesPlaybookWizard from './SalesPlaybookWizard';
import { DecisionFlowOutcome } from '../types/atlassianDecisionFlow';

interface MeetingPlaybookPanelProps {
  meetingId: string;
  companyName: string;
  dealId?: string;
  onAddQuestions?: (questions: string[]) => void;
  initialExpanded?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

const MeetingPlaybookPanel: React.FC<MeetingPlaybookPanelProps> = ({
  meetingId,
  companyName,
  dealId,
  onAddQuestions,
  initialExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [activeTab, setActiveTab] = useState(0);
  const [playbookOutcome, setPlaybookOutcome] = useState<DecisionFlowOutcome | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [addedQuestions, setAddedQuestions] = useState<Set<number>>(new Set());

  const handlePlaybookComplete = (outcome: DecisionFlowOutcome) => {
    setPlaybookOutcome(outcome);
    setActiveTab(1); // Switch to questions tab
  };

  const handleGenerateQuestions = (questions: string[]) => {
    setGeneratedQuestions(prev => {
      const existing = new Set(prev);
      const newQuestions = questions.filter(q => !existing.has(q));
      return [...prev, ...newQuestions];
    });
  };

  const handleCopyQuestion = async (question: string, index: number) => {
    try {
      await navigator.clipboard.writeText(question);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleAddQuestion = (question: string, index: number) => {
    if (onAddQuestions) {
      onAddQuestions([question]);
      setAddedQuestions(prev => new Set(prev).add(index));
    }
  };

  const handleAddAllQuestions = () => {
    if (onAddQuestions && generatedQuestions.length > 0) {
      const newQuestions = generatedQuestions.filter((_, idx) => !addedQuestions.has(idx));
      onAddQuestions(newQuestions);
      setAddedQuestions(new Set(generatedQuestions.map((_, idx) => idx)));
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid rgba(0, 35, 72, 0.08)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          p: 2,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: playbookOutcome ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0, 164, 140, 0.05)',
          borderBottom: expanded ? '1px solid rgba(0, 35, 72, 0.08)' : 'none',
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: playbookOutcome ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 164, 140, 0.08)',
          },
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: playbookOutcome ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 164, 140, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: playbookOutcome ? '#10b981' : '#00A48C',
            }}
          >
            {playbookOutcome ? <CheckCircle /> : <AccountTree />}
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.primary' }}>
              Atlassian Sales Playbook
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {playbookOutcome
                ? `Recommendation: ${playbookOutcome.title}`
                : 'Guided decision flow for license renewals & cloud migrations'}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {playbookOutcome && (
            <Chip
              label={playbookOutcome.estimatedValue}
              size="small"
              color="success"
              variant="outlined"
            />
          )}
          {generatedQuestions.length > 0 && (
            <Chip
              icon={<QuestionAnswer sx={{ fontSize: 14 }} />}
              label={`${generatedQuestions.length} questions`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </Stack>
      </Box>

      {/* Expandable Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 0 }}>
          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            sx={{
              borderBottom: '1px solid rgba(0, 35, 72, 0.08)',
              px: 2,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                minHeight: 48,
              },
            }}
          >
            <Tab
              icon={<AccountTree sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Decision Flow"
            />
            <Tab
              icon={<QuestionAnswer sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={`Questions ${generatedQuestions.length > 0 ? `(${generatedQuestions.length})` : ''}`}
            />
            {playbookOutcome && (
              <Tab
                icon={<Assessment sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="Recommendation"
              />
            )}
          </Tabs>

          {/* Tab Content */}
          <Box sx={{ p: 2 }}>
            <TabPanel value={activeTab} index={0}>
              <SalesPlaybookWizard
                companyName={companyName}
                dealId={dealId}
                onComplete={handlePlaybookComplete}
                onGenerateQuestions={handleGenerateQuestions}
                embedded
              />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              {generatedQuestions.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2">
                    Complete the decision flow to generate contextual discovery questions for {companyName}.
                  </Typography>
                </Alert>
              ) : (
                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Contextual questions based on your playbook path
                    </Typography>
                    {onAddQuestions && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Add />}
                        onClick={handleAddAllQuestions}
                        disabled={addedQuestions.size === generatedQuestions.length}
                        sx={{ borderColor: '#00A48C', color: '#00A48C' }}
                      >
                        Add All to Pre-Call
                      </Button>
                    )}
                  </Stack>

                  <Stack spacing={1}>
                    {generatedQuestions.map((question, idx) => {
                      const isAdded = addedQuestions.has(idx);
                      return (
                        <Card
                          key={idx}
                          variant="outlined"
                          sx={{
                            borderRadius: 1.5,
                            borderColor: isAdded ? 'success.main' : 'divider',
                            bgcolor: isAdded ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                          }}
                        >
                          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                              <Box
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  bgcolor: isAdded ? 'success.main' : 'rgba(0, 164, 140, 0.1)',
                                  color: isAdded ? 'white' : '#00A48C',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                }}
                              >
                                {isAdded ? <Check sx={{ fontSize: 14 }} /> : idx + 1}
                              </Box>
                              <Typography variant="body2" sx={{ flex: 1, color: 'text.primary' }}>
                                {question}
                              </Typography>
                              <Stack direction="row" spacing={0.5}>
                                <Tooltip title={copiedIndex === idx ? 'Copied!' : 'Copy'}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCopyQuestion(question, idx)}
                                  >
                                    {copiedIndex === idx ? (
                                      <Check sx={{ fontSize: 16, color: 'success.main' }} />
                                    ) : (
                                      <ContentCopy sx={{ fontSize: 16 }} />
                                    )}
                                  </IconButton>
                                </Tooltip>
                                {onAddQuestions && !isAdded && (
                                  <Tooltip title="Add to Pre-Call">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleAddQuestion(question, idx)}
                                      sx={{ color: '#00A48C' }}
                                    >
                                      <Add sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </TabPanel>

            {playbookOutcome && (
              <TabPanel value={activeTab} index={2}>
                <Box>
                  {/* Outcome Summary */}
                  <Alert
                    severity="success"
                    icon={<TrendingUp />}
                    sx={{ mb: 3, borderRadius: 2 }}
                  >
                    <Typography variant="subtitle2" fontWeight={600}>
                      {playbookOutcome.title}
                    </Typography>
                    <Typography variant="body2">
                      {playbookOutcome.description}
                    </Typography>
                  </Alert>

                  {/* Value & Urgency */}
                  <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                    <Card variant="outlined" sx={{ flex: 1, borderRadius: 2 }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Estimated Value
                        </Typography>
                        <Typography variant="h5" color="success.main" fontWeight={700}>
                          {playbookOutcome.estimatedValue}
                        </Typography>
                      </CardContent>
                    </Card>
                    <Card variant="outlined" sx={{ flex: 1, borderRadius: 2 }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Urgency Level
                        </Typography>
                        <Chip
                          label={playbookOutcome.urgency.charAt(0).toUpperCase() + playbookOutcome.urgency.slice(1)}
                          color={
                            playbookOutcome.urgency === 'critical' ? 'error' :
                            playbookOutcome.urgency === 'high' ? 'warning' :
                            playbookOutcome.urgency === 'medium' ? 'info' : 'default'
                          }
                          sx={{ mt: 0.5 }}
                        />
                      </CardContent>
                    </Card>
                  </Stack>

                  {/* Services */}
                  <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.primary' }}>
                    Recommended Services
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                    {playbookOutcome.recommendedServices.map((service, idx) => (
                      <Chip
                        key={idx}
                        label={service.name}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: '#00A48C', color: '#00A48C' }}
                      />
                    ))}
                  </Stack>

                  {/* Talking Points */}
                  {playbookOutcome.talkingPoints.length > 0 && (
                    <>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.primary' }}>
                        Key Talking Points
                      </Typography>
                      <Stack spacing={1} sx={{ mb: 3 }}>
                        {playbookOutcome.talkingPoints.map((point, idx) => (
                          <Stack key={idx} direction="row" spacing={1} alignItems="flex-start">
                            <Lightbulb sx={{ fontSize: 16, color: 'warning.main', mt: 0.25 }} />
                            <Typography variant="body2">{point}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </>
                  )}

                  {/* Next Steps */}
                  {playbookOutcome.nextSteps.length > 0 && (
                    <>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.primary' }}>
                        Recommended Next Steps
                      </Typography>
                      <Stack spacing={0.5}>
                        {playbookOutcome.nextSteps.map((step, idx) => (
                          <Stack key={idx} direction="row" spacing={1} alignItems="center">
                            <Box
                              sx={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                bgcolor: 'rgba(0, 164, 140, 0.1)',
                                color: '#00A48C',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}
                            >
                              {idx + 1}
                            </Box>
                            <Typography variant="body2">{step}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </>
                  )}
                </Box>
              </TabPanel>
            )}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default MeetingPlaybookPanel;
