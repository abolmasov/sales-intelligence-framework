import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;


interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  requestId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  [key: string]: any;
}

interface LogStats {
  totalFiles: number;
  totalSize: number;
  totalSizeFormatted: string;
  filesByType: {
    application: number;
    http: number;
    error: number;
    performance: number;
  };
  oldestFile: string;
  newestFile: string;
}

interface LogFile {
  name: string;
  size: number;
  sizeFormatted: string;
  modified: string;
  type: string;
}

const LogDashboard: React.FC = () => {
  const [stats, setStats] = useState<LogStats | null>(null);
  const [files, setFiles] = useState<LogFile[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<string>('application');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [tabValue, setTabValue] = useState(0);

  // Load stats and files on mount
  useEffect(() => {
    loadStats();
    loadFiles();
    loadRecentLogs();
  }, []);

  // Reload logs when type changes
  useEffect(() => {
    loadRecentLogs();
  }, [selectedType]);

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/logs/stats/summary`);
      setStats(response.data.data);
    } catch (err: any) {
      console.error('Failed to load stats:', err);
      setError('Failed to load log statistics');
    }
  };

  const loadFiles = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/logs/files`);
      setFiles(response.data.data);
    } catch (err: any) {
      console.error('Failed to load files:', err);
    }
  };

  const loadRecentLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${API_URL}/api/logs/recent/${selectedType}?limit=100`
      );
      setLogs(response.data.data.logs);
    } catch (err: any) {
      setError(`Failed to load ${selectedType} logs`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadStats();
    loadFiles();
    loadRecentLogs();
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return '#ef4444';
      case 'warn':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      case 'http':
        return '#8b5cf6';
      case 'debug':
        return '#6b7280';
      default:
        return '#64748b';
    }
  };

  const getLogLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16 }} />;
      case 'warn':
        return <WarningIcon sx={{ fontSize: 16 }} />;
      case 'info':
        return <InfoIcon sx={{ fontSize: 16 }} />;
      default:
        return <InfoIcon sx={{ fontSize: 16 }} />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredLogs = logs.filter((log) => {
    // Filter by level
    if (selectedLevel !== 'all' && log.level !== selectedLevel) {
      return false;
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const logStr = JSON.stringify(log).toLowerCase();
      return logStr.includes(searchLower);
    }

    return true;
  });

  const paginatedLogs = filteredLogs.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Application Logs
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              elevation={0}
              sx={{
                bgcolor: 'rgba(26, 31, 38, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.3)',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(71, 85, 105, 0.5)',
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <DescriptionIcon sx={{ fontSize: 28, opacity: 0.7 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats.totalFiles}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                      Total Log Files
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              elevation={0}
              sx={{
                bgcolor: 'rgba(26, 31, 38, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.3)',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(71, 85, 105, 0.5)',
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ErrorIcon sx={{ color: 'error.main', fontSize: 28 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats.filesByType.error}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                      Error Logs
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              elevation={0}
              sx={{
                bgcolor: 'rgba(26, 31, 38, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.3)',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(71, 85, 105, 0.5)',
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <SpeedIcon sx={{ color: '#8b5cf6', fontSize: 28 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats.filesByType.performance}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                      Performance Logs
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              elevation={0}
              sx={{
                bgcolor: 'rgba(26, 31, 38, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.3)',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(71, 85, 105, 0.5)',
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <StorageIcon sx={{ color: 'success.main', fontSize: 28 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats.totalSizeFormatted}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                      Total Size
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Content */}
      <Card
        elevation={0}
        sx={{
          bgcolor: 'rgba(26, 31, 38, 0.8)',
          border: '1px solid rgba(71, 85, 105, 0.3)',
          borderRadius: 2,
        }}
      >
        <CardContent>
          {/* Tabs */}
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3, borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
            <Tab label="Recent Logs" />
            <Tab label="Log Files" />
          </Tabs>

          {/* Tab 0: Recent Logs */}
          {tabValue === 0 && (
            <>
              {/* Filters */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel>Log Type</InputLabel>
                    <Select
                      value={selectedType}
                      label="Log Type"
                      onChange={(e) => setSelectedType(e.target.value)}
                    >
                      <MenuItem value="application">Application</MenuItem>
                      <MenuItem value="http">HTTP</MenuItem>
                      <MenuItem value="error">Errors</MenuItem>
                      <MenuItem value="performance">Performance</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel>Log Level</InputLabel>
                    <Select
                      value={selectedLevel}
                      label="Log Level"
                      onChange={(e) => setSelectedLevel(e.target.value)}
                    >
                      <MenuItem value="all">All Levels</MenuItem>
                      <MenuItem value="error">Error</MenuItem>
                      <MenuItem value="warn">Warning</MenuItem>
                      <MenuItem value="info">Info</MenuItem>
                      <MenuItem value="http">HTTP</MenuItem>
                      <MenuItem value="debug">Debug</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Search"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </Grid>
              </Grid>

              {loading && <LinearProgress sx={{ mb: 2 }} />}

              {/* Logs Table */}
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedLogs.map((log, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Chip
                            icon={getLogLevelIcon(log.level)}
                            label={log.level.toUpperCase()}
                            size="small"
                            sx={{
                              bgcolor: getLogLevelColor(log.level),
                              color: 'white',
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {formatTimestamp(log.timestamp)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {log.message}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {log.method && (
                              <Chip label={log.method} size="small" variant="outlined" />
                            )}
                            {log.url && (
                              <Chip
                                label={log.url.substring(0, 30) + (log.url.length > 30 ? '...' : '')}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {log.statusCode && (
                              <Chip
                                label={`${log.statusCode}`}
                                size="small"
                                sx={{
                                  bgcolor: log.statusCode >= 400 ? '#fee2e2' : '#dcfce7',
                                  color: log.statusCode >= 400 ? '#ef4444' : '#10b981',
                                }}
                              />
                            )}
                            {log.durationMs && (
                              <Chip
                                label={`${log.durationMs}ms`}
                                size="small"
                                sx={{
                                  bgcolor: log.durationMs > 1000 ? '#fef3c7' : '#dbeafe',
                                  color: log.durationMs > 1000 ? '#f59e0b' : '#2563eb',
                                }}
                              />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={filteredLogs.length}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </>
          )}

          {/* Tab 1: Log Files */}
          {tabValue === 1 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>File Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Modified</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.name} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {file.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={file.type} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{file.sizeFormatted}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatTimestamp(file.modified)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Download">
                          <IconButton size="small" color="primary">
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default LogDashboard;
