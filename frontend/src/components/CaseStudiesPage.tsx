import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
} from '@mui/material';
import {
  Search,
  Launch,
  ExpandMore,
  ExpandLess,
  Code,
  Analytics,
} from '@mui/icons-material';
import { API_BASE_URL } from '../config';

interface IntegratorCase {
  title: string;
  description: string;
  industry: string;
  tags: string[];
  url: string;
  source: string;
}

interface LibraryCase {
  title: string;
  description: string;
  client_company_name: string;
  industry_sector: string;
  challenge_problem_solved: string;
  solution_provided: string | object;
  key_technologies_used: string[];
  results_benefits_achieved: string[];
  url: string;
}

const CaseStudiesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Northstar Integrators state
  const [enterpriseCases, setIntegratorCases] = useState<IntegratorCase[]>([]);
  const [integratorSearch, setIntegratorSearch] = useState('');
  const [integratorTagFilter, setIntegratorTagFilter] = useState('');
  const [integratorTags, setIntegratorTags] = useState<string[]>([]);
  const [integratorPage, setIntegratorPage] = useState(0);
  const [integratorPageSize, setIntegratorPageSize] = useState(10);
  const [integratorTotal, setIntegratorTotal] = useState(0);

  // Northstar library state
  const [libraryCases, setLibraryCases] = useState<LibraryCase[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryIndustryFilter, setLibraryIndustryFilter] = useState('');
  const [libraryTechFilter, setLibraryTechFilter] = useState('');
  const [libraryIndustries, setLibraryIndustries] = useState<string[]>([]);
  const [libraryTechnologies, setLibraryTechnologies] = useState<string[]>([]);
  const [libraryPage, setLibraryPage] = useState(0);
  const [libraryPageSize, setLibraryPageSize] = useState(10);
  const [libraryTotal, setLibraryTotal] = useState(0);

  // Expanded rows
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Statistics
  const [stats, setStats] = useState({ integrator_count: 0, library_count: 0, total_count: 0 });

  useEffect(() => {
    fetchStats();
    fetchIntegratorTags();
    fetchInryFilters();
  }, []);

  useEffect(() => {
    if (activeTab === 0) {
      fetchIntegratorCases();
    } else {
      fetchLibraryCases();
    }
  }, [activeTab, integratorPage, integratorPageSize, libraryPage, libraryPageSize]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/case-studies/stats`);
      const result = await response.json();
      const data = result.data || result;
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchIntegratorTags = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/case-studies/integrator/tags`);
      const result = await response.json();
      const data = result.data || result;
      setIntegratorTags(data.tags || []);
    } catch (err) {
      console.error('Failed to fetch Northstar Integrators tags:', err);
      setIntegratorTags([]);
    }
  };

  const fetchInryFilters = async () => {
    try {
      const [industriesRes, techRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/case-studies/library/industries`),
        fetch(`${API_BASE_URL}/api/case-studies/library/technologies`),
      ]);
      const industriesResult = await industriesRes.json();
      const techResult = await techRes.json();
      const industriesData = industriesResult.data || industriesResult;
      const techData = techResult.data || techResult;
      setLibraryIndustries(industriesData.industries || []);
      setLibraryTechnologies(techData.technologies || []);
    } catch (err) {
      console.error('Failed to fetch Northstar library filters:', err);
      setLibraryIndustries([]);
      setLibraryTechnologies([]);
    }
  };

  const fetchIntegratorCases = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(integratorPage + 1),
        page_size: String(integratorPageSize),
      });
      if (integratorSearch) params.append('search', integratorSearch);
      if (integratorTagFilter) params.append('tag', integratorTagFilter);

      const response = await fetch(`${API_BASE_URL}/api/case-studies/integrator?${params}`);
      const result = await response.json();
      const data = result.data || result;
      setIntegratorCases(data.case_studies || []);
      setIntegratorTotal(data.total || 0);
    } catch (err) {
      setError('Failed to fetch Northstar Integrators case studies');
      setIntegratorCases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLibraryCases = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(libraryPage + 1),
        page_size: String(libraryPageSize),
      });
      if (librarySearch) params.append('search', librarySearch);
      if (libraryIndustryFilter) params.append('industry', libraryIndustryFilter);
      if (libraryTechFilter) params.append('technology', libraryTechFilter);

      const response = await fetch(`${API_BASE_URL}/api/case-studies/library?${params}`);
      const result = await response.json();
      const data = result.data || result;
      setLibraryCases(data.case_studies || []);
      setLibraryTotal(data.total || 0);
    } catch (err) {
      setError('Failed to fetch Northstar library case studies');
      setLibraryCases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleIntegratorSearch = () => {
    setIntegratorPage(0);
    fetchIntegratorCases();
  };

  const handleLibrarySearch = () => {
    setLibraryPage(0);
    fetchLibraryCases();
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ color: '#f8fafc' }}>
          Case Studies
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.disabled' }}>
          Browse and search through our comprehensive collection of success stories
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Stack direction="row" spacing={3} sx={{ mb: 4 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="text.secondary" variant="body2">
                  Northstar Integrators Case Studies
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {stats.integrator_count}
                </Typography>
              </Box>
              <Code fontSize="large" color="primary" />
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="text.secondary" variant="body2">
                  Northstar library Case Studies
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {stats.library_count}
                </Typography>
              </Box>
              <Analytics fontSize="large" color="success" />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Filter Chips */}
      <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
        <Chip
          label={`ENTERPRISE (${stats.integrator_count})`}
          onClick={() => setActiveTab(0)}
          color={activeTab === 0 ? 'primary' : 'default'}
          variant={activeTab === 0 ? 'filled' : 'outlined'}
          sx={{ fontWeight: 600 }}
        />
        <Chip
          label={`Northstar library (${stats.library_count})`}
          onClick={() => setActiveTab(1)}
          color={activeTab === 1 ? 'success' : 'default'}
          variant={activeTab === 1 ? 'filled' : 'outlined'}
          sx={{ fontWeight: 600 }}
        />
      </Box>

      {/* Content Container */}
      <Box>

        {/* Northstar Integrators Tab Content */}
        {activeTab === 0 && (
          <Box>
            {/* Filters */}
            <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search case studies..."
                value={integratorSearch}
                onChange={(e) => setIntegratorSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleIntegratorSearch()}
                sx={{
                  flex: 1,
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'background.paper',
                  },
                }}
              />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Filter by Tag</InputLabel>
                <Select
                  value={integratorTagFilter}
                  onChange={(e) => setIntegratorTagFilter(e.target.value)}
                  label="Filter by Tag"
                  sx={{ bgcolor: 'background.paper' }}
                >
                  <MenuItem value="">All Tags</MenuItem>
                  {integratorTags.map((tag) => (
                    <MenuItem key={tag} value={tag}>{tag}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                startIcon={<Search />}
                onClick={handleIntegratorSearch}
                sx={{
                  borderColor: '#cbd5e1',
                  color: 'text.secondary',
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': {
                    borderColor: '#94a3b8',
                    bgcolor: 'background.default',
                  },
                }}
              >
                Search
              </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'rgba(30, 35, 50, 0.5)' }}>
                        <TableCell sx={{ fontWeight: 700, color: '#f8fafc' }}>Title</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#f8fafc' }}>Industry</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#f8fafc' }}>Tags</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#f8fafc' }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {enterpriseCases.map((caseStudy, index) => (
                        <React.Fragment key={index}>
                          <TableRow
                            hover
                            sx={{
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.08)' },
                            }}
                            onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                          >
                            <TableCell>
                              <Typography variant="body2" fontWeight={600} sx={{ color: '#f8fafc' }}>
                                {caseStudy.title}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                {caseStudy.industry || 'Not specified'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {caseStudy.tags?.slice(0, 2).map((tag, i) => (
                                  <Chip
                                    key={i}
                                    label={tag}
                                    size="small"
                                    color="primary"
                                    sx={{ fontWeight: 600, minWidth: 70 }}
                                  />
                                ))}
                                {caseStudy.tags?.length > 2 && (
                                  <Chip
                                    label={`+${caseStudy.tags.length - 2}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      borderColor: '#475569',
                                      color: '#cbd5e1',
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRow(expandedRow === index ? null : index);
                                }}
                                sx={{
                                  color: 'text.disabled',
                                  '&:hover': {
                                    color: 'secondary.main',
                                    bgcolor: 'rgba(37, 99, 235, 0.1)',
                                  },
                                }}
                              >
                                {expandedRow === index ? <ExpandLess /> : <ExpandMore />}
                              </IconButton>
                              {caseStudy.url && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(caseStudy.url, '_blank');
                                  }}
                                  sx={{
                                    color: 'text.disabled',
                                    '&:hover': {
                                      color: 'secondary.main',
                                      bgcolor: 'rgba(37, 99, 235, 0.1)',
                                    },
                                  }}
                                >
                                  <Launch fontSize="small" />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={4} sx={{ py: 0, borderBottom: 'none' }}>
                              <Collapse in={expandedRow === index}>
                                <Box sx={{ p: 3, bgcolor: 'background.default', borderTop: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
                                  <Typography variant="body2" sx={{ color: 'text.primary', mb: 2, lineHeight: 1.7, fontSize: '0.9375rem' }}>
                                    {caseStudy.description}
                                  </Typography>
                                  {caseStudy.tags && caseStudy.tags.length > 0 && (
                                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
                                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1, display: 'block', letterSpacing: '0.05em' }}>
                                        All Tags
                                      </Typography>
                                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {caseStudy.tags.map((tag, i) => (
                                          <Chip
                                            key={i}
                                            label={tag}
                                            size="small"
                                            sx={{
                                              fontSize: '0.75rem',
                                              bgcolor: '#e0e7ff',
                                              color: '#3730a3',
                                              fontWeight: 600,
                                              border: '1px solid #c7d2fe',
                                            }}
                                          />
                                        ))}
                                      </Box>
                                    </Box>
                                  )}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={integratorTotal}
                  page={integratorPage}
                  onPageChange={(_, newPage) => setIntegratorPage(newPage)}
                  rowsPerPage={integratorPageSize}
                  onRowsPerPageChange={(e) => {
                    setIntegratorPageSize(parseInt(e.target.value, 10));
                    setIntegratorPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </>
            )}
          </Box>
        )}

        {/* Northstar library Tab Content */}
        {activeTab === 1 && (
          <Box>
            {/* Filters */}
            <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search case studies..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLibrarySearch()}
                sx={{
                  flex: 1,
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'background.paper',
                  },
                }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Industry</InputLabel>
                <Select
                  value={libraryIndustryFilter}
                  onChange={(e) => setLibraryIndustryFilter(e.target.value)}
                  label="Industry"
                  sx={{ bgcolor: 'background.paper' }}
                >
                  <MenuItem value="">All Industries</MenuItem>
                  {libraryIndustries.map((industry) => (
                    <MenuItem key={industry} value={industry}>{industry}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Technology</InputLabel>
                <Select
                  value={libraryTechFilter}
                  onChange={(e) => setLibraryTechFilter(e.target.value)}
                  label="Technology"
                  sx={{ bgcolor: 'background.paper' }}
                >
                  <MenuItem value="">All Technologies</MenuItem>
                  {libraryTechnologies.map((tech) => (
                    <MenuItem key={tech} value={tech}>{tech}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                startIcon={<Search />}
                onClick={handleLibrarySearch}
                sx={{
                  borderColor: '#cbd5e1',
                  color: 'text.secondary',
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': {
                    borderColor: '#94a3b8',
                    bgcolor: 'background.default',
                  },
                }}
              >
                Search
              </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'rgba(30, 35, 50, 0.5)' }}>
                        <TableCell sx={{ fontWeight: 700, color: '#f8fafc' }}>Title</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#f8fafc' }}>Client</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#f8fafc' }}>Industry</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#f8fafc' }}>Technologies</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#f8fafc' }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {libraryCases.map((caseStudy, index) => (
                        <React.Fragment key={index}>
                          <TableRow
                            hover
                            sx={{
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.08)' },
                            }}
                            onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                          >
                            <TableCell>
                              <Typography variant="body2" fontWeight={600} sx={{ color: '#f8fafc' }}>
                                {caseStudy.title}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                                {caseStudy.client_company_name || 'Not specified'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                {caseStudy.industry_sector || 'Not specified'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {Array.isArray(caseStudy.key_technologies_used) && caseStudy.key_technologies_used.slice(0, 2).map((tech, i) => (
                                  <Chip
                                    key={i}
                                    label={tech}
                                    size="small"
                                    color="success"
                                    sx={{ fontWeight: 600, minWidth: 70 }}
                                  />
                                ))}
                                {Array.isArray(caseStudy.key_technologies_used) && caseStudy.key_technologies_used.length > 2 && (
                                  <Chip
                                    label={`+${caseStudy.key_technologies_used.length - 2}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      borderColor: '#475569',
                                      color: '#cbd5e1',
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRow(expandedRow === index ? null : index);
                                }}
                                sx={{
                                  color: 'text.disabled',
                                  '&:hover': {
                                    color: 'secondary.main',
                                    bgcolor: 'rgba(37, 99, 235, 0.1)',
                                  },
                                }}
                              >
                                {expandedRow === index ? <ExpandLess /> : <ExpandMore />}
                              </IconButton>
                              {caseStudy.url && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(caseStudy.url, '_blank');
                                  }}
                                  sx={{
                                    color: 'text.disabled',
                                    '&:hover': {
                                      color: 'secondary.main',
                                      bgcolor: 'rgba(37, 99, 235, 0.1)',
                                    },
                                  }}
                                >
                                  <Launch fontSize="small" />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={5} sx={{ py: 0, borderBottom: 'none' }}>
                              <Collapse in={expandedRow === index}>
                                <Box sx={{ p: 3, bgcolor: 'background.default', borderTop: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
                                  <Typography variant="body2" sx={{ color: 'text.primary', mb: 2, lineHeight: 1.7, fontSize: '0.9375rem' }}>
                                    {caseStudy.description}
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: 'text.primary', mb: 2, lineHeight: 1.7, fontSize: '0.9375rem' }}>
                                    <strong style={{ color: 'text.primary', fontWeight: 700 }}>Challenge:</strong> {caseStudy.challenge_problem_solved}
                                  </Typography>
                                  {Array.isArray(caseStudy.results_benefits_achieved) && caseStudy.results_benefits_achieved.length > 0 && (
                                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
                                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1, display: 'block', letterSpacing: '0.05em' }}>
                                        Results & Benefits
                                      </Typography>
                                      <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
                                        {caseStudy.results_benefits_achieved.map((result, i) => (
                                          <li key={i} style={{ marginBottom: '0.5rem' }}>
                                            <Typography variant="body2" sx={{ color: 'text.primary', fontSize: '0.875rem', fontWeight: 500 }}>
                                              {result}
                                            </Typography>
                                          </li>
                                        ))}
                                      </ul>
                                    </Box>
                                  )}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={libraryTotal}
                  page={libraryPage}
                  onPageChange={(_, newPage) => setLibraryPage(newPage)}
                  rowsPerPage={libraryPageSize}
                  onRowsPerPageChange={(e) => {
                    setLibraryPageSize(parseInt(e.target.value, 10));
                    setLibraryPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CaseStudiesPage;
