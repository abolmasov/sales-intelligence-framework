import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Alert,
  Divider,
} from '@mui/material';
import {
  Search,
  Business,
  Assessment,
  Assignment,
  CheckCircle,
  RadioButtonUnchecked,
  PlayArrow,
  ExpandMore,
  ExpandLess,
  Speed,
  Timeline,
} from '@mui/icons-material';
import { API_BASE_URL } from '../config';

interface EnhancedProgressTrackerProps {
  sessionId: string;
  companyName: string;
  onComplete: (result: any) => void;
  onError: (error: string) => void;
}

interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

const EnhancedProgressTracker: React.FC<EnhancedProgressTrackerProps> = ({
  sessionId,
  companyName,
  onComplete,
  onError
}) => {
  const [progress, setProgress] = useState({
    external_research: 'pending',
    news_intelligence: 'pending',
    integrator_cases: 'pending',
    library_cases: 'pending',
    report_generation: 'pending',
  });

  const [currentStep, setCurrentStep] = useState('Initializing research...');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  const steps = [
    {
      key: 'external_research',
      label: 'External Company Research',
      description: 'Gathering financial data, leadership info, strategic initiatives',
      icon: <Search />,
      color: '#00bcd4',
    },
    {
      key: 'news_intelligence',
      label: 'News Intelligence Analysis',
      description: 'Real-time news analysis from NewsData.io API for market insights',
      icon: <Timeline />,
      color: '#e91e63',
    },
    {
      key: 'integrator_cases',
      label: 'Northstar Integrators Case Study Analysis',
      description: 'Analyzing 100 Northstar Integrators case studies for relevance matching',
      icon: <Business />,
      color: '#ff9800',
    },
    {
      key: 'library_cases',
      label: 'Northstar library Case Study Analysis',
      description: 'Matching against 12 Northstar library implementation case studies',
      icon: <Assessment />,
      color: '#4caf50',
    },
    {
      key: 'report_generation',
      label: 'Intelligence Report Generation',
      description: 'Compiling comprehensive sales intelligence report',
      icon: <Assignment />,
      color: '#9c27b0',
    },
  ];

  const addLog = (message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const logEntry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      level,
    };
    setLogs(prev => [...prev, logEntry]);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  useEffect(() => {
    addLog(`Starting research for ${companyName}`, 'info');

    let pollInterval: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/research/${sessionId}/status`);
        if (response.ok) {
          const data = await response.json();

          // Update progress
          const newProgress = data.progress;
          setProgress(prev => {
            // Log changes
            Object.keys(newProgress).forEach(key => {
              if (prev[key as keyof typeof prev] !== newProgress[key]) {
                const step = steps.find(s => s.key === key);
                if (newProgress[key] === 'running') {
                  addLog(`${step?.label} started`, 'info');
                } else if (newProgress[key] === 'completed') {
                  addLog(`${step?.label} completed`, 'success');
                }
              }
            });
            return newProgress;
          });

          setCurrentStep(data.current_step);

          if (data.status === 'completed') {
            clearInterval(pollInterval);
            addLog('Research completed successfully', 'success');

            // Fetch final result
            try {
              const resultResponse = await fetch(`${API_BASE_URL}/api/research/${sessionId}/result`);
              if (resultResponse.ok) {
                const result = await resultResponse.json();
                onComplete(result);
              }
            } catch (error) {
              addLog('Failed to fetch final results', 'error');
              onError('Failed to fetch results');
            }
          } else if (data.status === 'error') {
            clearInterval(pollInterval);
            addLog(`Research failed: ${data.error}`, 'error');
            onError(data.error || 'Research failed');
          }
        }
      } catch (error) {
        addLog('Connection error, retrying...', 'warning');
      }
    };

    // Start polling
    pollInterval = setInterval(pollStatus, 2000);
    pollStatus(); // Initial call

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sessionId, companyName, onComplete, onError]);

  const getStepStatus = (stepKey: string) => {
    const status = progress[stepKey as keyof typeof progress];
    switch (status) {
      case 'completed':
        return { icon: <CheckCircle sx={{ color: '#4caf50' }} />, color: '#4caf50' };
      case 'running':
        return { icon: <PlayArrow sx={{ color: '#ff9800' }} />, color: '#ff9800' };
      default:
        return { icon: <RadioButtonUnchecked sx={{ color: '#666' }} />, color: '#666' };
    }
  };

  const calculateProgress = () => {
    const statuses = Object.values(progress);
    const completed = statuses.filter(s => s === 'completed').length;
    const running = statuses.filter(s => s === 'running').length;
    return ((completed + running * 0.5) / statuses.length) * 100;
  };

  const formatElapsedTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          mb: 3,
          background: 'linear-gradient(135deg, #00bcd4 0%, #26c6da 100%)',
          color: 'white',
          borderRadius: 3,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
              Researching: {companyName}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              {currentStep}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Speed sx={{ mr: 1 }} />
              <Typography variant="h6">
                {Math.round(calculateProgress())}% Complete
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Timeline sx={{ mr: 1 }} />
              <Typography variant="body1">
                Elapsed: {formatElapsedTime(elapsedTime)}
              </Typography>
            </Box>
          </Box>
        </Box>
        <LinearProgress
          variant="determinate"
          value={calculateProgress()}
          sx={{
            mt: 2,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.3)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              backgroundColor: 'white',
            },
          }}
        />
      </Paper>

      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Progress Steps */}
        <Card sx={{ flex: 2, borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
              Research Pipeline
            </Typography>

            <List sx={{ width: '100%' }}>
              {steps.map((step, index) => {
                const status = getStepStatus(step.key);
                const isActive = progress[step.key as keyof typeof progress] === 'running';

                return (
                  <React.Fragment key={step.key}>
                    <ListItem
                      sx={{
                        border: isActive ? `2px solid ${step.color}` : '1px solid #333',
                        borderRadius: 2,
                        mb: 2,
                        backgroundColor: isActive ? `${step.color}15` : 'transparent',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <ListItemIcon>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: status.color,
                            color: 'white',
                            mr: 1,
                          }}
                        >
                          {status.icon}
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                              {step.label}
                            </Typography>
                            <Chip
                              label={progress[step.key as keyof typeof progress]}
                              size="small"
                              sx={{
                                backgroundColor: status.color,
                                color: 'white',
                                fontWeight: 'bold',
                              }}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            {step.description}
                          </Typography>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          </CardContent>
        </Card>

        {/* Logs Panel */}
        <Card sx={{ flex: 1, borderRadius: 3 }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
                cursor: 'pointer'
              }}
              onClick={() => setShowLogs(!showLogs)}
            >
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Live Logs ({logs.length})
              </Typography>
              {showLogs ? <ExpandLess /> : <ExpandMore />}
            </Box>

            <Collapse in={showLogs}>
              <Box
                sx={{
                  maxHeight: 400,
                  overflowY: 'auto',
                  border: '1px solid #333',
                  borderRadius: 2,
                  p: 1,
                  backgroundColor: '#0a0a0a',
                }}
              >
                {logs.map((log, index) => (
                  <Alert
                    key={index}
                    severity={log.level}
                    variant="outlined"
                    sx={{
                      mb: 1,
                      fontSize: '0.8rem',
                      '& .MuiAlert-message': {
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%',
                      },
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                        {log.timestamp}
                      </Typography>
                      <br />
                      {log.message}
                    </Box>
                  </Alert>
                ))}
                {logs.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                    Waiting for logs...
                  </Typography>
                )}
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default EnhancedProgressTracker;
