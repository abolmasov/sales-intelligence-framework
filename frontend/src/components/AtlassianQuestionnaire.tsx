import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  LinearProgress,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Cloud,
  PlayArrow,
  Save,
} from '@mui/icons-material';
import {
  QuestionnaireQuestion,
  QuestionnaireCategory,
  QuestionnaireResponses,
  AssessmentAnalysis,
} from '../types/atlassianAssessment';

interface AtlassianQuestionnaireProps {
  assessmentId: string;
  companyName: string;
  // Data from parent
  questionnaire: QuestionnaireQuestion[] | null;
  questionnaireCategories: Record<string, QuestionnaireCategory> | null;
  responses: QuestionnaireResponses;
  // Loading state
  actionLoading: boolean;
  actionType: 'generate' | 'save' | 'analyze' | null;
  // Callbacks
  onGenerateQuestionnaire: () => Promise<void>;
  onUpdateResponse: (questionId: string, value: any) => void;
  onSaveResponses: (responses: QuestionnaireResponses) => Promise<boolean>;
  onRunAnalysis: () => Promise<AssessmentAnalysis | null>;
  onComplete?: () => void;
}

const categoryOrder = ['environment', 'usage', 'painPoints', 'requirements', 'timeline'];

const AtlassianQuestionnaire: React.FC<AtlassianQuestionnaireProps> = ({
  assessmentId,
  companyName,
  questionnaire,
  questionnaireCategories,
  responses,
  actionLoading,
  actionType,
  onGenerateQuestionnaire,
  onUpdateResponse,
  onSaveResponses,
  onRunAnalysis,
  onComplete,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Derive loading states from actionType
  const isGenerating = actionLoading && actionType === 'generate';
  const isSaving = actionLoading && actionType === 'save';
  const isAnalyzing = actionLoading && actionType === 'analyze';

  // Generate questionnaire on mount if not already loaded
  useEffect(() => {
    if (!questionnaire) {
      onGenerateQuestionnaire();
    }
  }, []);

  // Get questions grouped by category
  const questionsByCategory = questionnaire?.reduce((acc, q) => {
    if (!acc[q.category]) {
      acc[q.category] = [];
    }
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, QuestionnaireQuestion[]>) || {};

  const orderedCategories = categoryOrder.filter(cat => questionsByCategory[cat]?.length > 0);
  const currentCategory = orderedCategories[activeStep];
  const currentQuestions = questionsByCategory[currentCategory] || [];
  const categoryInfo = questionnaireCategories?.[currentCategory];

  // Validate current step
  const validateCurrentStep = () => {
    const errors: Record<string, string> = {};
    let isValid = true;

    for (const question of currentQuestions) {
      if (question.required) {
        const value = responses[question.id];
        if (
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0)
        ) {
          errors[question.id] = 'This field is required';
          isValid = false;
        }
      }
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) return;

    // Save progress
    await onSaveResponses(responses);

    if (activeStep < orderedCategories.length - 1) {
      setActiveStep(activeStep + 1);
      setValidationErrors({});
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
      setValidationErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    // Save final responses
    const saved = await onSaveResponses(responses);
    if (!saved) return;

    // Run analysis
    const analysis = await onRunAnalysis();
    if (analysis) {
      onComplete?.();
    }
  };

  // Render question input based on type
  const renderQuestionInput = (question: QuestionnaireQuestion) => {
    const value = responses[question.id];
    const hasError = !!validationErrors[question.id];

    switch (question.type) {
      case 'text':
        return (
          <TextField
            fullWidth
            value={value || ''}
            onChange={(e) => onUpdateResponse(question.id, e.target.value)}
            placeholder={question.placeholder}
            error={hasError}
            helperText={validationErrors[question.id]}
            size="small"
          />
        );

      case 'textarea':
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            value={value || ''}
            onChange={(e) => onUpdateResponse(question.id, e.target.value)}
            placeholder={question.placeholder}
            error={hasError}
            helperText={validationErrors[question.id]}
          />
        );

      case 'select':
        return (
          <FormControl fullWidth error={hasError} size="small">
            <Select
              value={value || ''}
              onChange={(e) => onUpdateResponse(question.id, e.target.value)}
              displayEmpty
            >
              <MenuItem value="" disabled>
                <em>Select an option</em>
              </MenuItem>
              {question.options?.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
            {hasError && <FormHelperText>{validationErrors[question.id]}</FormHelperText>}
          </FormControl>
        );

      case 'multiselect':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <FormControl component="fieldset" error={hasError}>
            <FormGroup>
              {question.options?.map((option) => (
                <FormControlLabel
                  key={option}
                  control={
                    <Checkbox
                      checked={selectedValues.includes(option)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onUpdateResponse(question.id, [...selectedValues, option]);
                        } else {
                          onUpdateResponse(
                            question.id,
                            selectedValues.filter((v: string) => v !== option)
                          );
                        }
                      }}
                      size="small"
                    />
                  }
                  label={option}
                  sx={{ '& .MuiTypography-root': { fontSize: '0.9rem' } }}
                />
              ))}
            </FormGroup>
            {hasError && <FormHelperText>{validationErrors[question.id]}</FormHelperText>}
          </FormControl>
        );

      case 'boolean':
        return (
          <RadioGroup
            value={value === undefined ? '' : String(value)}
            onChange={(e) => onUpdateResponse(question.id, e.target.value === 'true')}
          >
            <FormControlLabel value="true" control={<Radio size="small" />} label="Yes" />
            <FormControlLabel value="false" control={<Radio size="small" />} label="No" />
          </RadioGroup>
        );

      default:
        return null;
    }
  };

  // Loading state
  if (isGenerating) {
    return (
      <Paper sx={{ p: 4 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography>Generating questionnaire for {companyName}...</Typography>
        </Stack>
      </Paper>
    );
  }

  // No questionnaire loaded
  if (!questionnaire || questionnaire.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <AutoAwesome sx={{ fontSize: 48, color: '#0052CC', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Ready to start the assessment
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          We'll ask you a series of questions about {companyName}'s Atlassian environment to
          generate a personalized migration assessment.
        </Typography>
        <Button
          variant="contained"
          startIcon={<PlayArrow />}
          onClick={onGenerateQuestionnaire}
          sx={{ bgcolor: '#0052CC', '&:hover': { bgcolor: '#0747A6' } }}
        >
          Start Questionnaire
        </Button>
      </Paper>
    );
  }

  // Calculate progress
  const totalRequired = questionnaire.filter((q) => q.required).length;
  const answeredRequired = questionnaire.filter(
    (q) => q.required && responses[q.id] !== undefined && responses[q.id] !== ''
  ).length;
  const progressPercent = totalRequired > 0 ? (answeredRequired / totalRequired) * 100 : 0;

  return (
    <Paper sx={{ p: 0, overflow: 'hidden' }}>
      {/* Progress Header */}
      <Box sx={{ p: 3, bgcolor: 'rgba(0, 82, 204, 0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Cloud sx={{ color: '#0052CC' }} />
            <Typography variant="h6">Migration Assessment Questionnaire</Typography>
          </Stack>
          <Chip
            icon={<CheckCircle sx={{ fontSize: 16 }} />}
            label={`${answeredRequired}/${totalRequired} required`}
            size="small"
            color={progressPercent === 100 ? 'success' : 'default'}
          />
        </Stack>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.1)',
            '& .MuiLinearProgress-bar': {
              bgcolor: progressPercent === 100 ? '#10b981' : '#0052CC',
              borderRadius: 3,
            },
          }}
        />
      </Box>

      {/* Stepper */}
      <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {orderedCategories.map((category, index) => (
            <Step key={category} completed={index < activeStep}>
              <StepLabel>
                {questionnaireCategories?.[category]?.title || category}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Questions */}
      <Box sx={{ p: 3 }}>
        {categoryInfo && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {categoryInfo.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {categoryInfo.description}
            </Typography>
          </Box>
        )}

        <Stack spacing={3}>
          {currentQuestions.map((question, idx) => (
            <Paper
              key={question.id}
              variant="outlined"
              sx={{
                p: 2.5,
                bgcolor: validationErrors[question.id] ? 'rgba(244, 67, 54, 0.05)' : 'transparent',
                borderColor: validationErrors[question.id] ? 'error.main' : 'divider',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    bgcolor: 'rgba(0, 82, 204, 0.1)',
                    color: '#0052CC',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                >
                  {idx + 1}
                </Typography>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" fontWeight={500}>
                    {question.question}
                    {question.required && (
                      <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>
                        *
                      </Typography>
                    )}
                  </Typography>
                </Box>
              </Stack>
              {renderQuestionInput(question)}
            </Paper>
          ))}
        </Stack>
      </Box>

      {/* Navigation */}
      <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Stack direction="row" justifyContent="space-between">
          <Button
            startIcon={<ChevronLeft />}
            onClick={handleBack}
            disabled={activeStep === 0 || actionLoading}
          >
            Back
          </Button>

          <Stack direction="row" spacing={2}>
            <Button
              startIcon={isSaving ? <CircularProgress size={16} /> : <Save />}
              onClick={() => onSaveResponses(responses)}
              disabled={actionLoading}
              variant="outlined"
            >
              {isSaving ? 'Saving...' : 'Save Progress'}
            </Button>

            {activeStep === orderedCategories.length - 1 ? (
              <Button
                variant="contained"
                endIcon={isAnalyzing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
                onClick={handleSubmit}
                disabled={actionLoading}
                sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.main' } }}
              >
                {isAnalyzing ? 'Analyzing...' : 'Generate Assessment'}
              </Button>
            ) : (
              <Button
                variant="contained"
                endIcon={<ChevronRight />}
                onClick={handleNext}
                disabled={actionLoading}
                sx={{ bgcolor: '#0052CC', '&:hover': { bgcolor: '#0747A6' } }}
              >
                Next
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
};

export default AtlassianQuestionnaire;
