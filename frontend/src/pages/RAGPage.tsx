import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Search,
  Refresh,
  Storage,
  Business,
  Description,
  People,
  MeetingRoom,
  Handshake,
  NoteAdd,
  Assessment,
  CheckCircle,
} from '@mui/icons-material';
import { apiGet, apiPost } from '../utils/api';

interface CollectionStats {
  name: string;
  count: number;
}

interface SearchResult {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
  collection: string;
}

interface CollectionInfo {
  name: string;
  display_name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const COLLECTION_INFO: Record<string, CollectionInfo> = {
  case_studies: {
    name: 'case_studies',
    display_name: 'Case Studies',
    icon: <Description />,
    color: 'success.main',
    description: 'Northstar Integrators and Northstar library customer success stories',
  },
  company_research: {
    name: 'company_research',
    display_name: 'Company Research',
    icon: <Business />,
    color: 'secondary.main',
    description: 'AI-powered company analysis and research',
  },
  transcripts: {
    name: 'transcripts',
    display_name: 'Transcripts',
    icon: <NoteAdd />,
    color: '#8b5cf6',
    description: 'Meeting transcript analyses with insights',
  },
  meetings: {
    name: 'meetings',
    display_name: 'Meetings',
    icon: <MeetingRoom />,
    color: 'warning.main',
    description: 'Sales meetings and notes',
  },
  deals: {
    name: 'deals',
    display_name: 'Deals',
    icon: <Handshake />,
    color: 'error.main',
    description: 'Sales opportunities and pipelines',
  },
  attendees: {
    name: 'attendees',
    display_name: 'Attendees',
    icon: <People />,
    color: '#06b6d4',
    description: 'Contact profiles and stakeholders',
  },
  documents: {
    name: 'documents',
    display_name: 'Documents',
    icon: <Assessment />,
    color: '#ec4899',
    description: 'Uploaded documents and files',
  },
};

const RAGPage: React.FC = () => {
  const [stats, setStats] = useState<CollectionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [topK, setTopK] = useState(10);
  const [minSimilarity, setMinSimilarity] = useState(0.5);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [indexing, setIndexing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/rag/stats');
      if (response.success) {
        setStats(response.data.collections);
      }
    } catch (err: any) {
      console.error('Error loading stats:', err);
      setError('Failed to load collection statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    try {
      setSearching(true);
      setError('');
      setSearchResults([]);

      const payload: any = {
        query: searchQuery,
        topK,
        minSimilarity,
      };

      if (selectedCollections.length > 0) {
        payload.collections = selectedCollections;
      }

      const response = await apiPost('/api/rag/search', payload);

      if (response.success) {
        setSearchResults(response.data.results);
        if (response.data.results.length === 0) {
          setError('No results found. Try adjusting your search query or similarity threshold.');
        }
      }
    } catch (err: any) {
      console.error('Error searching:', err);
      setError(err.error || 'Failed to perform search');
    } finally {
      setSearching(false);
    }
  };

  const handleIndexAll = async () => {
    if (!window.confirm('This will re-index all data and may take several minutes. Continue?')) {
      return;
    }

    try {
      setIndexing(true);
      setError('');
      setSuccess('');

      const response = await apiPost('/api/rag/index/all', {});

      if (response.success) {
        setSuccess('All collections indexed successfully!');
        loadStats();
      }
    } catch (err: any) {
      console.error('Error indexing:', err);
      setError(err.error || 'Failed to index collections');
    } finally {
      setIndexing(false);
    }
  };

  const handleIndexCollection = async (collection: string) => {
    if (!window.confirm(`Re-index ${collection}? This may take a few minutes.`)) {
      return;
    }

    try {
      setIndexing(true);
      setError('');
      setSuccess('');

      const response = await apiPost(`/api/rag/index/${collection}`, {});

      if (response.success) {
        setSuccess(`${collection} indexed successfully!`);
        loadStats();
      }
    } catch (err: any) {
      console.error('Error indexing collection:', err);
      setError(err.error || 'Failed to index collection');
    } finally {
      setIndexing(false);
    }
  };

  const handleCollectionChange = (event: any) => {
    const value = event.target.value;
    setSelectedCollections(typeof value === 'string' ? value.split(',') : value);
  };

  const getCollectionInfo = (name: string): CollectionInfo => {
    return COLLECTION_INFO[name] || {
      name,
      display_name: name,
      icon: <Storage />,
      color: 'text.secondary',
      description: 'Data collection',
    };
  };

  const formatSimilarity = (score: number): string => {
    return (score * 100).toFixed(1) + '%';
  };

  const totalDocuments = stats.reduce((sum, stat) => sum + stat.count, 0);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          RAG Search
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Semantic search across all your sales intelligence data
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Collection Stats */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Collection Statistics
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Documents: {totalDocuments.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Tooltip title="Refresh stats">
                <IconButton onClick={loadStats} disabled={loading}>
                  <Refresh />
                </IconButton>
              </Tooltip>
              <Tooltip title="Re-index all collections">
                <Button
                  variant="contained"
                  startIcon={indexing ? <CircularProgress size={16} /> : <Storage />}
                  onClick={handleIndexAll}
                  disabled={indexing}
                  sx={{ ml: 1 }}
                >
                  Index All
                </Button>
              </Tooltip>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
              {stats.map((stat) => {
                const info = getCollectionInfo(stat.name);
                return (
                  <Box key={stat.name}>
                    <Card
                      sx={{
                        border: `2px solid ${info.color}20`,
                        '&:hover': {
                          borderColor: `${info.color}40`,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s',
                        },
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Box
                            sx={{
                              backgroundColor: `${info.color}20`,
                              color: info.color,
                              p: 1,
                              borderRadius: 1,
                              mr: 2,
                            }}
                          >
                            {info.icon}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {info.display_name}
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: info.color }}>
                              {stat.count.toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          {info.description}
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => handleIndexCollection(stat.name)}
                          disabled={indexing}
                          sx={{ mt: 1 }}
                        >
                          Re-index
                        </Button>
                      </CardContent>
                    </Card>
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Search Interface */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            Semantic Search
          </Typography>

          {/* Search Query */}
          <TextField
            fullWidth
            label="Search Query"
            placeholder="e.g., Tell me about Jira implementations in healthcare"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            sx={{ mb: 3 }}
            disabled={searching}
          />

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            {/* Collection Filter */}
            <Box sx={{ flex: { xs: '0 0 100%', md: '0 0 48%' } }}>
              <FormControl fullWidth>
                <InputLabel>Collections to Search</InputLabel>
                <Select
                  multiple
                  value={selectedCollections}
                  onChange={handleCollectionChange}
                  input={<OutlinedInput label="Collections to Search" />}
                  renderValue={(selected) =>
                    selected.length === 0
                      ? 'All Collections'
                      : selected.map((s) => getCollectionInfo(s).display_name).join(', ')
                  }
                >
                  {stats.map((stat) => {
                    const info = getCollectionInfo(stat.name);
                    return (
                      <MenuItem key={stat.name} value={stat.name}>
                        <Checkbox checked={selectedCollections.indexOf(stat.name) > -1} />
                        <ListItemText
                          primary={info.display_name}
                          secondary={`${stat.count} documents`}
                        />
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Box>

            {/* Top K Results */}
            <Box sx={{ flex: { xs: '0 0 50%', md: '0 0 25%' } }}>
              <TextField
                fullWidth
                type="number"
                label="Max Results"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value) || 10)}
                inputProps={{ min: 1, max: 50 }}
              />
            </Box>

            {/* Minimum Similarity */}
            <Box sx={{ flex: { xs: '0 0 50%', md: '0 0 25%' } }}>
              <TextField
                fullWidth
                type="number"
                label="Min Similarity"
                value={minSimilarity}
                onChange={(e) => setMinSimilarity(parseFloat(e.target.value) || 0.5)}
                inputProps={{ min: 0, max: 1, step: 0.1 }}
              />
            </Box>
          </Box>

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={searching ? <CircularProgress size={20} /> : <Search />}
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
          >
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Search Results ({searchResults.length})
            </Typography>

            <Stack spacing={2}>
              {searchResults.map((result, index) => {
                const info = getCollectionInfo(result.collection);
                return (
                  <Paper
                    key={index}
                    sx={{
                      p: 3,
                      border: `1px solid ${info.color}30`,
                      '&:hover': {
                        borderColor: `${info.color}60`,
                        boxShadow: 2,
                      },
                    }}
                  >
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ color: info.color }}>{info.icon}</Box>
                        <Chip
                          label={info.display_name}
                          size="small"
                          sx={{ backgroundColor: `${info.color}20`, color: info.color }}
                        />
                        <Chip
                          label={formatSimilarity(result.similarity)}
                          size="small"
                          icon={<CheckCircle />}
                          color="success"
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        ID: {result.id}
                      </Typography>
                    </Box>

                    {/* Content */}
                    <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
                      {result.content.substring(0, 500)}
                      {result.content.length > 500 && '...'}
                    </Typography>

                    {/* Metadata */}
                    <Divider sx={{ my: 2 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Metadata:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {Object.entries(result.metadata)
                          .filter(([key]) => key !== 'created_at' && key !== 'updated_at')
                          .map(([key, value]) => (
                            <Chip
                              key={key}
                              label={`${key}: ${value}`}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default RAGPage;
