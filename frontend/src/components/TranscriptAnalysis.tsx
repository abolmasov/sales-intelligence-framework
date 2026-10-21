import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Assessment as AnalysisIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandIcon,
  TrendingUp as OpportunityIcon,
  Warning as RiskIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

interface OpportunityAnalysis {
  has_opportunity: boolean;
  confidence: number;
  opportunity_probability: number;
  top_signals: Array<[string, number]>;
}

interface BuyerSignals {
  positive: string[];
  concerns: string[];
  competitors: string[];
}

interface RiskAssessment {
  red_flags: string[];
  close_likelihood: string;
  predicted_timeline: string;
}

interface AIInsights {
  status: string;
  insights: {
    executive_summary: string;
    opportunities: string[];
    buyer_signals: BuyerSignals;
    next_steps: string[];
    risk_assessment: RiskAssessment;
    overall_score: number;
  };
  ml_prediction: OpportunityAnalysis;
}

interface AnalysisResult {
  timestamp: string;
  transcript_length: number;
  word_count: number;
  chunked: boolean;
  num_chunks?: number;
  ml_analysis: OpportunityAnalysis;
  ai_insights: AIInsights;
}

const TranscriptAnalysis: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [modelTrained, setModelTrained] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    opportunities: true,
    signals: true,
    nextSteps: true,
    risk: true,
    mlAnalysis: false,
  });

  // Check model status on mount
  React.useEffect(() => {
    checkModelStatus();
  }, []);

  const checkModelStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/transcripts/health`);
      setModelTrained(response.data.model_loaded);
    } catch (err) {
      console.error('Failed to check model status:', err);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setAnalysisResult(null);
    }
  };

  const handleTrainModel = async () => {
    setUploading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/transcripts/sample-training`);
      setModelTrained(true);
      alert(`Model trained successfully!\nAccuracy: ${(response.data.accuracy * 100).toFixed(1)}%\nTraining examples: ${response.data.training_examples}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to train model');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzeFile = async () => {
    if (!selectedFile) return;

    setAnalyzing(true);
    setError(null);

    try {
      // Read file content
      const text = await selectedFile.text();

      // Analyze transcript
      const response = await axios.post(`${API_URL}/api/transcripts/analyze`, {
        transcript: text,
        use_chunking: true,
        filename: selectedFile.name,
      });

      setAnalysisResult(response.data.results);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to analyze transcript');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'success';
    if (confidence >= 0.5) return 'warning';
    return 'error';
  };

  const getLikelihoodColor = (likelihood: string) => {
    if (likelihood === 'High') return 'success';
    if (likelihood === 'Medium') return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#fff', mb: 3 }}>
        Call Transcript Analysis
      </Typography>

      {/* Model Status */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ color: '#fff' }}>
              ML Model Status:
            </Typography>
            <Chip
              label={modelTrained ? 'Trained' : 'Not Trained'}
              color={modelTrained ? 'success' : 'warning'}
              icon={modelTrained ? <SuccessIcon /> : <ErrorIcon />}
            />
          </Box>
          {!modelTrained && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleTrainModel}
              disabled={uploading}
            >
              Train Model with Sample Data
            </Button>
          )}
        </Box>
      </Paper>

      {/* Upload Section */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
        <Typography variant="h6" gutterBottom sx={{ color: '#fff' }}>
          Upload Transcript
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <input
            accept=".txt,.json"
            style={{ display: 'none' }}
            id="transcript-upload"
            type="file"
            onChange={handleFileSelect}
          />
          <label htmlFor="transcript-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadIcon />}
            >
              Select File
            </Button>
          </label>

          {selectedFile && (
            <Typography sx={{ color: '#fff' }}>
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </Typography>
          )}
        </Box>

        <Button
          variant="contained"
          color="primary"
          onClick={handleAnalyzeFile}
          disabled={!selectedFile || analyzing || !modelTrained}
          startIcon={<AnalysisIcon />}
          fullWidth
        >
          {analyzing ? 'Analyzing...' : 'Analyze Transcript'}
        </Button>

        {analyzing && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Analysis Results */}
      {analysisResult && analysisResult.ai_insights.status === 'success' && (
        <Box>
          {/* Overall Score */}
          <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3 }}>
              <Box>
                <Typography variant="body2" sx={{ color: '#aaa' }}>
                  Overall Score
                </Typography>
                <Typography variant="h3" sx={{ color: '#4caf50' }}>
                  {analysisResult.ai_insights.insights.overall_score}/100
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: '#aaa' }}>
                  Opportunity Detected
                </Typography>
                <Chip
                  label={analysisResult.ml_analysis.has_opportunity ? 'YES' : 'NO'}
                  color={analysisResult.ml_analysis.has_opportunity ? 'success' : 'default'}
                  sx={{ mt: 1 }}
                />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: '#aaa' }}>
                  Confidence
                </Typography>
                <Chip
                  label={`${(analysisResult.ml_analysis.confidence * 100).toFixed(1)}%`}
                  color={getConfidenceColor(analysisResult.ml_analysis.confidence)}
                  sx={{ mt: 1 }}
                />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: '#aaa' }}>
                  Word Count
                </Typography>
                <Typography variant="h5" sx={{ color: '#fff', mt: 1 }}>
                  {analysisResult.word_count.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Executive Summary */}
          <Card sx={{ mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#fff' }}>
                Executive Summary
              </Typography>
              <Typography sx={{ color: '#e0e0e0' }}>
                {analysisResult.ai_insights.insights.executive_summary}
              </Typography>
            </CardContent>
          </Card>

          {/* Opportunities */}
          <Card sx={{ mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <OpportunityIcon sx={{ color: '#4caf50' }} />
                  <Typography variant="h6" sx={{ color: '#fff' }}>
                    Identified Opportunities
                  </Typography>
                </Box>
                <IconButton onClick={() => toggleSection('opportunities')}>
                  <ExpandIcon sx={{ color: '#fff', transform: expandedSections.opportunities ? 'rotate(180deg)' : 'none' }} />
                </IconButton>
              </Box>
              <Collapse in={expandedSections.opportunities}>
                <List>
                  {analysisResult.ai_insights.insights.opportunities.map((opp, idx) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={opp}
                        sx={{ color: '#e0e0e0' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </CardContent>
          </Card>

          {/* Buyer Signals */}
          <Card sx={{ mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ color: '#fff' }}>
                  Key Buyer Signals
                </Typography>
                <IconButton onClick={() => toggleSection('signals')}>
                  <ExpandIcon sx={{ color: '#fff', transform: expandedSections.signals ? 'rotate(180deg)' : 'none' }} />
                </IconButton>
              </Box>
              <Collapse in={expandedSections.signals}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mt: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#4caf50', mb: 1 }}>
                      Positive Signals
                    </Typography>
                    <List dense>
                      {analysisResult.ai_insights.insights.buyer_signals.positive.map((signal, idx) => (
                        <ListItem key={idx}>
                          <ListItemText primary={signal} sx={{ color: '#e0e0e0' }} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#ff9800', mb: 1 }}>
                      Concerns
                    </Typography>
                    <List dense>
                      {analysisResult.ai_insights.insights.buyer_signals.concerns.map((concern, idx) => (
                        <ListItem key={idx}>
                          <ListItemText primary={concern} sx={{ color: '#e0e0e0' }} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#f44336', mb: 1 }}>
                      Competitors Mentioned
                    </Typography>
                    <List dense>
                      {analysisResult.ai_insights.insights.buyer_signals.competitors.map((comp, idx) => (
                        <ListItem key={idx}>
                          <ListItemText primary={comp} sx={{ color: '#e0e0e0' }} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Box>
              </Collapse>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card sx={{ mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ color: '#fff' }}>
                  Recommended Next Steps
                </Typography>
                <IconButton onClick={() => toggleSection('nextSteps')}>
                  <ExpandIcon sx={{ color: '#fff', transform: expandedSections.nextSteps ? 'rotate(180deg)' : 'none' }} />
                </IconButton>
              </Box>
              <Collapse in={expandedSections.nextSteps}>
                <List>
                  {analysisResult.ai_insights.insights.next_steps.map((step, idx) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={`${idx + 1}. ${step}`}
                        sx={{ color: '#e0e0e0' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          <Card sx={{ mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RiskIcon sx={{ color: '#ff9800' }} />
                  <Typography variant="h6" sx={{ color: '#fff' }}>
                    Risk Assessment
                  </Typography>
                </Box>
                <IconButton onClick={() => toggleSection('risk')}>
                  <ExpandIcon sx={{ color: '#fff', transform: expandedSections.risk ? 'rotate(180deg)' : 'none' }} />
                </IconButton>
              </Box>
              <Collapse in={expandedSections.risk}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mt: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#aaa', mb: 1 }}>
                      Close Likelihood
                    </Typography>
                    <Chip
                      label={analysisResult.ai_insights.insights.risk_assessment.close_likelihood}
                      color={getLikelihoodColor(analysisResult.ai_insights.insights.risk_assessment.close_likelihood)}
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#aaa', mb: 1 }}>
                      Predicted Timeline
                    </Typography>
                    <Typography sx={{ color: '#fff' }}>
                      {analysisResult.ai_insights.insights.risk_assessment.predicted_timeline}
                    </Typography>
                  </Box>
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="subtitle2" sx={{ color: '#f44336', mb: 1 }}>
                      Red Flags
                    </Typography>
                    <List dense>
                      {analysisResult.ai_insights.insights.risk_assessment.red_flags.map((flag, idx) => (
                        <ListItem key={idx}>
                          <ListItemText primary={flag} sx={{ color: '#e0e0e0' }} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Box>
              </Collapse>
            </CardContent>
          </Card>

          {/* ML Analysis Details */}
          <Card sx={{ bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ color: '#fff' }}>
                  ML Model Analysis
                </Typography>
                <IconButton onClick={() => toggleSection('mlAnalysis')}>
                  <ExpandIcon sx={{ color: '#fff', transform: expandedSections.mlAnalysis ? 'rotate(180deg)' : 'none' }} />
                </IconButton>
              </Box>
              <Collapse in={expandedSections.mlAnalysis}>
                <Typography variant="body2" sx={{ color: '#aaa', mt: 2 }}>
                  Top Detected Signals:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {analysisResult.ml_analysis.top_signals.map(([signal, count], idx) => (
                    <Chip
                      key={idx}
                      label={`${signal.replace('_', ' ')}: ${count}`}
                      size="small"
                      sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)', color: '#4caf50' }}
                    />
                  ))}
                </Box>
                {analysisResult.chunked && (
                  <Typography variant="body2" sx={{ color: '#aaa', mt: 2 }}>
                    Analyzed in {analysisResult.num_chunks} chunks
                  </Typography>
                )}
              </Collapse>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default TranscriptAnalysis;
