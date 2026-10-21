import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Save,
  Check,
  Error as ErrorIcon,
  VpnKey,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  Storage as StorageIcon,
  Cloud as CloudIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import { apiGet, apiPost } from '../utils/api';

interface APIKeyStatus {
  userId?: string;
  user_id?: string; // Legacy field
  hasOpenaiKey?: boolean;
  has_openai_key?: boolean; // Legacy field
  hasAzureCredentials?: boolean;
  has_azure_credentials?: boolean; // Legacy field
  createdAt?: string;
  created_at?: string; // Legacy field
  updatedAt?: string;
  updated_at?: string; // Legacy field
  openaiKeyMasked?: string | null;
  azureClientIdMasked?: string | null;
}

interface APIKeyTestResult {
  tested: boolean;
  valid: boolean;
  error: string | null;
}

export default function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [azureTenantId, setAzureTenantId] = useState('');

  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAzureSecret, setShowAzureSecret] = useState(false);

  const [keyStatus, setKeyStatus] = useState<APIKeyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    openai: APIKeyTestResult;
  } | null>(null);

  // RAG sync state
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [syncDays, setSyncDays] = useState<number | 'all'>('all');

  // Salesforce state
  const [sfConnected, setSfConnected] = useState(false);
  const [sfConfigured, setSfConfigured] = useState(false);
  const [sfConnecting, setSfConnecting] = useState(false);
  const [sfSyncing, setSfSyncing] = useState(false);
  const [sfLastSync, setSfLastSync] = useState<string | null>(null);
  const [sfSyncStats, setSfSyncStats] = useState<{ opportunities: number; accounts: number; contacts: number }>({ opportunities: 0, accounts: 0, contacts: 0 });
  const [sfDisconnecting, setSfDisconnecting] = useState(false);

  // Load current key status and Salesforce status on mount
  useEffect(() => {
    loadKeyStatus();
    loadSalesforceStatus();

    // Check for Salesforce OAuth callback redirect
    const params = new URLSearchParams(window.location.search);
    const sfResult = params.get('salesforce');
    if (sfResult === 'connected') {
      setSuccessMessage('Salesforce connected successfully!');
      loadSalesforceStatus();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (sfResult === 'error') {
      setError(`Salesforce connection failed: ${params.get('message') || 'Unknown error'}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadKeyStatus = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/user/api-keys/status');
      setKeyStatus(response.data || response); // Handle both wrapped and unwrapped responses
    } catch (err: any) {
      console.error('Error loading API key status:', err);
      setError('Failed to load API key status');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate at least one key is provided
      if (!openaiKey && (!azureClientId || !azureClientSecret || !azureTenantId)) {
        setError('Please provide at least one API key');
        return;
      }

      const payload: any = {};

      if (openaiKey) payload.openaiApiKey = openaiKey;
      if (azureClientId && azureClientSecret && azureTenantId) {
        payload.azureClientId = azureClientId;
        payload.azureClientSecret = azureClientSecret;
        payload.azureTenantId = azureTenantId;
      }

      const response = await apiPost('/api/user/api-keys', payload);

      setKeyStatus(response.data || response); // Handle both wrapped and unwrapped responses
      setSuccessMessage('API keys saved successfully! Running connection tests...');

      // Clear input fields after successful save
      setOpenaiKey('');
      setAzureClientId('');
      setAzureClientSecret('');
      setAzureTenantId('');

      // Reload status
      await loadKeyStatus();

      // Automatically test the saved keys
      await testSavedKeysAfterSave();
    } catch (err: any) {
      console.error('Error saving API keys:', err);
      setError(err.message || 'Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  const testSavedKeysAfterSave = async () => {
    try {
      setTesting(true);
      setTestResults(null);

      const response = await apiPost('/api/user/api-keys/test-saved', {});
      setTestResults(response.data || response);

      // Check if all tested keys are valid
      const results = response.data || response;
      const allValid = Object.values(results).every(
        (result: any) => !result.tested || result.valid
      );

      if (allValid) {
        setSuccessMessage('API keys saved and validated successfully! All connections are working.');
      } else {
        setSuccessMessage('API keys saved, but some connections failed. Please check the test results below.');
      }
    } catch (err: any) {
      console.error('Error testing saved API keys:', err);
      // Don't set error here, keys were saved successfully
      setSuccessMessage('API keys saved, but connection test failed. You can manually test them using the button above.');
    } finally {
      setTesting(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSuccessMessage(null);
    setError(null);
  };

  const handleTestKeys = async () => {
    try {
      setTesting(true);
      setError(null);
      setTestResults(null);

      // Only test keys that are provided
      const keysToTest: any = {};
      if (openaiKey) keysToTest.openaiApiKey = openaiKey;

      if (Object.keys(keysToTest).length === 0) {
        setError('Please enter at least one API key to test');
        return;
      }

      const response = await apiPost('/api/user/api-keys/test', keysToTest);
      setTestResults(response.data || response);
      setSuccessMessage('API keys tested successfully!');
    } catch (err: any) {
      console.error('Error testing API keys:', err);
      setError(err.message || 'Failed to test API keys');
    } finally {
      setTesting(false);
    }
  };

  const handleSyncRAG = async () => {
    try {
      setSyncing(true);
      setSyncProgress('Starting sync...');
      setError(null);

      const response = await apiPost('/api/rag/index/all', {});

      if (response.success) {
        const results = response.data;
        const total = Object.values(results).reduce((sum: number, r: any) => sum + r.indexed, 0);
        setSuccessMessage(`Successfully indexed ${total} documents across all collections`);
        setSyncProgress(null);
      } else {
        throw new Error(response.error || 'Failed to sync RAG');
      }
    } catch (err: any) {
      console.error('Error syncing RAG:', err);
      setError(err.message || 'Failed to sync RAG collections');
      setSyncProgress(null);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncCollection = async (collection: string, days?: number) => {
    try {
      setSyncing(true);
      const timeRange = days ? ` (last ${days} days)` : '';
      setSyncProgress(`Syncing ${collection}${timeRange}...`);
      setError(null);

      const payload = days ? { days } : {};
      const response = await apiPost(`/api/rag/index/${collection}`, payload);

      if (response.success) {
        const result = response.data;
        const message = days
          ? `Successfully synced ${result.indexed} documents from last ${days} days in ${collection}`
          : `Successfully indexed ${result.indexed} documents in ${collection}`;
        setSuccessMessage(message);
        setSyncProgress(null);
      } else {
        throw new Error(response.error || 'Failed to sync collection');
      }
    } catch (err: any) {
      console.error(`Error syncing ${collection}:`, err);
      setError(err.message || `Failed to sync ${collection} collection`);
      setSyncProgress(null);
    } finally {
      setSyncing(false);
    }
  };

  const handleTestSavedKeys = async () => {
    try {
      setTesting(true);
      setError(null);
      setTestResults(null);

      const response = await apiPost('/api/user/api-keys/test-saved', {});
      setTestResults(response.data || response);
      setSuccessMessage('Saved API keys tested successfully!');
    } catch (err: any) {
      console.error('Error testing saved API keys:', err);
      setError(err.message || 'Failed to test saved API keys');
    } finally {
      setTesting(false);
    }
  };

  // ─── Salesforce Handlers ────────────────────────────────────────────────

  const loadSalesforceStatus = async () => {
    try {
      const response = await apiGet('/api/salesforce/status');
      const data = response.data || response;
      setSfConnected(data.connected);
      setSfConfigured(data.configured);
      if (data.lastSyncedAt) setSfLastSync(new Date(data.lastSyncedAt).toLocaleString());
      if (data.syncStats) setSfSyncStats(data.syncStats);
    } catch {
      // Salesforce not configured — that's fine
    }
  };

  const handleSalesforceConnect = async () => {
    try {
      setSfConnecting(true);
      const response = await apiGet('/api/salesforce/auth');
      const data = response.data || response;
      if (data.authUrl) {
        window.open(data.authUrl, 'salesforce-auth', 'width=600,height=700');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Salesforce connection');
    } finally {
      setSfConnecting(false);
    }
  };

  const handleSalesforceDisconnect = async () => {
    try {
      setSfDisconnecting(true);
      await apiPost('/api/salesforce/disconnect', {});
      setSfConnected(false);
      setSfLastSync(null);
      setSfSyncStats({ opportunities: 0, accounts: 0, contacts: 0 });
      setSuccessMessage('Salesforce disconnected successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect Salesforce');
    } finally {
      setSfDisconnecting(false);
    }
  };

  const handleSalesforceSync = async () => {
    try {
      setSfSyncing(true);
      setError(null);
      const response = await apiPost('/api/salesforce/sync', {});
      const data = response.data || response;
      const total = (data.accounts?.synced || 0) + (data.contacts?.synced || 0) + (data.opportunities?.synced || 0);
      setSuccessMessage(`Salesforce sync complete: ${total} records synced (${data.opportunities?.synced || 0} opportunities, ${data.accounts?.synced || 0} accounts, ${data.contacts?.synced || 0} contacts)`);
      await loadSalesforceStatus();
    } catch (err: any) {
      setError(err.message || 'Salesforce sync failed');
    } finally {
      setSfSyncing(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}
          >
            <SettingsIcon sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.025em' }}>
              Settings
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.disabled', mt: 0.5 }}>
              Configure your API keys to use the Sales Intelligence Platform
            </Typography>
          </Box>
        </Box>
      </Box>

        {/* Current Status */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        ) : keyStatus && (
          <Paper
            elevation={3}
            sx={{
              mb: 4,
              borderRadius: 3,
              border: '1px solid rgba(71, 85, 105, 0.3)',
              overflow: 'hidden',
              bgcolor: 'rgba(30, 35, 50, 0.95)',
            }}
          >
            <Box
              sx={{
                p: 3,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                bgcolor: 'rgba(15, 23, 42, 0.6)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <VpnKey sx={{ mr: 1.5, color: 'text.disabled', fontSize: 28 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                    Current Configuration Status
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    View and test your configured API keys
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                size="large"
                onClick={handleTestSavedKeys}
                disabled={testing || !(keyStatus.hasOpenaiKey || keyStatus.has_openai_key)}
                startIcon={testing ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <VpnKey />}
                sx={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  px: 3,
                  py: 1.5,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                    boxShadow: '0 6px 16px rgba(37, 99, 235, 0.4)',
                  },
                }}
              >
                {testing ? 'Testing Keys...' : 'Test Saved Keys'}
              </Button>
            </Box>
            <Box sx={{ p: 3 }}>
              <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                {/* OpenAI API Key */}
                <Card
                  elevation={0}
                  sx={{
                    border: '2px solid',
                    borderColor: (keyStatus.hasOpenaiKey || keyStatus.has_openai_key) ? 'success.main' : 'error.main',
                    bgcolor: (keyStatus.hasOpenaiKey || keyStatus.has_openai_key)
                      ? 'rgba(16, 185, 129, 0.03)'
                      : 'rgba(239, 68, 68, 0.03)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: 3,
                    }
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: (keyStatus.hasOpenaiKey || keyStatus.has_openai_key)
                            ? 'success.main'
                            : 'error.main',
                          mr: 1.5
                        }}
                      >
                        {(keyStatus.hasOpenaiKey || keyStatus.has_openai_key) ? (
                          <Check sx={{ color: 'white', fontSize: 22 }} />
                        ) : (
                          <ErrorIcon sx={{ color: 'white', fontSize: 22 }} />
                        )}
                      </Box>
                      <Box>
                        <Typography variant="body1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                          OpenAI API
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          Required for AI analysis
                        </Typography>
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        p: 1.5,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider'
                      }}
                    >
                      {keyStatus.openaiKeyMasked ? (
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'Monaco, Consolas, monospace',
                            fontSize: '0.85rem',
                            letterSpacing: '0.5px',
                            color: 'text.primary'
                          }}
                        >
                          {keyStatus.openaiKeyMasked}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="error" sx={{ fontStyle: 'italic' }}>
                          Not configured
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                {/* Azure AD Credentials */}
                <Card
                  elevation={0}
                  sx={{
                    border: '2px solid',
                    borderColor: (keyStatus.hasAzureCredentials || keyStatus.has_azure_credentials) ? 'success.main' : 'grey.300',
                    bgcolor: (keyStatus.hasAzureCredentials || keyStatus.has_azure_credentials)
                      ? 'rgba(16, 185, 129, 0.03)'
                      : 'grey.50',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: 3,
                    }
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: (keyStatus.hasAzureCredentials || keyStatus.has_azure_credentials)
                            ? 'success.main'
                            : 'grey.400',
                          mr: 1.5
                        }}
                      >
                        {(keyStatus.hasAzureCredentials || keyStatus.has_azure_credentials) ? (
                          <Check sx={{ color: 'white', fontSize: 22 }} />
                        ) : (
                          <ErrorIcon sx={{ color: 'white', fontSize: 22 }} />
                        )}
                      </Box>
                      <Box>
                        <Typography variant="body1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                          Azure AD
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          Optional - Calendar integration
                        </Typography>
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        p: 1.5,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider'
                      }}
                    >
                      {keyStatus.azureClientIdMasked ? (
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'Monaco, Consolas, monospace',
                            fontSize: '0.85rem',
                            letterSpacing: '0.5px',
                            color: 'text.primary'
                          }}
                        >
                          {keyStatus.azureClientIdMasked}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          Not configured
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Box>
            <Box sx={{ px: 3, pb: 2, bgcolor: 'rgba(15, 23, 42, 0.6)', borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'flex', alignItems: 'center' }}>
                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main', mr: 1 }} />
                Last updated: {new Date(keyStatus.updatedAt || keyStatus.updated_at || new Date()).toLocaleString()}
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Test Results */}
        {testResults && (
          <Paper
            elevation={3}
            sx={{
              mb: 4,
              borderRadius: 3,
              border: '2px solid #2563eb',
              overflow: 'hidden',
              bgcolor: 'rgba(30, 35, 50, 0.95)',
              animation: 'slideIn 0.3s ease-out',
              '@keyframes slideIn': {
                '0%': { opacity: 0, transform: 'translateY(-10px)' },
                '100%': { opacity: 1, transform: 'translateY(0)' },
              },
            }}
          >
            <Box
              sx={{
                p: 3,
                bgcolor: 'rgba(37, 99, 235, 0.15)',
                borderBottom: '1px solid rgba(37, 99, 235, 0.3)',
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 2,
                  }}
                >
                  <Check sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                API Connection Test Results
              </Typography>
              <Typography variant="body2" sx={{ color: '#cbd5e1', ml: 6 }}>
                Real API calls were made to verify your keys work correctly
              </Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                {testResults.openai.tested && (
                  <Card
                    elevation={0}
                    sx={{
                      border: '2px solid',
                      borderColor: testResults.openai.valid ? '#10b981' : '#ef4444',
                      bgcolor: testResults.openai.valid ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1.5,
                            bgcolor: testResults.openai.valid ? '#10b981' : '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mr: 1.5,
                          }}
                        >
                          {testResults.openai.valid ? (
                            <Check sx={{ color: 'white', fontSize: 18 }} />
                          ) : (
                            <ErrorIcon sx={{ color: 'white', fontSize: 18 }} />
                          )}
                        </Box>
                        <Typography variant="body1" fontWeight={700}>
                          OpenAI API
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: testResults.openai.valid ? '#10b981' : '#ef4444',
                        }}
                      >
                        {testResults.openai.valid ? '✓ Valid' : '✗ Invalid'}
                      </Typography>
                      {testResults.openai.error && (
                        <Typography variant="caption" sx={{ color: 'error.main', mt: 1, display: 'block' }}>
                          {testResults.openai.error}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                )}
              </Box>
            </Box>
          </Paper>
        )}

        {/* Testing In Progress Indicator */}
        {testing && !testResults && (
          <Alert
            severity="info"
            icon={<CircularProgress size={20} sx={{ color: 'secondary.main' }} />}
            sx={{
              mb: 4,
              borderRadius: 2,
              border: '1px solid #3b82f6',
              bgcolor: 'rgba(59, 130, 246, 0.1)',
              '& .MuiAlert-message': { color: '#cbd5e1' },
            }}
          >
            <Typography variant="body1" fontWeight={600} sx={{ color: '#f8fafc' }}>
              Testing API Connections...
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled', mt: 0.5 }}>
              Making real API calls to validate your keys. This may take a few seconds.
            </Typography>
          </Alert>
        )}

        {/* Missing Keys Warning */}
        {keyStatus && !(keyStatus.hasOpenaiKey || keyStatus.has_openai_key) && (
          <Alert
            severity="warning"
            sx={{
              mb: 4,
              borderRadius: 2,
              border: '1px solid #f59e0b',
              bgcolor: 'rgba(245, 158, 11, 0.05)',
            }}
            >
            <Typography variant="body1" fontWeight={700} gutterBottom sx={{ color: '#92400e' }}>
              Required API Keys Missing
            </Typography>
            <Typography variant="body2" sx={{ color: '#78350f' }}>
              OpenAI API key is required for research functionality.
              Please configure it below and test it before starting research.
            </Typography>
          </Alert>
        )}

        {/* Configure API Keys Section */}
        <Paper
          elevation={3}
          sx={{
            mb: 4,
            borderRadius: 3,
            border: '1px solid rgba(71, 85, 105, 0.3)',
            overflow: 'hidden',
            bgcolor: 'rgba(30, 35, 50, 0.95)',
          }}
        >
          <Box
            sx={{
              p: 3,
              bgcolor: 'rgba(15, 23, 42, 0.6)',
              borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc', mb: 0.5 }}>
              Configure API Keys
            </Typography>
            <Alert
              severity="info"
              sx={{
                mt: 2,
                borderRadius: 2,
                bgcolor: 'rgba(37, 99, 235, 0.15)',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                '& .MuiAlert-icon': {
                  color: '#60a5fa',
                },
                '& .MuiAlert-message': {
                  color: '#cbd5e1',
                },
              }}
            >
              Your API keys are encrypted and stored securely. When you save keys, we automatically test them by making real API calls to verify they work correctly.
            </Alert>
          </Box>
          <Box sx={{ p: 4 }}>

        {/* OpenAI API Key */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#f8fafc' }}>
            OpenAI API Key
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.disabled' }}>
            Required for AI-powered analysis and report generation
          </Typography>
          <TextField
            fullWidth
            type={showOpenaiKey ? 'text' : 'password'}
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    edge="end"
                  >
                    {showOpenaiKey ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Get your key from: https://platform.openai.com/api-keys
          </Typography>
        </Box>

        <Divider sx={{ my: 3, borderColor: 'rgba(71, 85, 105, 0.3)' }} />

        {/* Azure AD Credentials */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#f8fafc' }}>
            Azure AD Credentials (Optional)
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.disabled' }}>
            Required for Microsoft Teams calendar integration and email functionality
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Azure Client ID"
              value={azureClientId}
              onChange={(e) => setAzureClientId(e.target.value)}
              placeholder="Enter Azure AD Application (client) ID"
            />
            <TextField
              fullWidth
              type={showAzureSecret ? 'text' : 'password'}
              label="Azure Client Secret"
              value={azureClientSecret}
              onChange={(e) => setAzureClientSecret(e.target.value)}
              placeholder="Enter Azure AD Client Secret"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowAzureSecret(!showAzureSecret)}
                      edge="end"
                    >
                      {showAzureSecret ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Azure Tenant ID"
              value={azureTenantId}
              onChange={(e) => setAzureTenantId(e.target.value)}
              placeholder="Enter Azure AD Directory (tenant) ID"
            />
          </Box>
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
            Get your credentials from: https://portal.azure.com
          </Typography>
        </Box>

            {/* Action Buttons */}
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                size="large"
                onClick={handleTestKeys}
                disabled={testing || saving || !openaiKey}
                sx={{
                  px: 3,
                  py: 1.5,
                  fontWeight: 600,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                  },
                }}
              >
                {testing ? 'Testing...' : 'Test Keys Before Saving'}
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={(saving || testing) ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <Save />}
                onClick={handleSave}
                disabled={saving || testing}
                sx={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  px: 3,
                  py: 1.5,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)',
                  },
                }}
              >
                {saving ? 'Saving...' : testing ? 'Testing Connections...' : 'Save API Keys'}
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* RAG Sync Section */}
        <Paper
          elevation={3}
          sx={{
            mb: 4,
            borderRadius: 3,
            border: '1px solid rgba(71, 85, 105, 0.3)',
            overflow: 'hidden',
            bgcolor: 'rgba(30, 35, 50, 0.95)',
          }}
        >
          <Box
            sx={{
              p: 3,
              borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
              bgcolor: 'rgba(15, 23, 42, 0.6)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <StorageIcon sx={{ mr: 1.5, color: 'text.disabled', fontSize: 28 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                  RAG Knowledge Base Sync
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  Sync and index company research and transcript analyses into the vector database
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.disabled', mb: 3 }}>
              This will re-index all existing company research and transcript analyses into LanceDB for semantic search.
              New analyses are automatically indexed, but you can manually sync to update existing data.
            </Typography>

            {syncProgress && (
              <Alert severity="info" sx={{ mb: 3 }}>
                {syncProgress}
              </Alert>
            )}

            {/* Time Range Selector */}
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'text.disabled' }}>Sync Time Range</InputLabel>
                <Select
                  value={syncDays}
                  onChange={(e) => setSyncDays(e.target.value as number | 'all')}
                  label="Sync Time Range"
                  disabled={syncing}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(71, 85, 105, 0.3)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2563eb',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2563eb',
                    },
                  }}
                >
                  <MenuItem value="all">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>All Documents (Full Re-index)</Typography>
                      <Chip label="Complete" size="small" color="primary" />
                    </Box>
                  </MenuItem>
                  <MenuItem value={7}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>Last 7 Days</Typography>
                      <Chip label="Quick" size="small" color="success" />
                    </Box>
                  </MenuItem>
                  <MenuItem value={30}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>Last 30 Days</Typography>
                      <Chip label="Recent" size="small" color="info" />
                    </Box>
                  </MenuItem>
                  <MenuItem value={90}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>Last 90 Days</Typography>
                      <Chip label="Extended" size="small" color="warning" />
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                {syncDays === 'all'
                  ? 'Full re-index clears and rebuilds the entire collection'
                  : `Incremental sync only indexes documents from the last ${syncDays} days`}
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
              <Button
                variant="outlined"
                size="large"
                onClick={() => handleSyncCollection('company_research', syncDays === 'all' ? undefined : syncDays)}
                disabled={syncing}
                startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
                sx={{
                  py: 2,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                  },
                }}
              >
                Sync Company Research
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => handleSyncCollection('transcripts', syncDays === 'all' ? undefined : syncDays)}
                disabled={syncing}
                startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
                sx={{
                  py: 2,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                  },
                }}
              >
                Sync Transcripts
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={handleSyncRAG}
                disabled={syncing}
                startIcon={syncing ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <SyncIcon />}
                sx={{
                  py: 2,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                    boxShadow: '0 6px 16px rgba(139, 92, 246, 0.4)',
                  },
                }}
              >
                {syncing ? 'Syncing...' : 'Sync All Collections'}
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Salesforce CRM Integration */}
        <Paper
          elevation={3}
          sx={{
            mb: 4,
            borderRadius: 3,
            border: '1px solid rgba(71, 85, 105, 0.3)',
            overflow: 'hidden',
            bgcolor: 'rgba(30, 35, 50, 0.95)',
          }}
        >
          <Box
            sx={{
              p: 3,
              borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
              bgcolor: 'rgba(15, 23, 42, 0.6)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CloudIcon sx={{ mr: 1.5, color: 'text.disabled', fontSize: 28 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                  Salesforce CRM Integration
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  Bidirectional sync — pull opportunities from Salesforce and push generated content back
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ p: 3 }}>
            {/* Connection Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Chip
                  label={sfConnected ? 'Connected' : 'Not Connected'}
                  icon={sfConnected ? <Check /> : <LinkOffIcon />}
                  size="small"
                  sx={{
                    bgcolor: sfConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: sfConnected ? '#22c55e' : '#ef4444',
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: sfConnected ? '#22c55e' : '#ef4444' },
                  }}
                />
                {sfLastSync && (
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    Last synced: {sfLastSync}
                  </Typography>
                )}
              </Box>

              {sfConnected && sfSyncStats && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {sfSyncStats.opportunities} opportunities
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {sfSyncStats.accounts} accounts
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {sfSyncStats.contacts} contacts
                  </Typography>
                </Box>
              )}
            </Box>

            {!sfConfigured && (
              <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#93c5fd' }}>
                Salesforce integration requires a Connected App. Set SF_CLIENT_ID and SF_CLIENT_SECRET in server environment variables.
              </Alert>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {!sfConnected ? (
                <Button
                  variant="contained"
                  startIcon={sfConnecting ? <CircularProgress size={16} color="inherit" /> : <CloudIcon />}
                  onClick={handleSalesforceConnect}
                  disabled={sfConnecting || !sfConfigured}
                  sx={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    },
                  }}
                >
                  {sfConnecting ? 'Connecting...' : 'Connect to Salesforce'}
                </Button>
              ) : (
                <>
                  <Button
                    variant="contained"
                    startIcon={sfSyncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                    onClick={handleSalesforceSync}
                    disabled={sfSyncing}
                    sx={{
                      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                      },
                    }}
                  >
                    {sfSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={sfDisconnecting ? <CircularProgress size={16} color="inherit" /> : <LinkOffIcon />}
                    onClick={handleSalesforceDisconnect}
                    disabled={sfDisconnecting}
                    sx={{
                      borderColor: 'rgba(239, 68, 68, 0.5)',
                      color: 'error.main',
                      '&:hover': {
                        borderColor: '#ef4444',
                        bgcolor: 'rgba(239, 68, 68, 0.1)',
                      },
                    }}
                  >
                    {sfDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Paper>

        {/* Success/Error Snackbar */}
        <Snackbar
          open={!!successMessage || !!error}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {successMessage ? (
            <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
              {successMessage}
            </Alert>
          ) : (
            <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
              {error}
            </Alert>
          )}
        </Snackbar>
      </Container>
  );
}
