import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { ArrowBack, Cloud, CloudQueue, Dns, Radar, Speed, Storage, SwapHoriz } from '@mui/icons-material';
import { apiGet, apiPost } from '../utils/api';
import {
  AtlassianAssessment,
  QuestionnaireQuestion,
  QuestionnaireCategory,
  QuestionnaireResponses,
  AssessmentAnalysis,
  EnvironmentData,
  getUrgencyColor,
  getScoreColor,
  getStatusLabel,
  getMigrationType,
  getMigrationTypeLabel,
  MigrationType,
} from '../types/atlassianAssessment';
import AtlassianQuestionnaire from '../components/AtlassianQuestionnaire';
import AtlassianAssessmentReport from '../components/AtlassianAssessmentReport';
import AtlassianEnvironmentScan from '../components/AtlassianEnvironmentScan';

const getMigrationTypeIcon = (type: MigrationType) => {
  switch (type) {
    case 'dc-to-cloud':
      return <Dns sx={{ fontSize: 16 }} />;
    case 'server-to-cloud':
      return <Storage sx={{ fontSize: 16 }} />;
    case 'cloud-to-cloud':
      return <CloudQueue sx={{ fontSize: 16 }} />;
    default:
      return <SwapHoriz sx={{ fontSize: 16 }} />;
  }
};

const getMigrationTypeColor = (type: MigrationType) => {
  switch (type) {
    case 'dc-to-cloud':
      return '#0052CC';
    case 'server-to-cloud':
      return '#6554C0';
    case 'cloud-to-cloud':
      return '#00875A';
    default:
      return '#6B778C';
  }
};

const AtlassianAssessmentDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { assessmentId } = useParams<{ assessmentId: string }>();

  // Assessment data
  const [assessment, setAssessment] = useState<AtlassianAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Questionnaire state
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireQuestion[] | null>(null);
  const [questionnaireCategories, setQuestionnaireCategories] = useState<Record<string, QuestionnaireCategory> | null>(null);
  const [responses, setResponses] = useState<QuestionnaireResponses>({});

  // Action loading state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState<'generate' | 'save' | 'analyze' | 'rescan' | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState(0);

  // Fetch assessment on mount
  useEffect(() => {
    if (assessmentId) {
      fetchAssessment();
    }
  }, [assessmentId]);

  const fetchAssessment = async () => {
    if (!assessmentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/atlassian/assessments/${assessmentId}`);
      if (data.success) {
        const ass = data.data;
        setAssessment(ass);
        setResponses(ass.questionnaireResponses || {});
        // Auto-select tab based on status
        // If completed, go to report. If has env data, show that. Otherwise questionnaire.
        if (ass.status === 'completed') {
          setActiveTab(2);
        } else if (ass.environmentData?.scanResult) {
          setActiveTab(1);
        } else {
          setActiveTab(0);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch assessment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assessment');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuestionnaire = async () => {
    if (!assessmentId) return;
    setActionLoading(true);
    setActionType('generate');
    setError(null);
    try {
      const data = await apiPost(`/api/atlassian/assessments/${assessmentId}/questionnaire`, {});
      if (data.success) {
        setQuestionnaire(data.data.questions);
        setQuestionnaireCategories(data.data.categories);
      } else {
        throw new Error(data.error || 'Failed to generate questionnaire');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate questionnaire');
    } finally {
      setActionLoading(false);
      setActionType(null);
    }
  };

  const handleUpdateResponse = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSaveResponses = async (newResponses: QuestionnaireResponses): Promise<boolean> => {
    if (!assessmentId) return false;
    setActionLoading(true);
    setActionType('save');
    setError(null);
    try {
      const data = await apiPost(`/api/atlassian/assessments/${assessmentId}/responses`, {
        responses: newResponses,
      });
      if (data.success) {
        setResponses(newResponses);
        return true;
      }
      throw new Error(data.error || 'Failed to save responses');
    } catch (err: any) {
      setError(err.message || 'Failed to save responses');
      return false;
    } finally {
      setActionLoading(false);
      setActionType(null);
    }
  };

  const handleRunAnalysis = async (): Promise<AssessmentAnalysis | null> => {
    if (!assessmentId) return null;
    setActionLoading(true);
    setActionType('analyze');
    setError(null);
    try {
      const data = await apiPost(`/api/atlassian/assessments/${assessmentId}/analyze`, {});
      if (data.success) {
        // Refresh assessment to get analysis result
        await fetchAssessment();
        setActiveTab(2); // Switch to report tab (index 2: Questionnaire=0, Env Scan=1, Report=2)
        return data.data;
      }
      throw new Error(data.error || 'Failed to run analysis');
    } catch (err: any) {
      setError(err.message || 'Failed to run analysis');
      return null;
    } finally {
      setActionLoading(false);
      setActionType(null);
    }
  };

  const handleComplete = () => {
    setActiveTab(2);
  };

  const handleScanComplete = (data: EnvironmentData) => {
    setAssessment(prev => prev ? { ...prev, environmentData: data } : null);
  };

  const handleRescan = async () => {
    if (!assessmentId || !assessment?.environmentData) return;
    setActionLoading(true);
    setActionType('rescan');
    setError(null);
    try {
      // Call the rescan API endpoint which uses stored credentials
      const data = await apiPost(`/api/atlassian/assessments/${assessmentId}/rescan`, {});
      if (data.success) {
        // Update assessment with new scan data
        setAssessment(prev => prev ? {
          ...prev,
          environmentData: data.data
        } : null);
      } else {
        throw new Error(data.error || 'Failed to rescan');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to rescan');
    } finally {
      setActionLoading(false);
      setActionType(null);
    }
  };

  const handleBackToList = () => {
    navigate('/app/atlassian-assessment');
  };

  // Loading state
  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 400 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading assessment...</Typography>
        </Stack>
      </Container>
    );
  }

  // Error state (no assessment loaded)
  if (!assessment) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 400 }}>
          <Typography color="error" sx={{ mb: 2 }}>
            {error || 'Assessment not found'}
          </Typography>
          <Button variant="outlined" onClick={handleBackToList}>
            Back to Assessments
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={handleBackToList} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="h5" fontWeight={700}>
                {assessment.companyName}
              </Typography>
              {/* Migration Type Badge */}
              {assessment.status === 'completed' && assessment.questionnaireResponses && (() => {
                const migrationType = getMigrationType(assessment.questionnaireResponses.deployment_type);
                const color = getMigrationTypeColor(migrationType);
                if (migrationType === 'unknown') return null;
                return (
                  <Chip
                    icon={getMigrationTypeIcon(migrationType)}
                    label={getMigrationTypeLabel(migrationType)}
                    size="small"
                    sx={{
                      bgcolor: `${color}20`,
                      color: color,
                      fontWeight: 600,
                      '& .MuiChip-icon': { color: color },
                    }}
                  />
                );
              })()}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              <Chip
                label={getStatusLabel(assessment.status)}
                size="small"
                sx={{
                  fontWeight: 600,
                  bgcolor: assessment.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.08)',
                  color: assessment.status === 'completed' ? '#10b981' : 'text.secondary',
                }}
              />
              {assessment.urgencyLevel && (
                <Chip
                  label={`${assessment.urgencyLevel.toUpperCase()} URGENCY`}
                  size="small"
                  color={getUrgencyColor(assessment.urgencyLevel)}
                  sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                />
              )}
              {assessment.migrationScore !== undefined && (
                <Chip
                  icon={<Speed sx={{ fontSize: 14 }} />}
                  label={`Score: ${assessment.migrationScore}/100`}
                  size="small"
                  sx={{
                    bgcolor: getScoreColor(assessment.migrationScore),
                    color: 'white',
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: 'white' },
                  }}
                />
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'error.dark' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography color="error.contrastText">{error}</Typography>
            <Button size="small" onClick={() => setError(null)} sx={{ color: 'error.contrastText' }}>
              Dismiss
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Questionnaire" />
          <Tab
            icon={<Radar sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Environment Scan"
          />
          <Tab
            label="Assessment Report"
            disabled={assessment.status !== 'completed'}
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <AtlassianQuestionnaire
          assessmentId={assessmentId!}
          companyName={assessment.companyName}
          questionnaire={questionnaire}
          questionnaireCategories={questionnaireCategories}
          responses={responses}
          actionLoading={actionLoading}
          actionType={actionType === 'rescan' ? null : actionType}
          onGenerateQuestionnaire={handleGenerateQuestionnaire}
          onUpdateResponse={handleUpdateResponse}
          onSaveResponses={handleSaveResponses}
          onRunAnalysis={handleRunAnalysis}
          onComplete={handleComplete}
        />
      )}

      {activeTab === 1 && (
        <AtlassianEnvironmentScan
          assessmentId={assessmentId!}
          companyName={assessment.companyName}
          environmentData={assessment.environmentData}
          onScanComplete={handleScanComplete}
          onRescan={handleRescan}
          isRescanning={actionLoading && actionType === 'rescan'}
        />
      )}

      {activeTab === 2 && assessment.analysisResult && (
        <AtlassianAssessmentReport
          assessment={assessment}
          analysis={assessment.analysisResult}
          onRerunAnalysis={async () => {
            await handleRunAnalysis();
          }}
          isRerunning={actionLoading && actionType === 'analyze'}
        />
      )}
    </Container>
  );
};

export default AtlassianAssessmentDetailPage;
