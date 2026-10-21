import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardActionArea,
  IconButton,
  Chip,
  Stack,
  Divider,
  Avatar,
  Tabs,
  Tab,
  Fade,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  CloudUpload,
  TextFields,
  Assessment,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Warning,
  Person,
  ShoppingCart,
  Business,
  Timeline,
  Flag,
  AutoAwesome,
  Group,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

interface TranscriptAnalysisProps {}

const EnhancedTranscriptAnalysis: React.FC<TranscriptAnalysisProps> = () => {
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');
  const [transcriptText, setTranscriptText] = useState('');
  const [context, setContext] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setAnalysis(null);

      // Read file content automatically
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setTranscriptText(content);
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    if (!transcriptText.trim()) {
      setError('Please enter or upload a transcript');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await axios.post(`${API_URL}/api/transcripts/analyze-enhanced`, {
        transcriptText: transcriptText,
        meetingTitle: context,
        companyName: companyName || undefined,
      });

      setAnalysis(response.data.data.analysis);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to analyze transcript');
    } finally {
      setAnalyzing(false);
    }
  };

  // Load saved analyses on mount
  const loadSavedAnalyses = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(`${API_URL}/api/transcripts`);
      setSavedAnalyses(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to load saved analyses:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadAnalysis = async (analysisId: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/transcripts/${analysisId}`);
      const data = response.data.data;

      setAnalysis(data.analysisResult ? JSON.parse(data.analysisResult) : null);
      setTranscriptText(data.transcriptText || '');
      setCompanyName(data.companyName || '');
      setContext(data.meetingTitle || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load analysis');
    }
  };

  React.useEffect(() => {
    loadSavedAnalyses();
  }, []);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '#10b981';
      case 'negative':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <Box>
      {/* Saved Analyses History */}
      {savedAnalyses.length > 0 && (
        <Card elevation={0} sx={{ mb: 3, borderRadius: 3, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
          <CardHeader
            title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Past Transcript Analyses</Typography>}
            subheader={`${savedAnalyses.length} saved ${savedAnalyses.length === 1 ? 'analysis' : 'analyses'}`}
          />
          <CardContent>
            <Stack spacing={2}>
              {savedAnalyses.map((saved: any) => (
                <Card
                  key={saved.analysisId}
                  elevation={0}
                  sx={{
                    borderColor: 'divider',
                    '&:hover': {
                      borderColor: '#2563eb',
                      backgroundColor: 'info.light',
                    },
                  }}
                >
                  <CardActionArea onClick={() => loadAnalysis(saved.analysisId)}>
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                            {saved.companyName || 'Transcript Analysis'}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            {saved.meetingTitle || 'Call Transcript Review'}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Chip
                              label={`Score: ${saved.opportunityScore || 0}/100`}
                              size="small"
                              sx={{ bgcolor: 'info.light', color: 'secondary.main', fontWeight: 600 }}
                            />
                            <Chip
                              label={new Date(saved.analyzedAt).toLocaleDateString()}
                              size="small"
                              sx={{ bgcolor: 'action.hover', color: 'text.secondary' }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <Card
        elevation={0}
        sx={{
          mb: 4,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid #334155',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #2563eb 0%, #10b981 100%)',
          },
        }}
      >
        <CardHeader
          avatar={
            <Avatar
              sx={{
                bgcolor: 'rgba(37, 99, 235, 0.1)',
                border: '2px solid #2563eb',
                width: 56,
                height: 56,
              }}
            >
              <Assessment sx={{ fontSize: 28, color: 'secondary.main' }} />
            </Avatar>
          }
          title={
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
              AI-Powered Transcript Analysis
            </Typography>
          }
          subheader={
            <Typography variant="body2" sx={{ color: 'text.disabled', mt: 0.5 }}>
              Analyze sales conversations with opportunity detection, sentiment analysis, and product/service matching
            </Typography>
          }
        />
      </Card>

      {/* Input Section */}
      <Card elevation={0} sx={{ mb: 4, borderRadius: 3, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 3 }}>
          <Tabs
            value={inputMethod}
            onChange={(_, value) => setInputMethod(value)}
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              icon={<TextFields />}
              iconPosition="start"
              label="Paste Text"
              value="text"
              sx={{ textTransform: 'none', fontSize: '1rem', fontWeight: 600 }}
            />
            <Tab
              icon={<CloudUpload />}
              iconPosition="start"
              label="Upload File"
              value="file"
              sx={{ textTransform: 'none', fontSize: '1rem', fontWeight: 600 }}
            />
          </Tabs>

          {inputMethod === 'text' ? (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', fontWeight: 500 }}>
                Paste any sales conversation content below:
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={16}
                label="Transcript / Conversation Text"
                placeholder={`Paste any of the following:
• Sales call transcripts
• Meeting notes or recordings
• Email threads
• Slack/Teams conversations
• Discovery call summaries
• Customer interviews
• Proposal discussions

The AI will analyze the content for opportunity signals, sentiment, pain points, and recommend relevant Atlassian/ServiceNow products and Northstar Integrators services.`}
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'monospace',
                    fontSize: '0.95rem',
                    backgroundColor: 'background.paper',
                    border: '2px solid #e2e8f0',
                    '&:hover': {
                      backgroundColor: 'background.paper',
                      borderColor: '#cbd5e1',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'background.paper',
                      borderColor: '#2563eb',
                    },
                  },
                  '& .MuiOutlinedInput-input': {
                    color: 'text.primary',
                    lineHeight: 1.7,
                    '&::placeholder': {
                      color: 'text.disabled',
                      opacity: 1,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'text.secondary',
                    fontWeight: 600,
                    '&.Mui-focused': {
                      color: 'secondary.main',
                    },
                  },
                }}
              />
              {transcriptText && (
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Chip
                    label={`${transcriptText.length} characters`}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                  <Chip
                    label={`${transcriptText.split(' ').length} words`}
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  />
                  <Chip
                    label={`~${Math.ceil(transcriptText.split(' ').length / 200)} min read`}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ mb: 3 }}>
              <input
                accept=".txt,.md,.doc,.docx"
                style={{ display: 'none' }}
                id="transcript-file-upload"
                type="file"
                onChange={handleFileSelect}
              />
              <label htmlFor="transcript-file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUpload />}
                  fullWidth
                  sx={{
                    py: 3,
                    border: '2px dashed #cbd5e1',
                    '&:hover': {
                      border: '2px dashed #2563eb',
                      backgroundColor: 'info.light',
                    },
                  }}
                >
                  {selectedFile ? `Selected: ${selectedFile.name}` : 'Click to upload .txt, .md, or .doc file'}
                </Button>
              </label>
              {transcriptText && (
                <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                  {transcriptText.split(' ').length} words loaded
                </Typography>
              )}
            </Box>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 3 }}>
            <Box>
              <TextField
                fullWidth
                label="Company Name (Optional)"
                placeholder="e.g., Microsoft"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Context (Optional)"
                placeholder="e.g., First discovery call about ITSM needs"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={analyzing ? <AutoAwesome className="spin" /> : <Assessment />}
              onClick={handleAnalyze}
              disabled={!transcriptText.trim() || analyzing}
              sx={{
                py: 2,
                background: 'linear-gradient(45deg, #2563eb 30%, #3b82f6 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1e40af 30%, #2563eb 90%)',
                },
              }}
            >
              {analyzing ? 'Analyzing with AI...' : 'Analyze Transcript'}
            </Button>

            {/* TODO: Enable save button after implementing backend endpoint */}
            {/* {analysis && (
              <Button
                variant="outlined"
                size="large"
                startIcon={<CheckCircle />}
                onClick={handleSaveAnalysis}
                disabled={saving}
                sx={{
                  py: 2,
                  minWidth: '180px',
                  borderColor: saveSuccess ? '#10b981' : '#2563eb',
                  color: saveSuccess ? '#10b981' : '#2563eb',
                  '&:hover': {
                    borderColor: saveSuccess ? '#059669' : '#1e40af',
                    backgroundColor: saveSuccess ? 'rgba(16, 185, 129, 0.04)' : 'rgba(37, 99, 235, 0.04)',
                  },
                }}
              >
                {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Analysis'}
              </Button>
            )} */}
          </Box>

          {analyzing && <LinearProgress sx={{ mt: 2 }} />}
        </CardContent>
      </Card>

      {/* Success Message */}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Analysis saved successfully! View it in Past Analyses.
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Analysis Results */}
      {analysis && (
        <Fade in={true} timeout={500}>
          <Box>
            {/* Opportunity Score & Sentiment */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mb: 4 }}>
              <Box>
                <Card elevation={0} sx={{ borderRadius: 3, border: `2px solid ${getScoreColor(analysis.opportunity_score)}` }}>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h2" sx={{ fontWeight: 700, color: getScoreColor(analysis.opportunity_score) }}>
                      {analysis.opportunity_score}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                      Opportunity Score
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Box>
                <Card elevation={0} sx={{ borderRadius: 3, border: `2px solid ${getSentimentColor(analysis.sentiment?.overall)}` }}>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: getSentimentColor(analysis.sentiment?.overall), textTransform: 'capitalize' }}>
                      {analysis.sentiment?.overall}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                      Overall Sentiment
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2, flexWrap: 'wrap' }}>
                      {analysis.sentiment?.key_emotions?.map((emotion: string, idx: number) => (
                        <Chip key={idx} label={emotion} size="small" />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              <Box>
                <Card elevation={0} sx={{ borderRadius: 3, border: '2px solid #e2e8f0' }}>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'secondary.main', textTransform: 'capitalize' }}>
                      {analysis.sentiment?.engagement_level}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                      Engagement Level
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.disabled', mt: 2 }}>
                      Success Probability: {((analysis.success_probability || 0) * 100).toFixed(0)}%
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>

            {/* Executive Summary */}
            <Card elevation={0} sx={{ mb: 4, borderRadius: 3, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
              <CardHeader
                avatar={<AutoAwesome sx={{ color: 'secondary.main' }} />}
                title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Executive Summary</Typography>}
              />
              <CardContent>
                <Typography variant="body1" sx={{ lineHeight: 1.8, color: 'text.primary' }}>
                  {analysis.executive_summary}
                </Typography>
              </CardContent>
            </Card>

            {/* Buying Signals */}
            {analysis.buying_signals && analysis.buying_signals.length > 0 && (
              <Card elevation={0} sx={{ mb: 4, borderRadius: 3, border: '1px solid #d1fae5' }}>
                <CardHeader
                  avatar={<TrendingUp sx={{ color: 'success.main' }} />}
                  title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Buying Signals ({analysis.buying_signals.length})</Typography>}
                />
                <CardContent>
                  <Stack spacing={2}>
                    {analysis.buying_signals.map((signal: any, idx: number) => (
                      <Box key={idx} sx={{ p: 2, backgroundColor: '#f0fdf4', borderRadius: 2, border: '1px solid #86efac' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Chip
                            label={signal.strength}
                            size="small"
                            sx={{
                              backgroundColor: signal.strength === 'strong' ? '#10b981' : signal.strength === 'medium' ? '#f59e0b' : '#94a3b8',
                              color: 'white',
                              fontWeight: 600,
                            }}
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#065f46' }}>
                            {signal.signal}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: '#047857', fontStyle: 'italic' }}>
                          "{signal.evidence}"
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Pain Points */}
            {analysis.pain_points && analysis.pain_points.length > 0 && (
              <Card elevation={0} sx={{ mb: 4, borderRadius: 3, border: '1px solid #fecaca' }}>
                <CardHeader
                  avatar={<Warning sx={{ color: 'error.main' }} />}
                  title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Pain Points ({analysis.pain_points.length})</Typography>}
                />
                <CardContent>
                  <Stack spacing={2}>
                    {analysis.pain_points.map((pain: any, idx: number) => (
                      <Box key={idx} sx={{ p: 2, backgroundColor: 'error.light', borderRadius: 2, border: '1px solid #fca5a5' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Chip
                            label={pain.severity}
                            size="small"
                            sx={{
                              backgroundColor: pain.severity === 'critical' ? '#ef4444' : pain.severity === 'high' ? '#f59e0b' : '#94a3b8',
                              color: 'white',
                              fontWeight: 600,
                            }}
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#991b1b' }}>
                            {pain.pain_point}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: '#7f1d1d', fontStyle: 'italic' }}>
                          "{pain.evidence}"
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Recommended Products & Services */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mb: 4 }}>
              {analysis.recommended_products?.atlassian && analysis.recommended_products.atlassian.length > 0 && (
                <Box>
                  <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbeafe' }}>
                    <CardHeader
                      avatar={<ShoppingCart sx={{ color: 'secondary.main' }} />}
                      title={<Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Atlassian Products</Typography>}
                    />
                    <CardContent>
                      <List dense>
                        {analysis.recommended_products.atlassian.map((product: any, idx: number) => (
                          <ListItem key={idx} sx={{ px: 0 }}>
                            <ListItemIcon>
                              <CheckCircle sx={{ color: 'secondary.main', fontSize: 20 }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={product.product}
                              secondary={product.relevance}
                              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                              secondaryTypographyProps={{ fontSize: '0.75rem' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {analysis.recommended_products?.servicenow && analysis.recommended_products.servicenow.length > 0 && (
                <Box>
                  <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #dcfce7' }}>
                    <CardHeader
                      avatar={<ShoppingCart sx={{ color: 'success.main' }} />}
                      title={<Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>ServiceNow Modules</Typography>}
                    />
                    <CardContent>
                      <List dense>
                        {analysis.recommended_products.servicenow.map((module: any, idx: number) => (
                          <ListItem key={idx} sx={{ px: 0 }}>
                            <ListItemIcon>
                              <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={module.module}
                              secondary={module.relevance}
                              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                              secondaryTypographyProps={{ fontSize: '0.75rem' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {analysis.recommended_products?.enterprise_services && analysis.recommended_products.enterprise_services.length > 0 && (
                <Box>
                  <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #fef3c7' }}>
                    <CardHeader
                      avatar={<Business sx={{ color: 'warning.main' }} />}
                      title={<Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Northstar Integrators Services</Typography>}
                    />
                    <CardContent>
                      <List dense>
                        {analysis.recommended_products.enterprise_services.map((service: any, idx: number) => (
                          <ListItem key={idx} sx={{ px: 0 }}>
                            <ListItemIcon>
                              <CheckCircle sx={{ color: 'warning.main', fontSize: 20 }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={service.service}
                              secondary={service.relevance}
                              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                              secondaryTypographyProps={{ fontSize: '0.75rem' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Box>
              )}
            </Box>

            {/* Recommended Team & Next Steps */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3 }}>
              {analysis.recommended_team && analysis.recommended_team.length > 0 && (
                <Box>
                  <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e7ff' }}>
                    <CardHeader
                      avatar={<Group sx={{ color: '#8b5cf6' }} />}
                      title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Recommended Team</Typography>}
                    />
                    <CardContent>
                      <Stack spacing={1.5}>
                        {analysis.recommended_team.map((member: any, idx: number) => (
                          <Box key={idx} sx={{ p: 2, backgroundColor: '#f5f3ff', borderRadius: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#5b21b6' }}>
                              {member.role}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#6d28d9', mt: 0.5 }}>
                              {member.reason}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {analysis.next_steps && analysis.next_steps.length > 0 && (
                <Box>
                  <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbeafe' }}>
                    <CardHeader
                      avatar={<Flag sx={{ color: 'secondary.main' }} />}
                      title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Next Steps</Typography>}
                    />
                    <CardContent>
                      <Stack spacing={1.5}>
                        {analysis.next_steps.map((step: any, idx: number) => (
                          <Box key={idx} sx={{ p: 2, backgroundColor: 'info.light', borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Chip label={step.priority} size="small" sx={{ fontWeight: 600 }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {step.timeline} • {step.owner}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                              {step.action}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              )}
            </Box>
          </Box>
        </Fade>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 2s linear infinite;
        }
      `}</style>
    </Box>
  );
};

export default EnhancedTranscriptAnalysis;
