import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Apps,
  Assessment,
  AutoFixHigh,
  BugReport,
  CheckCircle,
  Cloud,
  CloudSync,
  Code,
  Dashboard,
  Dns,
  Error as ErrorIcon,
  ExpandLess,
  ExpandMore,
  Extension,
  FilterList,
  Flag,
  Group,
  HealthAndSafety,
  Help,
  Info,
  Key,
  Link as LinkIcon,
  LinkOff,
  MoveUp,
  People,
  PlayArrow,
  PriorityHigh,
  Refresh,
  ScreenShare,
  Security,
  Settings,
  Speed,
  Storage,
  Terminal,
  ViewKanban,
  Warning,
  WorkOutline,
} from '@mui/icons-material';
import { apiPost } from '../utils/api';
import {
  EnvironmentData,
  InstanceType,
  detectInstanceType,
  getInstanceTypeLabel,
  getInstanceTypeColor,
} from '../types/atlassianAssessment';

// Scan log entry type
interface ScanLogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'api_call' | 'progress';
  message: string;
  endpoint?: string;
  duration?: number;
}

interface AtlassianEnvironmentScanProps {
  assessmentId: string;
  companyName: string;
  environmentData?: EnvironmentData;
  onScanComplete?: (data: EnvironmentData) => void;
  onRescan?: () => Promise<void>;
  isRescanning?: boolean;
}

// Analysis type: Migration (DC/Server -> Cloud) or Health (Cloud instance health check)
type AnalysisType = 'migration' | 'health';

