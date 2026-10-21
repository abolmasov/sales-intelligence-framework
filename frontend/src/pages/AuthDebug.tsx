import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Alert,
  Divider,
  Chip,
  CircularProgress,
  Stack,
} from '@mui/material';
import { CheckCircle, ErrorOutline } from '@mui/icons-material';
import { API_BASE_URL } from '../config';

const AuthDebug: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSession = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new globalThis.Error('No active session found');
      }

      const data = await response.json();
      setSessionInfo(data?.data || data);
    } catch (err: unknown) {
      console.error('Failed to load session info:', err);
      setSessionInfo(null);
      setError(err instanceof Error ? err.message : 'Failed to load session info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const handleLogin = () => {
    window.location.href = '/';
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setSessionInfo(null);
      setError('Session cleared. Please log in again.');
    } catch (err: unknown) {
      console.error('Failed to log out:', err);
      setError('Failed to log out. Please close the browser session manually.');
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, backgroundColor: '#1a1f2e' }}>
        <Typography variant="h4" gutterBottom sx={{ color: '#fff', mb: 3 }}>
          🔐 Authentication Debug
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={32} sx={{ color: 'secondary.main' }} />
            <Typography sx={{ color: '#cbd5e1' }}>Checking current session...</Typography>
          </Box>
        ) : sessionInfo ? (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 3 }}>
            Session active for {sessionInfo.displayName || sessionInfo.userPrincipalName}
          </Alert>
        ) : (
          <Alert severity="warning" icon={<ErrorOutline />} sx={{ mb: 3 }}>
            {error || 'No active session detected. Please log in.'}
          </Alert>
        )}

        <Divider sx={{ my: 3, borderColor: '#334155' }} />

        {sessionInfo ? (
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ color: '#fff' }}>
              User Information
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>Name</Typography>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {sessionInfo.displayName || 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>Email</Typography>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {sessionInfo.mail || sessionInfo.userPrincipalName || 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>User ID</Typography>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {sessionInfo.id || 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>Job Title</Typography>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {sessionInfo.jobTitle || 'N/A'}
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ color: '#fff', mb: 1 }}>
                Session Controls
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" color="primary" onClick={loadSession}>
                  Refresh Session
                </Button>
                <Button variant="outlined" color="secondary" onClick={handleLogout}>
                  Logout
                </Button>
              </Stack>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ color: '#fff', mb: 1 }}>
                Scopes Granted
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(sessionInfo.userType ? [sessionInfo.userType] : ['Microsoft Graph'])?.map(
                  (scope) => (
                    <Chip key={scope} label={scope} color="info" size="small" />
                  )
                )}
              </Stack>
            </Box>
          </Stack>
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ color: 'text.disabled', mb: 2 }}>
              No active session detected. Start a new login to generate a session cookie.
            </Typography>
            <Button variant="contained" onClick={handleLogin}>
              Go to Login Page
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default AuthDebug;
