import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Container, CircularProgress, Typography, Alert, Button } from '@mui/material';
import { setAuthToken, clearAuthToken, getAuthToken } from '../utils/authToken';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing sign-in...');

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const description = searchParams.get('error_description');

    if (token) {
      // Clear any existing (possibly expired) token before setting new one
      const oldToken = getAuthToken();
      if (oldToken) {
        console.log('[AuthCallback] Clearing old token before setting new one');
        clearAuthToken();
      }

      setAuthToken(token);
      console.log('[AuthCallback] New token stored, length:', token.length);

      // Verify the token was stored correctly
      const storedToken = getAuthToken();
      console.log('[AuthCallback] Token verified in storage:', !!storedToken, 'matches:', storedToken === token);

      setStatus('success');
      setMessage('Authentication successful. Redirecting...');
      const redirectTimer = setTimeout(() => navigate('/app', { replace: true }), 1200);
      return () => clearTimeout(redirectTimer);
    }

    setStatus('error');
    setMessage(error ? decodeURIComponent(error) : description ? decodeURIComponent(description) : 'Authentication failed.');
  }, [searchParams, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'rgb(250, 250, 244)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Container maxWidth="sm">
        <Box
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 4,
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(0, 35, 72, 0.12)',
            boxShadow: '0 20px 60px rgba(0, 35, 72, 0.14)',
          }}
        >
          {status === 'loading' && (
            <>
              <CircularProgress size={56} sx={{ color: 'secondary.main', mb: 3 }} />
              <Typography variant="h6" sx={{ color: 'text.primary' }}>
                {message}
              </Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <CircularProgress size={56} sx={{ color: 'success.main', mb: 3 }} />
              <Typography variant="h6" sx={{ color: 'text.primary' }}>
                {message}
              </Typography>
            </>
          )}

          {status === 'error' && (
            <>
              <Alert severity="error" sx={{ mb: 3 }}>
                {message}
              </Alert>
              <Button variant="outlined" onClick={() => navigate('/', { replace: true })}>
                Back to Login
              </Button>
            </>
          )}
        </Box>
      </Container>
    </Box>
  );
};

export default AuthCallback;
