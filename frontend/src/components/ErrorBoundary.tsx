import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Alert, Button, Box, Typography, Paper, Stack } from '@mui/material';
import { ErrorOutline, Refresh } from '@mui/icons-material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 *
 * Usage:
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console (in production, you might send to error tracking service)
    console.error('Error caught by boundary:', error, errorInfo);

    // Store error info in state for display
    this.setState({
      error,
      errorInfo,
    });

    // In production, you would send to error tracking service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
            p: 3,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              maxWidth: 800,
              width: '100%',
              p: 4,
            }}
          >
            <Stack spacing={3} alignItems="center">
              <ErrorOutline
                sx={{
                  fontSize: 80,
                  color: 'error.main',
                }}
              />

              <Typography variant="h4" fontWeight="bold" color="error.main">
                Oops! Something went wrong
              </Typography>

              <Alert severity="error" sx={{ width: '100%' }}>
                <Typography variant="body1" gutterBottom>
                  <strong>Error:</strong> {this.state.error?.message || 'Unknown error'}
                </Typography>
              </Alert>

              {/* Show stack trace in development mode */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Box
                  sx={{
                    width: '100%',
                    bgcolor: 'grey.100',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                >
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {this.state.error.stack}
                  </Typography>
                </Box>
              )}

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <Box
                  sx={{
                    width: '100%',
                    bgcolor: 'grey.100',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Component Stack:
                  </Typography>
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </Typography>
                </Box>
              )}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={this.handleReset}
                  size="large"
                >
                  Try Again
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={this.handleReload}
                  size="large"
                >
                  Reload Page
                </Button>
              </Stack>

              <Typography variant="body2" color="text.secondary" align="center">
                If this problem persists, please contact support with the error details above.
              </Typography>
            </Stack>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