const AtlassianEnvironmentScan: React.FC<AtlassianEnvironmentScanProps> = ({
  assessmentId,
  companyName,
  environmentData,
  onScanComplete,
  onRescan,
  isRescanning = false,
}) => {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [analysisType, setAnalysisType] = useState<AnalysisType | null>(null);
  const [connectionForm, setConnectionForm] = useState({
    url: '',
    username: '',
    apiToken: '',
    productType: 'jira_dc' as string,
  });
  const [detectedInstanceType, setDetectedInstanceType] = useState<InstanceType | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    users: true,
    projects: true,
    customFields: false,
    workflows: false,
    plugins: true,
  });
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current && showLogs) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scanLogs, showLogs]);

  // Connect to SSE for real-time logs when scanning
  useEffect(() => {
    if (scanning || isRescanning) {
      setScanLogs([]);
      setShowLogs(true);

      // Connect to SSE endpoint
      const baseUrl = process.env.REACT_APP_API_URL || '';
      const eventSource = new EventSource(`${baseUrl}/api/atlassian/assessments/${assessmentId}/scan-logs/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const log = JSON.parse(event.data) as ScanLogEntry;
          setScanLogs(prev => [...prev, log]);
        } catch (e) {
          console.error('Failed to parse log entry:', e);
        }
      };

      eventSource.onerror = () => {
        // Connection closed, likely scan completed
        eventSource.close();
      };

      return () => {
        eventSource.close();
        eventSourceRef.current = null;
      };
    }
  }, [scanning, isRescanning, assessmentId]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getLogIcon = (type: ScanLogEntry['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />;
      case 'api_call':
        return <Terminal sx={{ fontSize: 14, color: '#6366f1' }} />;
      case 'progress':
        return <Speed sx={{ fontSize: 14, color: 'warning.main' }} />;
      default:
        return <Info sx={{ fontSize: 14, color: 'text.disabled' }} />;
    }
  };

  const getLogColor = (type: ScanLogEntry['type']) => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'api_call':
        return '#6366f1';
      case 'progress':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  // Auto-detect instance type when URL changes
  const handleUrlChange = (url: string) => {
    const detected = detectInstanceType(url);
    setDetectedInstanceType(url ? detected : null);

    // Auto-adjust product type and analysis type based on detection
    if (detected === 'cloud') {
      setConnectionForm({ ...connectionForm, url, productType: 'jira_cloud' });
      // Cloud instances default to health analysis
      setAnalysisType('health');
    } else {
      setConnectionForm({ ...connectionForm, url, productType: 'jira_dc' });
      // DC/Server instances default to migration analysis
      setAnalysisType('migration');
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const response = await apiPost(`/api/atlassian/assessments/${assessmentId}/connect`, connectionForm);
      if (response.success && response.data?.success) {
        // Connection successful, proceed to scan
        await handleScan();
        setConnectDialogOpen(false);
      } else {
        setError(response.data?.error || 'Failed to connect to instance');
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const response = await apiPost(`/api/atlassian/assessments/${assessmentId}/scan`, connectionForm);
      if (response.success) {
        onScanComplete?.(response.data);
      } else {
        setError(response.error || 'Scan failed');
      }
    } catch (err: any) {
      setError(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low':
      case 'simple':
        return '#10b981';
      case 'medium':
      case 'moderate':
        return '#f59e0b';
      case 'high':
      case 'complex':
        return '#f97316';
      case 'very_high':
      case 'very_complex':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getPluginStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'success';
      case 'alternative_available':
        return 'warning';
      case 'no_cloud_version':
        return 'error';
      default:
        return 'default';
    }
  };

  // If scanning, show progress with logs
  if (scanning || (isRescanning && !environmentData?.scanResult)) {
    return (
      <Paper sx={{ p: 4 }}>
        <Stack alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <CircularProgress size={48} sx={{ color: '#0052CC' }} />
          <Typography variant="h6" fontWeight={600}>
            {isRescanning ? 'Re-scanning Environment...' : 'Scanning Environment...'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fetching data from {companyName}'s Atlassian instance
          </Typography>
        </Stack>

        {/* Scan Logs */}
        <Paper
          variant="outlined"
          sx={{
            maxHeight: 400,
            overflow: 'auto',
            bgcolor: 'rgba(0,0,0,0.5)',
            p: 2,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
          }}
        >
          <Stack spacing={0.5}>
            {scanLogs.map((log, idx) => (
              <Stack key={idx} direction="row" spacing={1} alignItems="flex-start">
                {getLogIcon(log.type)}
                <Typography
                  variant="caption"
                  component="span"
                  sx={{
                    color: 'text.secondary',
                    fontFamily: 'monospace',
                    minWidth: 70,
                  }}
                >
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Typography>
                <Typography
                  variant="caption"
                  component="span"
                  sx={{
                    fontFamily: 'monospace',
                    color: getLogColor(log.type),
                    wordBreak: 'break-all',
                  }}
                >
                  {log.message}
                  {log.endpoint && (
                    <Typography
                      component="span"
                      sx={{
                        ml: 1,
                        color: 'text.disabled',
                        fontSize: '0.65rem',
                      }}
                    >
                      {log.endpoint}
                    </Typography>
                  )}
                </Typography>
              </Stack>
            ))}
            <div ref={logsEndRef} />
          </Stack>
          {scanLogs.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Waiting for scan to start...
            </Typography>
          )}
        </Paper>
      </Paper>
    );
  }

  // If no environment data and not scanning, show connect prompt
  if (!environmentData?.scanResult) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Stack direction="row" justifyContent="center" spacing={2} sx={{ mb: 2 }}>
          <Cloud sx={{ fontSize: 48, color: '#0052CC' }} />
          <Dns sx={{ fontSize: 48, color: '#6554C0' }} />
        </Stack>
        <Typography variant="h5" gutterBottom fontWeight={600}>
          Connect to Atlassian Instance
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1, maxWidth: 600, mx: 'auto' }}>
          Connect to {companyName}'s Atlassian instance to automatically discover and analyze:
        </Typography>
        <Stack direction="row" justifyContent="center" spacing={1} sx={{ mb: 3 }}>
          <Chip label="Cloud" size="small" sx={{ bgcolor: '#0052CC20', color: '#0052CC' }} />
          <Chip label="Data Center" size="small" sx={{ bgcolor: '#6554C020', color: '#6554C0' }} />
          <Chip label="Server" size="small" sx={{ bgcolor: '#FF563020', color: '#FF5630' }} />
        </Stack>
        <Grid container spacing={2} sx={{ mb: 3, maxWidth: 700, mx: 'auto' }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <People sx={{ color: '#0052CC', mb: 1 }} />
              <Typography variant="body2" fontWeight={600}>Users & Groups</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Settings sx={{ color: '#6554C0', mb: 1 }} />
              <Typography variant="body2" fontWeight={600}>Custom Fields</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <WorkOutline sx={{ color: '#00875A', mb: 1 }} />
              <Typography variant="body2" fontWeight={600}>Workflows</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Extension sx={{ color: '#FF5630', mb: 1 }} />
              <Typography variant="body2" fontWeight={600}>Installed Apps</Typography>
            </Paper>
          </Grid>
        </Grid>
        <Button
          variant="contained"
          size="large"
          startIcon={<LinkIcon />}
          onClick={() => setConnectDialogOpen(true)}
          sx={{ bgcolor: '#0052CC', '&:hover': { bgcolor: '#0747A6' } }}
        >
          Connect Instance
        </Button>

        {/* Connect Dialog */}
        <Dialog open={connectDialogOpen} onClose={() => setConnectDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Key sx={{ color: '#0052CC' }} />
              <span>Connect to Atlassian Instance</span>
            </Stack>
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter the connection details for the customer's Atlassian instance.
              Credentials are encrypted and stored securely.
            </Typography>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Instance URL"
                placeholder="https://your-company.atlassian.net"
                value={connectionForm.username}
                onChange={(e) => setConnectionForm({ ...connectionForm, username: e.target.value })}
                disabled={connecting || scanning}
                helperText={detectedInstanceType === 'cloud' ? 'Use your Atlassian account email' : undefined}
              />
              <TextField
                fullWidth
                label="API Token"
                type="password"
                value={connectionForm.apiToken}
                onChange={(e) => setConnectionForm({ ...connectionForm, apiToken: e.target.value })}
                disabled={connecting || scanning}
                helperText="Use your password or generate an API token in your profile settings"
              />
              <TextField
                select
                fullWidth
                label="Product Type"
                value={connectionForm.productType}
                onChange={(e) => setConnectionForm({ ...connectionForm, productType: e.target.value })}
                disabled={connecting || scanning}
                SelectProps={{ native: true }}
              >
                {detectedInstanceType === 'cloud' ? (
                  <>
                    <option value="jira_cloud">Jira Cloud</option>
                    <option value="confluence_cloud">Confluence Cloud</option>
                  </>
                ) : (
                  <>
                    <option value="jira_dc">Jira Data Center</option>
                    <option value="jira_server">Jira Server</option>
                    <option value="confluence_dc">Confluence Data Center</option>
                    <option value="confluence_server">Confluence Server</option>
                  </>
                )}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConnectDialogOpen(false)} disabled={connecting || scanning}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleConnect}
              disabled={!connectionForm.url || !connectionForm.username || !connectionForm.apiToken || !analysisType || connecting || scanning}
              startIcon={(connecting || scanning) ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
              sx={{
                bgcolor: analysisType === 'migration' ? '#6554C0' : '#0052CC',
                '&:hover': { bgcolor: analysisType === 'migration' ? '#5243AA' : '#0747A6' }
              }}
            >
              {connecting ? 'Connecting...' : scanning ? 'Scanning...' : analysisType === 'migration' ? 'Run Migration Analysis' : 'Run Health Analysis'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    );
  }

  // Show scanning progress
  if (scanning) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={60} sx={{ color: '#0052CC', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Scanning Atlassian Instance...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Discovering users, projects, custom fields, workflows, and installed apps.
          This may take a few minutes.
        </Typography>
        <LinearProgress sx={{ mt: 3, maxWidth: 400, mx: 'auto' }} />
      </Paper>
    );
  }

  const { scanResult, analysis } = environmentData || {};
  if (!scanResult || !analysis) return null;

  return (
    <Box>
      {/* Overview Header - Compact */}
      <Paper sx={{ p: 1.5, mb: 2, bgcolor: `${getInstanceTypeColor(scanResult.instanceType || 'datacenter')}08` }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {scanResult.instanceType === 'cloud' ? (
              <Cloud sx={{ color: getInstanceTypeColor('cloud'), fontSize: 20 }} />
            ) : (
              <Dns sx={{ color: getInstanceTypeColor(scanResult.instanceType || 'datacenter'), fontSize: 20 }} />
            )}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {scanResult.serverInfo.serverTitle || 'Atlassian Instance'}
                </Typography>
                <Chip
                  label={getInstanceTypeLabel(scanResult.instanceType || 'datacenter')}
                  size="small"
                  sx={{ height: 18, fontSize: '0.65rem', bgcolor: getInstanceTypeColor(scanResult.instanceType || 'datacenter'), color: 'white' }}
                />
                {scanResult.instanceType === 'cloud' && scanResult.cloudHealth?.productAccess?.[0] && (
                  <Chip
                    label={scanResult.cloudHealth.productAccess[0].tier}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem', borderColor: '#0052CC', color: '#0052CC' }}
                  />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {scanResult.serverInfo.baseUrl} • v{scanResult.serverInfo.version} • Scanned {new Date(scanResult.scanTimestamp).toLocaleString()} ({scanResult.scanDurationMs}ms)
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight={700} sx={{ color: getComplexityColor(analysis.overallAssessment.complexity) }}>
                {analysis.overallAssessment.migrationReadinessScore}
              </Typography>
              <Chip
                label={analysis.overallAssessment.complexity.replace('_', ' ').toUpperCase()}
                size="small"
                sx={{ height: 20, fontSize: '0.65rem', bgcolor: `${getComplexityColor(analysis.overallAssessment.complexity)}20`, color: getComplexityColor(analysis.overallAssessment.complexity), fontWeight: 600 }}
              />
            </Stack>
            {onRescan && (
              <Button
                variant="outlined"
                size="small"
                startIcon={isRescanning ? <CircularProgress size={12} /> : <Refresh sx={{ fontSize: 14 }} />}
                onClick={onRescan}
                disabled={isRescanning}
                sx={{ height: 28, fontSize: '0.75rem', borderColor: getInstanceTypeColor(scanResult.instanceType || 'datacenter'), color: getInstanceTypeColor(scanResult.instanceType || 'datacenter') }}
              >
                {isRescanning ? 'Scanning...' : 'Re-scan'}
              </Button>
            )}
            {scanLogs.length > 0 && (
              <Button
                variant="text"
                size="small"
                startIcon={<Terminal sx={{ fontSize: 14 }} />}
                onClick={() => setShowLogs(!showLogs)}
                sx={{ height: 28, fontSize: '0.75rem', color: 'text.secondary' }}
              >
                {showLogs ? 'Hide' : 'Logs'}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Scan Logs Panel (collapsible) - Compact */}
      <Collapse in={showLogs && scanLogs.length > 0}>
        <Paper
          variant="outlined"
          sx={{ mb: 2, maxHeight: 180, overflow: 'auto', bgcolor: 'rgba(0,0,0,0.5)', p: 1, fontFamily: 'monospace', fontSize: '0.7rem' }}
        >
          <Stack spacing={0.25}>
            {scanLogs.map((log, idx) => (
              <Stack key={idx} direction="row" spacing={0.5} alignItems="center">
                {getLogIcon(log.type)}
                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', minWidth: 55, fontSize: '0.6rem' }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: getLogColor(log.type), wordBreak: 'break-all', fontSize: '0.65rem' }}>
                  {log.message}
                  {log.duration && <Typography component="span" sx={{ ml: 0.5, color: 'text.disabled', fontSize: '0.6rem' }}>({log.duration}ms)</Typography>}
                </Typography>
              </Stack>
            ))}
            <div ref={logsEndRef} />
          </Stack>
        </Paper>
      </Collapse>

      {/* Major Blockers Alert - Compact */}
      {analysis.overallAssessment.majorBlockers.length > 0 && (
        <Alert severity="error" sx={{ mb: 2, py: 0.5 }} icon={<Warning sx={{ fontSize: 18 }} />}>
          <Typography variant="body2" fontWeight={600} sx={{ display: 'inline' }}>Blockers: </Typography>
          <Typography variant="body2" component="span">
            {analysis.overallAssessment.majorBlockers.join(' • ')}
          </Typography>
        </Alert>
      )}

      {/* Compact Tab Navigation */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 36,
            '& .MuiTab-root': {
              minHeight: 36,
              py: 0.5,
              px: 1.5,
              fontSize: '0.8rem',
              textTransform: 'none',
            },
            '& .MuiTab-iconWrapper': {
              marginRight: 0.5,
            },
          }}
        >
          <Tab icon={<Assessment sx={{ fontSize: 16 }} />} label="Overview" iconPosition="start" />
          <Tab
            icon={<People sx={{ fontSize: 16 }} />}
            label={`Users (${analysis.users.activeUsers})`}
            iconPosition="start"
          />
          <Tab
            icon={<Settings sx={{ fontSize: 16 }} />}
            label={`Fields (${analysis.customFields.totalCustomFields})`}
            iconPosition="start"
          />
          <Tab
            icon={<WorkOutline sx={{ fontSize: 16 }} />}
            label={`Workflows (${scanResult.workflows.total})`}
            iconPosition="start"
          />
          <Tab
            icon={<Extension sx={{ fontSize: 16 }} />}
            label={`Apps (${analysis.plugins.totalUserPlugins})`}
            iconPosition="start"
          />
          <Tab
            icon={<ViewKanban sx={{ fontSize: 16 }} />}
            label={`Boards (${scanResult.boards?.total || 0})`}
            iconPosition="start"
          />
          <Tab
            icon={<FilterList sx={{ fontSize: 16 }} />}
            label={`Filters (${scanResult.filters?.total || 0})`}
            iconPosition="start"
          />
          <Tab
            icon={<BugReport sx={{ fontSize: 16 }} />}
            label={`Types (${scanResult.issueTypes?.total || 0})`}
            iconPosition="start"
          />
          <Tab icon={<Dashboard sx={{ fontSize: 16 }} />} label="More" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {/* Key Metrics Row */}
          <Grid size={{ xs: 12 }}>
            <Grid container spacing={1.5}>
              {[
                { icon: <People sx={{ fontSize: 20 }} />, value: analysis.users.activeUsers, label: 'Active Users', color: '#0052CC', sub: `${analysis.users.inactiveUsers} inactive` },
                { icon: <Apps sx={{ fontSize: 20 }} />, value: scanResult.projects.total, label: 'Projects', color: '#00875A', sub: Object.entries(scanResult.projects.byType).map(([k, v]) => `${v} ${k}`).join(', ') },
                { icon: <Settings sx={{ fontSize: 20 }} />, value: analysis.customFields.totalCustomFields, label: 'Custom Fields', color: '#6554C0', sub: `${analysis.customFields.migrationComplexity} complexity` },
                { icon: <WorkOutline sx={{ fontSize: 20 }} />, value: scanResult.workflows.customWorkflows, label: 'Workflows', color: '#00A3BF', sub: `${analysis.workflows.workflowsWithGroovy} with scripts` },
                { icon: <Extension sx={{ fontSize: 20 }} />, value: analysis.plugins.totalUserPlugins, label: 'Apps', color: '#FF5630', sub: `${analysis.plugins.overallMigrationReadiness}% cloud ready` },
                { icon: <ViewKanban sx={{ fontSize: 20 }} />, value: scanResult.boards?.total || 0, label: 'Boards', color: '#36B37E', sub: `${scanResult.boards?.scrumBoards || 0} scrum, ${scanResult.boards?.kanbanBoards || 0} kanban` },
                { icon: <FilterList sx={{ fontSize: 20 }} />, value: scanResult.filters?.total || 0, label: 'Filters', color: '#FFAB00', sub: `${scanResult.filters?.sharedFilters || 0} shared` },
                { icon: <Dashboard sx={{ fontSize: 20 }} />, value: scanResult.dashboards?.total || 0, label: 'Dashboards', color: '#6554C0', sub: `${scanResult.dashboards?.sharedDashboards || 0} shared` },
              ].map((metric, idx) => (
                <Grid key={idx} size={{ xs: 6, sm: 3, md: 1.5 }}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: `${metric.color}08`, borderLeft: `3px solid ${metric.color}` }}>
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} sx={{ mb: 0.5 }}>
                      <Box sx={{ color: metric.color }}>{metric.icon}</Box>
                      <Typography variant="h5" fontWeight={700}>{metric.value}</Typography>
                    </Stack>
                    <Typography variant="caption" fontWeight={600} sx={{ display: 'block', lineHeight: 1.2 }}>{metric.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{metric.sub}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Migration Readiness + App Summary + Recommendations */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Assessment sx={{ fontSize: 16 }} /> Migration Readiness
              </Typography>
              <Stack spacing={1.5}>
                {[
                  { label: 'Custom Fields', complexity: analysis.customFields.migrationComplexity },
                  { label: 'Workflows', complexity: analysis.workflows.migrationComplexity },
                  { label: 'Apps', complexity: analysis.plugins.overallMigrationReadiness >= 70 ? 'low' : analysis.plugins.overallMigrationReadiness >= 50 ? 'medium' : 'high', value: `${analysis.plugins.overallMigrationReadiness}%` },
                ].map((item, idx) => (
                  <Box key={idx}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption">{item.label}</Typography>
                      <Chip
                        label={item.value || item.complexity}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${getComplexityColor(item.complexity)}20`, color: getComplexityColor(item.complexity) }}
                      />
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={item.complexity === 'low' ? 90 : item.complexity === 'medium' ? 60 : 30}
                      sx={{ height: 4, borderRadius: 2, mt: 0.5, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: getComplexityColor(item.complexity) } }}
                    />
                  </Box>
                ))}
              </Stack>

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>App Migration</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Box sx={{ flex: 1, p: 1, bgcolor: 'rgba(16, 185, 129, 0.1)', borderRadius: 1, textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'success.main' }}>{scanResult.plugins.cloudMigrationSummary.readyToMigrate}</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>Ready</Typography>
                </Box>
                <Box sx={{ flex: 1, p: 1, bgcolor: 'rgba(245, 158, 11, 0.1)', borderRadius: 1, textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'warning.main' }}>{scanResult.plugins.cloudMigrationSummary.needsAlternative}</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>Review</Typography>
                </Box>
                <Box sx={{ flex: 1, p: 1, bgcolor: 'rgba(239, 68, 68, 0.1)', borderRadius: 1, textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'error.main' }}>{scanResult.plugins.cloudMigrationSummary.noCloudVersion}</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>No Cloud</Typography>
                </Box>
              </Stack>

              {analysis.overallAssessment.keyConsiderations.length > 0 && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Considerations</Typography>
                  {analysis.overallAssessment.keyConsiderations.slice(0, 3).map((c, idx) => (
                    <Stack key={idx} direction="row" spacing={0.5} alignItems="flex-start" sx={{ mb: 0.5 }}>
                      <Warning sx={{ fontSize: 12, color: 'warning.main', mt: 0.25 }} />
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1.3 }}>{c}</Typography>
                    </Stack>
                  ))}
                </>
              )}
            </Paper>
          </Grid>

          {/* Projects Table */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>Projects ({scanResult.projects.total})</Typography>
                <Stack direction="row" spacing={0.5}>
                  {Object.entries(scanResult.projects.byType).slice(0, 3).map(([type, count]) => (
                    <Chip key={type} label={`${count} ${type}`} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
                  ))}
                </Stack>
              </Stack>
              <TableContainer sx={{ maxHeight: 280 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Key</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Name</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Type</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scanResult.projects.projects.slice(0, 15).map((project) => (
                      <TableRow key={project.key} hover>
                        <TableCell sx={{ py: 0.25, fontSize: '0.7rem', fontFamily: 'monospace' }}>{project.key}</TableCell>
                        <TableCell sx={{ py: 0.25, fontSize: '0.7rem', maxWidth: 120 }}>
                          <Typography variant="caption" noWrap>{project.name}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Chip label={project.projectTypeKey} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {scanResult.projects.projects.length > 15 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  +{scanResult.projects.projects.length - 15} more projects
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Quick Stats Grid */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Configuration Summary</Typography>
              <Grid container spacing={1}>
                {[
                  { label: 'Statuses', value: scanResult.statuses?.total || 0, icon: <Flag sx={{ fontSize: 14 }} /> },
                  { label: 'Priorities', value: scanResult.priorities?.total || 0, icon: <PriorityHigh sx={{ fontSize: 14 }} /> },
                  { label: 'Issue Types', value: scanResult.issueTypes?.total || 0, icon: <BugReport sx={{ fontSize: 14 }} /> },
                  { label: 'Resolutions', value: scanResult.resolutions?.total || 0, icon: <CheckCircle sx={{ fontSize: 14 }} /> },
                  { label: 'Link Types', value: scanResult.issueLinkTypes?.total || 0, icon: <LinkIcon sx={{ fontSize: 14 }} /> },
                  { label: 'Screens', value: scanResult.screens?.total || 0, icon: <ScreenShare sx={{ fontSize: 14 }} /> },
                  { label: 'Perm Schemes', value: scanResult.permissionSchemes?.total || 0, icon: <Security sx={{ fontSize: 14 }} /> },
                  { label: 'Automation', value: scanResult.automationRules?.total || 0, icon: <AutoFixHigh sx={{ fontSize: 14 }} /> },
                ].map((item, idx) => (
                  <Grid key={idx} size={{ xs: 6 }}>
                    <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ color: 'text.secondary' }}>{item.icon}</Box>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{item.value}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{item.label}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Utilization (30 days)</Typography>
              <Stack direction="row" spacing={2}>
                <Box>
                  <Typography variant="h6" fontWeight={700} color="success.main">
                    {scanResult.utilization.issuesCreatedLast30Days?.toLocaleString() || '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Created</Typography>
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} color="info.main">
                    {scanResult.utilization.issuesResolvedLast30Days?.toLocaleString() || '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Resolved</Typography>
                </Box>
              </Stack>

              {/* Recommendation */}
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, display: 'block' }}>
                <strong>Recommendation:</strong> {analysis.overallAssessment.recommendedApproach}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip icon={<Speed sx={{ fontSize: 12 }} />} label={analysis.overallAssessment.estimatedEffort} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                <Chip icon={<Cloud sx={{ fontSize: 12 }} />} label={analysis.users.licenseRecommendation} size="small" color="primary" sx={{ height: 20, fontSize: '0.65rem' }} />
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Grid container spacing={2}>
          {/* User Stats Cards */}
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" spacing={1.5}>
              <Paper sx={{ p: 1.5, flex: 1, textAlign: 'center', borderLeft: '3px solid #10b981' }}>
                <Typography variant="h4" fontWeight={700} color="success.main">{analysis.users.activeUsers}</Typography>
                <Typography variant="caption">Active Users</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, flex: 1, textAlign: 'center', borderLeft: '3px solid #6b7280' }}>
                <Typography variant="h4" fontWeight={700} color="text.secondary">{analysis.users.inactiveUsers}</Typography>
                <Typography variant="caption">Inactive Users</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, flex: 1, textAlign: 'center', borderLeft: '3px solid #0052CC' }}>
                <Typography variant="h4" fontWeight={700} color="primary.main">{analysis.users.utilizationRate}%</Typography>
                <Typography variant="caption">Utilization Rate</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, flex: 2, borderLeft: '3px solid #6554C0' }}>
                <Typography variant="caption" color="text.secondary">License Recommendation</Typography>
                <Typography variant="body2" fontWeight={600}>{analysis.users.licenseRecommendation}</Typography>
              </Paper>
            </Stack>
          </Grid>

          {/* Groups Table - Full Width */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Groups ({analysis.users.groups.length})</Typography>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>Group Name</TableCell>
                      <TableCell align="right" sx={{ py: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>Members</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.75rem', fontWeight: 600, width: 200 }}>Distribution</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis.users.groups.map((group, idx) => {
                      const maxMembers = Math.max(...analysis.users.groups.map(g => g.memberCount));
                      const percentage = maxMembers > 0 ? (group.memberCount / maxMembers) * 100 : 0;
                      return (
                        <TableRow key={`group-${group.name}-${idx}`} hover>
                          <TableCell sx={{ py: 0.5, fontSize: '0.8rem' }}>{group.name}</TableCell>
                          <TableCell align="right" sx={{ py: 0.5, fontSize: '0.8rem', fontWeight: 600 }}>{group.memberCount}</TableCell>
                          <TableCell sx={{ py: 0.5 }}>
                            <LinearProgress
                              variant="determinate"
                              value={percentage}
                              sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#0052CC' } }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 2 && (
        <Grid container spacing={2}>
          {/* Stats Row */}
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Paper sx={{ p: 1.5, minWidth: 120, borderLeft: `3px solid ${getComplexityColor(analysis.customFields.migrationComplexity)}` }}>
                <Typography variant="h5" fontWeight={700}>{analysis.customFields.totalCustomFields}</Typography>
                <Typography variant="caption">Custom Fields</Typography>
                <Chip label={analysis.customFields.migrationComplexity} size="small" sx={{ ml: 1, height: 16, fontSize: '0.6rem', bgcolor: `${getComplexityColor(analysis.customFields.migrationComplexity)}20`, color: getComplexityColor(analysis.customFields.migrationComplexity) }} />
              </Paper>
              {Object.entries(analysis.customFields.fieldsByType).slice(0, 8).map(([type, count]) => (
                <Paper key={type} sx={{ p: 1, minWidth: 80, textAlign: 'center' }}>
                  <Typography variant="body1" fontWeight={700}>{count as number}</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{type}</Typography>
                </Paper>
              ))}
            </Stack>
          </Grid>

          {/* Recommendations - Compact */}
          {analysis.customFields.recommendations.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info" sx={{ py: 0.5 }} icon={<Info sx={{ fontSize: 16 }} />}>
                <Typography variant="caption">{analysis.customFields.recommendations.join(' • ')}</Typography>
              </Alert>
            </Grid>
          )}

          {/* All Fields Table - Directly shown, no collapse */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 1.5 }}>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Field Name</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 100 }}>ID</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Type</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Scope</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scanResult.customFields.fields.map((field) => (
                      <TableRow key={field.id} hover sx={{ '&:hover': { bgcolor: 'rgba(101, 84, 192, 0.05)' } }}>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>{field.name}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.65rem' }}>{field.id}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Chip label={field.type} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(101, 84, 192, 0.1)', color: '#6554C0' }} />
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          {field.isAllProjects ? (
                            <Chip label="Global" size="small" color="primary" sx={{ height: 16, fontSize: '0.6rem' }} />
                          ) : (
                            <Chip label={`${field.projectCount || 0} proj`} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 0.25, maxWidth: 250 }}>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>{field.description || '-'}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 3 && (
        <Grid container spacing={2}>
          {/* Stats Row */}
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" spacing={1.5}>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #00875A' }}>
                <Typography variant="h5" fontWeight={700}>{scanResult.workflows.total}</Typography>
                <Typography variant="caption">Total</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #0052CC' }}>
                <Typography variant="h5" fontWeight={700}>{scanResult.workflows.customWorkflows}</Typography>
                <Typography variant="caption">Custom</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #f59e0b' }}>
                <Typography variant="h5" fontWeight={700}>{analysis.workflows.workflowsWithGroovy}</Typography>
                <Typography variant="caption">With Scripts</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, minWidth: 120, borderLeft: `3px solid ${getComplexityColor(analysis.workflows.migrationComplexity)}` }}>
                <Typography variant="body2" fontWeight={700}>{analysis.workflows.migrationComplexity.toUpperCase()}</Typography>
                <Typography variant="caption">Complexity</Typography>
              </Paper>
              {analysis.workflows.recommendations.length > 0 && (
                <Paper sx={{ p: 1.5, flex: 1, bgcolor: 'rgba(245, 158, 11, 0.08)' }}>
                  <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.7rem' }}>
                    {analysis.workflows.recommendations.join(' • ')}
                  </Typography>
                </Paper>
              )}
            </Stack>
          </Grid>

          {/* All Workflows Table - Directly shown */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 1.5 }}>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Workflow</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 70 }}>Type</TableCell>
                      <TableCell align="center" sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 50 }}>Steps</TableCell>
                      <TableCell align="center" sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 60 }}>Trans.</TableCell>
                      <TableCell align="center" sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 50 }}>Proj</TableCell>
                      <TableCell align="center" sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 40 }}>PF</TableCell>
                      <TableCell align="center" sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 40 }}>Val</TableCell>
                      <TableCell align="center" sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 40 }}>Cond</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scanResult.workflows.workflows.map((workflow, idx) => {
                      const isComplex = workflow.steps > 10 || workflow.transitions > 15 || workflow.hasPostFunctions;
                      return (
                        <TableRow key={`workflow-${workflow.id || workflow.name || idx}`} hover sx={{ bgcolor: isComplex ? 'rgba(245, 158, 11, 0.05)' : 'transparent' }}>
                          <TableCell sx={{ py: 0.25 }}>
                            <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>{workflow.name}</Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.25 }}>
                            <Chip
                              label={workflow.isSystem ? 'Sys' : workflow.isDefault ? 'Def' : 'Cust'}
                              size="small"
                              sx={{ height: 16, fontSize: '0.6rem', bgcolor: workflow.isSystem ? 'rgba(107, 119, 140, 0.2)' : workflow.isDefault ? 'rgba(0, 82, 204, 0.2)' : 'rgba(0, 163, 191, 0.2)' }}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ py: 0.25 }}>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem', color: workflow.steps > 10 ? '#f59e0b' : 'text.primary' }}>{workflow.steps}</Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ py: 0.25 }}>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem', color: workflow.transitions > 15 ? '#f59e0b' : 'text.primary' }}>{workflow.transitions}</Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ py: 0.25 }}>
                            <Typography variant="caption" color="text.secondary">{workflow.projectCount ?? '-'}</Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ py: 0.25 }}>
                            {workflow.hasPostFunctions ? <CheckCircle sx={{ fontSize: 14, color: 'warning.main' }} /> : <Typography variant="caption" color="text.disabled">-</Typography>}
                          </TableCell>
                          <TableCell align="center" sx={{ py: 0.25 }}>
                            {workflow.hasValidators ? <CheckCircle sx={{ fontSize: 14, color: 'warning.main' }} /> : <Typography variant="caption" color="text.disabled">-</Typography>}
                          </TableCell>
                          <TableCell align="center" sx={{ py: 0.25 }}>
                            {workflow.hasConditions ? <CheckCircle sx={{ fontSize: 14, color: 'warning.main' }} /> : <Typography variant="caption" color="text.disabled">-</Typography>}
                          </TableCell>
                          <TableCell sx={{ py: 0.25, maxWidth: 200 }}>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>{workflow.description || '-'}</Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 4 && (
        <Grid container spacing={2}>
          {/* Stats Row */}
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" spacing={1.5}>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #10b981' }}>
                <Typography variant="h5" fontWeight={700} color="success.main">{scanResult.plugins.cloudMigrationSummary.readyToMigrate}</Typography>
                <Typography variant="caption">Ready</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #f59e0b' }}>
                <Typography variant="h5" fontWeight={700} color="warning.main">{scanResult.plugins.cloudMigrationSummary.needsAlternative}</Typography>
                <Typography variant="caption">Needs Review</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #ef4444' }}>
                <Typography variant="h5" fontWeight={700} color="error.main">{scanResult.plugins.cloudMigrationSummary.noCloudVersion}</Typography>
                <Typography variant="caption">No Cloud</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, minWidth: 120, borderLeft: `3px solid ${analysis.plugins.overallMigrationReadiness >= 70 ? '#10b981' : analysis.plugins.overallMigrationReadiness >= 50 ? '#f59e0b' : '#ef4444'}` }}>
                <Typography variant="h5" fontWeight={700}>{analysis.plugins.overallMigrationReadiness}%</Typography>
                <Typography variant="caption">Cloud Ready</Typography>
              </Paper>
              {analysis.plugins.recommendations.length > 0 && (
                <Paper sx={{ p: 1.5, flex: 1, bgcolor: 'rgba(0, 82, 204, 0.05)' }}>
                  <Typography variant="caption" color="info.main" sx={{ fontSize: '0.7rem' }}>
                    {analysis.plugins.recommendations.join(' • ')}
                  </Typography>
                </Paper>
              )}
            </Stack>
          </Grid>

          {/* All Apps in Single Table */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 1.5 }}>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 60 }}>Status</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>App Name</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 80 }}>Version</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Cloud Equivalent</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Ready to Migrate */}
                    {analysis.plugins.cloudReadyPlugins.map((plugin) => (
                      <TableRow key={plugin.key} hover sx={{ bgcolor: 'rgba(16, 185, 129, 0.05)' }}>
                        <TableCell sx={{ py: 0.25 }}>
                          <Chip label="Ready" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(16, 185, 129, 0.2)', color: 'success.main' }} />
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>{plugin.name}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="caption">{plugin.currentVersion}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="caption" color="success.main">{plugin.cloudEquivalent || '-'}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25, maxWidth: 200 }}>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>{plugin.migrationNotes || '-'}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Needs Alternative */}
                    {analysis.plugins.pluginsNeedingAlternative.map((plugin) => (
                      <TableRow key={plugin.key} hover sx={{ bgcolor: 'rgba(245, 158, 11, 0.05)' }}>
                        <TableCell sx={{ py: 0.25 }}>
                          <Chip label="Review" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(245, 158, 11, 0.2)', color: 'warning.main' }} />
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>{plugin.name}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="caption">{plugin.currentVersion}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="caption" color="warning.main">Needs alternative</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25, maxWidth: 200 }}>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>{plugin.migrationNotes || 'Review required'}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* No Cloud Version */}
                    {analysis.plugins.pluginsWithNoCloudVersion.map((plugin) => (
                      <TableRow key={plugin.key} hover sx={{ bgcolor: 'rgba(239, 68, 68, 0.05)' }}>
                        <TableCell sx={{ py: 0.25 }}>
                          <Chip label="None" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(239, 68, 68, 0.2)', color: 'error.main' }} />
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>{plugin.name}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="caption">{plugin.currentVersion}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25 }}>
                          <Typography variant="caption" color="error.main">No cloud version</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.25, maxWidth: 200 }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'text.secondary' }} noWrap>{plugin.key}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Boards Tab (activeTab === 5) */}
      {activeTab === 5 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" spacing={1.5}>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #0052CC' }}>
                <Typography variant="h5" fontWeight={700}>{scanResult.boards?.scrumBoards || 0}</Typography>
                <Typography variant="caption">Scrum</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #00875A' }}>
                <Typography variant="h5" fontWeight={700}>{scanResult.boards?.kanbanBoards || 0}</Typography>
                <Typography variant="caption">Kanban</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #6554C0' }}>
                <Typography variant="h5" fontWeight={700}>{(scanResult.boards?.total || 0) - (scanResult.boards?.scrumBoards || 0) - (scanResult.boards?.kanbanBoards || 0)}</Typography>
                <Typography variant="caption">Simple</Typography>
              </Paper>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 1.5 }}>
              {scanResult.boards?.boards && scanResult.boards.boards.length > 0 ? (
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Board Name</TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 70 }}>Type</TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Project</TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Location</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scanResult.boards.boards.map((board) => (
                        <TableRow key={board.id} hover>
                          <TableCell sx={{ py: 0.25 }}>
                            <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>{board.name}</Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.25 }}>
                            <Chip label={board.type} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: board.type === 'scrum' ? 'rgba(0, 82, 204, 0.1)' : 'rgba(0, 135, 90, 0.1)', color: board.type === 'scrum' ? '#0052CC' : '#00875A' }} />
                          </TableCell>
                          <TableCell sx={{ py: 0.25 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{board.projectKey ? `${board.projectKey}` : '-'}</Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.25 }}>
                            <Typography variant="caption" color="text.secondary">{board.location || '-'}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>No boards found</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Filters Tab (activeTab === 6) */}
      {activeTab === 6 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" spacing={1.5}>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #10b981' }}>
                <Typography variant="h5" fontWeight={700}>{scanResult.filters?.sharedFilters || 0}</Typography>
                <Typography variant="caption">Shared</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #6b7280' }}>
                <Typography variant="h5" fontWeight={700}>{scanResult.filters?.privateFilters || 0}</Typography>
                <Typography variant="caption">Private</Typography>
              </Paper>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 1.5 }}>
              {scanResult.filters?.filters && scanResult.filters.filters.length > 0 ? (
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Filter Name</TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 120 }}>Owner</TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 80 }}>Sharing</TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>JQL Query</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scanResult.filters.filters.map((filter) => (
                        <TableRow key={filter.id} hover>
                          <TableCell sx={{ py: 0.25 }}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>{filter.name}</Typography>
                              {filter.isFavourite && <Typography sx={{ color: 'warning.main', fontSize: '0.7rem' }}>★</Typography>}
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ py: 0.25 }}>
                            <Typography variant="caption">{filter.owner}</Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.25 }}>
                            <Chip
                              label={filter.isSharedGlobally ? 'Global' : filter.sharePermissions.length > 0 ? `${filter.sharePermissions.length}` : 'Private'}
                              size="small"
                              sx={{ height: 16, fontSize: '0.6rem', bgcolor: filter.isSharedGlobally ? 'rgba(0, 82, 204, 0.2)' : filter.sharePermissions.length > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 119, 140, 0.2)' }}
                            />
                          </TableCell>
                          <TableCell sx={{ py: 0.25, maxWidth: 350 }}>
                            <Tooltip title={filter.jql}>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{filter.jql}</Typography>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>No filters found</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Issue Types Tab (activeTab === 7) */}
      {activeTab === 7 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" spacing={1.5}>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #0052CC' }}>
                <Typography variant="h5" fontWeight={700}>{scanResult.issueTypes?.standardTypes || 0}</Typography>
                <Typography variant="caption">Standard</Typography>
              </Paper>
              <Paper sx={{ p: 1.5, minWidth: 100, borderLeft: '3px solid #6b7280' }}>
                <Typography variant="h5" fontWeight={700}>{scanResult.issueTypes?.subtaskTypes || 0}</Typography>
                <Typography variant="caption">Subtasks</Typography>
              </Paper>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 1.5 }}>
              {scanResult.issueTypes?.issueTypes && scanResult.issueTypes.issueTypes.length > 0 ? (
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Issue Type</TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 80 }}>Category</TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 60 }}>Level</TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Description</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scanResult.issueTypes.issueTypes.map((type) => (
                        <TableRow key={type.id} hover>
                          <TableCell sx={{ py: 0.25 }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              {type.iconUrl && <img src={type.iconUrl} alt="" style={{ width: 14, height: 14 }} />}
                              <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>{type.name}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ py: 0.25 }}>
                            <Chip label={type.subtask ? 'Sub' : 'Std'} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: type.subtask ? 'rgba(107, 119, 140, 0.2)' : 'rgba(0, 82, 204, 0.2)' }} />
                          </TableCell>
                          <TableCell sx={{ py: 0.25 }}>
                            <Typography variant="caption">{type.hierarchyLevel}</Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.25, maxWidth: 250 }}>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>{type.description || '-'}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>No issue types found</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* More Tab (activeTab === 8) - Dashboards, Statuses, Priorities, etc. */}
      {activeTab === 8 && (
        <Grid container spacing={2}>
          {/* Statuses - Compact chips */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                <Flag sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Statuses ({scanResult.statuses?.total || 0})
              </Typography>
              {scanResult.statuses?.statuses && scanResult.statuses.statuses.length > 0 ? (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {scanResult.statuses.statuses.map((status) => (
                    <Chip
                      key={status.id}
                      label={status.name}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: status.statusCategory.colorName === 'blue-gray' ? 'rgba(107, 119, 140, 0.2)' :
                                 status.statusCategory.colorName === 'yellow' ? 'rgba(245, 158, 11, 0.2)' :
                                 status.statusCategory.colorName === 'green' ? 'rgba(16, 185, 129, 0.2)' :
                                 'rgba(0, 82, 204, 0.2)',
                        color: status.statusCategory.colorName === 'blue-gray' ? '#6b778c' :
                               status.statusCategory.colorName === 'yellow' ? '#f59e0b' :
                               status.statusCategory.colorName === 'green' ? '#10b981' : '#0052CC',
                      }}
                    />
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary">No statuses found</Typography>
              )}
            </Paper>
          </Grid>

          {/* Priorities - Compact list */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                <PriorityHigh sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Priorities ({scanResult.priorities?.total || 0})
              </Typography>
              <Stack spacing={0.5}>
                {scanResult.priorities?.priorities?.map((priority) => (
                  <Stack key={priority.id} direction="row" alignItems="center" spacing={0.5}>
                    {priority.iconUrl && <img src={priority.iconUrl} alt="" style={{ width: 12, height: 12 }} />}
                    <Typography variant="caption">{priority.name}</Typography>
                    {priority.isDefault && <Chip label="D" size="small" sx={{ height: 14, fontSize: '0.5rem', minWidth: 16 }} />}
                  </Stack>
                )) || <Typography variant="caption" color="text.secondary">None</Typography>}
              </Stack>
            </Paper>
          </Grid>

          {/* Resolutions - Compact list */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                <CheckCircle sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Resolutions ({scanResult.resolutions?.total || 0})
              </Typography>
              <Stack spacing={0.5}>
                {scanResult.resolutions?.resolutions?.map((res) => (
                  <Stack key={res.id} direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="caption">{res.name}</Typography>
                    {res.isDefault && <Chip label="D" size="small" sx={{ height: 14, fontSize: '0.5rem', minWidth: 16 }} />}
                  </Stack>
                )) || <Typography variant="caption" color="text.secondary">None</Typography>}
              </Stack>
            </Paper>
          </Grid>

          {/* Dashboards */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                <Dashboard sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Dashboards ({scanResult.dashboards?.total || 0}) • {scanResult.dashboards?.sharedDashboards || 0} shared
              </Typography>
              {scanResult.dashboards?.dashboards && scanResult.dashboards.dashboards.length > 0 ? (
                <TableContainer sx={{ maxHeight: 150 }}>
                  <Table size="small">
                    <TableBody>
                      {scanResult.dashboards.dashboards.slice(0, 8).map((dash) => (
                        <TableRow key={dash.id}>
                          <TableCell sx={{ py: 0.25, border: 0 }}>
                            <Typography variant="caption" fontWeight={500}>{dash.name}</Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ py: 0.25, border: 0 }}>
                            <Chip label={dash.sharePermissions.length > 0 ? 'S' : 'P'} size="small" sx={{ height: 14, fontSize: '0.5rem', minWidth: 16 }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="caption" color="text.secondary">No dashboards</Typography>
              )}
            </Paper>
          </Grid>

          {/* Link Types */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Issue Link Types ({scanResult.issueLinkTypes?.total || 0})
              </Typography>
              <Stack spacing={0.5}>
                {scanResult.issueLinkTypes?.linkTypes?.map((lt) => (
                  <Box key={lt.id}>
                    <Typography variant="caption" fontWeight={500}>{lt.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontSize: '0.65rem' }}>{lt.outward}/{lt.inward}</Typography>
                  </Box>
                )) || <Typography variant="caption" color="text.secondary">None</Typography>}
              </Stack>
            </Paper>
          </Grid>

          {/* Permission Schemes */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                <Security sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Permission Schemes ({scanResult.permissionSchemes?.total || 0})
              </Typography>
              <Stack spacing={0.5}>
                {scanResult.permissionSchemes?.schemes?.slice(0, 6).map((scheme) => (
                  <Typography key={scheme.id} variant="caption" noWrap>{scheme.name}</Typography>
                )) || <Typography variant="caption" color="text.secondary">None</Typography>}
              </Stack>
            </Paper>
          </Grid>

          {/* Automation Rules (Cloud) */}
          {scanResult.automationRules && (
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    <AutoFixHigh sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    Automation Rules ({scanResult.automationRules.total})
                  </Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Chip label={`${scanResult.automationRules.enabled} on`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(16, 185, 129, 0.2)', color: 'success.main' }} />
                    <Chip label={`${scanResult.automationRules.disabled} off`} size="small" sx={{ height: 18, fontSize: '0.6rem' }} variant="outlined" />
                  </Stack>
                </Stack>
                {scanResult.automationRules.rules.length > 0 ? (
                  <TableContainer sx={{ maxHeight: 200 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Rule</TableCell>
                          <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600, width: 60 }}>State</TableCell>
                          <TableCell sx={{ py: 0.5, fontSize: '0.7rem', fontWeight: 600 }}>Scope</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {scanResult.automationRules.rules.slice(0, 15).map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell sx={{ py: 0.25 }}>
                              <Typography variant="caption">{rule.name}</Typography>
                            </TableCell>
                            <TableCell sx={{ py: 0.25 }}>
                              <Chip label={rule.state === 'enabled' ? 'On' : 'Off'} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: rule.state === 'enabled' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 119, 140, 0.2)', color: rule.state === 'enabled' ? '#10b981' : '#6b778c' }} />
                            </TableCell>
                            <TableCell sx={{ py: 0.25 }}>
                              <Typography variant="caption" color="text.secondary">{rule.ruleScope}</Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption" color="text.secondary">No automation rules</Typography>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default AtlassianEnvironmentScan;
