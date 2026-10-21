import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Business,
  Assessment,
  Assignment,
  CheckCircle,
  Error,
  Pending,
} from '@mui/icons-material';
import { ResearchNodeProgress } from '../types';
import { API_BASE_URL } from '../config';

interface ProgressTrackerProps {
  sessionId: string;
  onComplete: (result: any) => void;
  onError: (error: string) => void;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ sessionId, onComplete, onError }) => {
  const [progress, setProgress] = useState<ResearchNodeProgress>({
    external_research: 'pending',
    integrator_cases: 'pending',
    library_cases: 'pending',
    report_generation: 'pending',
  });
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      label: 'External Research',
      description: 'Gathering company intelligence and market data',
      icon: <Search />,
      key: 'external_research',
    },
    {
      label: 'Northstar Integrators Case Studies',
      description: 'Finding relevant Northstar Integrators success stories',
      icon: <Business />,
      key: 'integrator_cases',
    },
    {
      label: 'Northstar library Case Studies',
      description: 'Identifying applicable Northstar library implementations',
      icon: <Assessment />,
      key: 'library_cases',
    },
    {
      label: 'Report Generation',
      description: 'Compiling comprehensive sales intelligence',
      icon: <Assignment />,
      key: 'report_generation',
    },
  ];

  useEffect(() => {
    let eventSource: EventSource;
    let pollInterval: NodeJS.Timeout;

    const connectToStream = () => {
      try {
        eventSource = new EventSource(
        `${API_BASE_URL}/api/research/${sessionId}/stream`,
          { withCredentials: true }
        );

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.error) {
            onError(data.error);
            return;
          }

          setProgress(data.progress);
          setCurrentStep(data.current_step);

          // Update active step based on progress
          const stepIndex = steps.findIndex(step => data.progress[step.key] === 'running');
          if (stepIndex !== -1) {
            setActiveStep(stepIndex);
          }

          // Check if completed
          if (data.status === 'completed') {
            setActiveStep(steps.length);
            fetchResult();
          } else if (data.status === 'error') {
            onError('Research failed');
          }
        };

        eventSource.onerror = () => {
          console.log('EventSource failed, falling back to polling');
          eventSource.close();
          startPolling();
        };
      } catch (error) {
        console.log('EventSource not supported, using polling');
        startPolling();
      }
    };

    const startPolling = () => {
      pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/research/${sessionId}/status`);
          if (response.ok) {
            const data = await response.json();
            setProgress(data.progress);
            setCurrentStep(data.current_step);

            const stepIndex = steps.findIndex(step => data.progress[step.key] === 'running');
            if (stepIndex !== -1) {
              setActiveStep(stepIndex);
            }

            if (data.status === 'completed') {
              setActiveStep(steps.length);
              clearInterval(pollInterval);
              fetchResult();
            } else if (data.status === 'error') {
              clearInterval(pollInterval);
              onError(data.error || 'Research failed');
            }
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }, 2000);
    };

    const fetchResult = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/research/${sessionId}/result`);
        if (response.ok) {
          const result = await response.json();
          onComplete(result);
        } else {
          onError('Failed to fetch results');
        }
      } catch (error) {
        onError('Error fetching results');
      }
    };

    connectToStream();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [sessionId, onComplete, onError]);

  const getStepIcon = (stepKey: string, stepIndex: number) => {
    const status = progress[stepKey as keyof ResearchNodeProgress];

    if (status === 'completed') {
      return <CheckCircle sx={{ color: 'success.main' }} />;
    } else if (status === 'running') {
      return <CircularProgress size={24} />;
    } else if (status === 'pending' && stepIndex <= activeStep) {
      return <Pending sx={{ color: 'action.active' }} />;
    } else {
      return steps[stepIndex].icon;
    }
  };

  const getStepStatus = (stepKey: string) => {
    const status = progress[stepKey as keyof ResearchNodeProgress];

    switch (status) {
      case 'completed':
        return <Chip label="Completed" color="success" size="small" />;
      case 'running':
        return <Chip label="Running" color="primary" size="small" />;
      case 'pending':
        return <Chip label="Pending" color="default" size="small" />;
      default:
        return null;
    }
  };

  const calculateOverallProgress = () => {
    const statuses = Object.values(progress);
    const completed = statuses.filter(status => status === 'completed').length;
    const running = statuses.filter(status => status === 'running').length;

    return ((completed + (running * 0.5)) / statuses.length) * 100;
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 4,
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        borderRadius: 3,
      }}
    >
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Research Progress
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {currentStep}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Math.round(calculateOverallProgress())}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={calculateOverallProgress()}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            },
          }}
        />
      </Box>

      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.key}>
            <StepLabel
              icon={getStepIcon(step.key, index)}
              sx={{
                '& .MuiStepLabel-labelContainer': {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {step.label}
                {getStepStatus(step.key)}
              </Box>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary">
                {step.description}
              </Typography>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {activeStep === steps.length && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" color="success.main" fontWeight="bold">
            Research Completed Successfully!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your comprehensive sales intelligence report is ready.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ProgressTracker;
