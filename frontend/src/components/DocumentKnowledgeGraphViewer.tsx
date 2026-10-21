import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Card,
  CardContent,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  IconButton,
  Alert,
  List,
  ListItemText,
  ListItemButton,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Refresh,
  AutoAwesome,
  AccountTree,
  Description,
  Assessment,
  Search,
  Add,
  Link as LinkIcon,
  Label
} from '@mui/icons-material';
import { API_BASE_URL } from '../config';

interface GraphNode {
  id: string;
  type: 'document' | 'analysis';
  filename?: string;
  company_name?: string;
  tags: string[];
  num_chunks?: number;
  upload_date?: string;
  completed_at?: string;
  metadata?: any;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  created_at: string;
  metadata?: any;
}

interface Cluster {
  id: string;
  name: string;
  description: string;
  doc_ids: string[];
  tags: string[];
  type: 'manual' | 'auto_tag' | 'auto_analysis';
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: {
    manual: Cluster[];
    auto: Cluster[];
  };
  statistics: any;
}

const DocumentKnowledgeGraphViewer: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [filterNodeType, setFilterNodeType] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'full' | 'cluster'>('full');

  // Dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState<string[]>([]);
  const [selectedForCluster, setSelectedForCluster] = useState<string[]>([]);

  // Form states
  const [linkType, setLinkType] = useState('related');
  const [clusterName, setClusterName] = useState('');
  const [clusterDescription, setClusterDescription] = useState('');
  const [clusterTags, setClusterTags] = useState('');
  const [documentTags, setDocumentTags] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch graph data
  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/rag/graph/full`);
      const data = await response.json();
      if (data.success) {
        setGraphData(data);
      }
    } catch (error) {
      console.error('Error fetching graph data:', error);
      setErrorMessage('Failed to load graph data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  // Auto-cluster by tags
  const handleAutoClusterTags = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rag/graph/auto-cluster/tags`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage(`Created ${data.count} tag-based clusters`);
        await fetchGraphData();
      }
    } catch (error) {
      console.error('Error auto-clustering by tags:', error);
      setErrorMessage('Failed to auto-cluster by tags');
    }
  };

  // Auto-cluster by analyses
  const handleAutoClusterAnalyses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rag/graph/auto-cluster/analyses`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage(`Created ${data.count} analysis-based clusters`);
        await fetchGraphData();
      }
    } catch (error) {
      console.error('Error auto-clustering by analyses:', error);
      setErrorMessage('Failed to auto-cluster by analyses');
    }
  };

  // Handle cluster selection
  const handleSelectCluster = async (clusterId: string) => {
    setSelectedCluster(clusterId);
    setViewMode('cluster');
  };

  // Create manual link between documents
  const handleCreateLink = async () => {
    if (selectedForLink.length !== 2) {
      setErrorMessage('Please select exactly 2 documents to link');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/rag/link-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_doc_id: selectedForLink[0],
          target_doc_id: selectedForLink[1],
          relationship_type: linkType
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage('Documents linked successfully!');
        setLinkDialogOpen(false);
        setSelectedForLink([]);
        setLinkType('related');
        await fetchGraphData();
      }
    } catch (error) {
      console.error('Error linking documents:', error);
      setErrorMessage('Failed to link documents');
    }
  };

  // Create manual cluster
  const handleCreateCluster = async () => {
    if (selectedForCluster.length === 0) {
      setErrorMessage('Please select at least one document for the cluster');
      return;
    }
    if (!clusterName.trim()) {
      setErrorMessage('Please provide a cluster name');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/rag/graph/cluster/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cluster_name: clusterName,
          doc_ids: selectedForCluster,
          description: clusterDescription,
          tags: clusterTags.split(',').map(t => t.trim()).filter(t => t)
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage(`Cluster "${clusterName}" created successfully!`);
        setClusterDialogOpen(false);
        setSelectedForCluster([]);
        setClusterName('');
        setClusterDescription('');
        setClusterTags('');
        await fetchGraphData();
      }
    } catch (error) {
      console.error('Error creating cluster:', error);
      setErrorMessage('Failed to create cluster');
    }
  };

  // Tag document
  const handleTagDocument = async () => {
    if (!selectedNode) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/rag/tag-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: selectedNode.id,
          tags: documentTags.split(',').map(t => t.trim()).filter(t => t)
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage('Document tagged successfully!');
        setTagDialogOpen(false);
        setDocumentTags('');
        await fetchGraphData();
      }
    } catch (error) {
      console.error('Error tagging document:', error);
      setErrorMessage('Failed to tag document');
    }
  };

  // Filter nodes based on current filters
  const getFilteredData = () => {
    if (!graphData) return { nodes: [], edges: [] };

    let nodes = [...graphData.nodes];
    let edges = [...graphData.edges];

    // Filter by node type
    if (filterNodeType !== 'all') {
      nodes = nodes.filter(n => n.type === filterNodeType);
    }

    // Filter by tag
    if (filterTag !== 'all') {
      nodes = nodes.filter(n => n.tags.includes(filterTag));
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      nodes = nodes.filter(n =>
        (n.filename && n.filename.toLowerCase().includes(query)) ||
        (n.company_name && n.company_name.toLowerCase().includes(query)) ||
        n.tags.some(t => t.toLowerCase().includes(query)) ||
        n.id.toLowerCase().includes(query)
      );
    }

    // Filter by cluster if in cluster view
    if (viewMode === 'cluster' && selectedCluster && graphData.clusters) {
      const cluster = [...graphData.clusters.manual, ...graphData.clusters.auto].find(
        c => c.id === selectedCluster
      );
      if (cluster) {
        const clusterNodeIds = new Set(cluster.doc_ids);
        nodes = nodes.filter(n => clusterNodeIds.has(n.id));
      }
    }

    // Filter edges to only include those connecting visible nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    return { nodes, edges };
  };

  // All unique tags
  const getAllTags = () => {
    if (!graphData) return [];
    const tags = new Set<string>();
    graphData.nodes.forEach(n => n.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  };

  // Toggle document selection for linking/clustering
  const toggleDocumentSelection = (docId: string, forLink: boolean = false) => {
    if (forLink) {
      setSelectedForLink(prev =>
        prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
      );
    } else {
      setSelectedForCluster(prev =>
        prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
      );
    }
  };

  const filteredData = getFilteredData();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!graphData) {
    return (
      <Alert severity="error">Failed to load knowledge graph data</Alert>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Success/Error Messages */}
      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage('')} sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert severity="error" onClose={() => setErrorMessage('')} sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {/* Header with controls */}
      <Paper sx={{ p: 1.5, mb: 1.5, bgcolor: 'rgba(30, 41, 59, 0.95)', border: '1px solid #334155' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, fontSize: '1.1rem' }}>
            <AccountTree fontSize="small" /> Knowledge Graph
          </Typography>

          <Chip
            label={`${graphData.statistics.documents} Docs · ${graphData.statistics.analyses} Analyses · ${graphData.statistics.total_edges} Links`}
            size="small"
            sx={{ bgcolor: 'rgba(37, 99, 235, 0.15)', color: 'text.disabled', fontSize: '0.75rem' }}
          />

          <Box sx={{ flexGrow: 1 }} />

          {/* Search */}
          <TextField
            size="small"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: 180,
              '& .MuiOutlinedInput-root': { height: 32 },
              '& .MuiInputBase-input': { fontSize: '0.875rem' }
            }}
            slotProps={{
              input: {
                startAdornment: <Search sx={{ mr: 0.5, color: 'text.secondary', fontSize: '1rem' }} />
              }
            }}
          />

          {/* Filters */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ fontSize: '0.875rem' }}>Type</InputLabel>
            <Select
              value={filterNodeType}
              label="Node Type"
              onChange={(e) => setFilterNodeType(e.target.value)}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="document">Documents</MenuItem>
              <MenuItem value="analysis">Analyses</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ fontSize: '0.875rem' }}>Tag</InputLabel>
            <Select
              value={filterTag}
              label="Tag"
              onChange={(e) => setFilterTag(e.target.value)}
              sx={{ '& .MuiSelect-select': { fontSize: '0.875rem' } }}
            >
              <MenuItem value="all">All Tags</MenuItem>
              {getAllTags().map(tag => (
                <MenuItem key={tag} value={tag}>{tag}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <IconButton onClick={fetchGraphData} size="small" sx={{ color: 'text.disabled' }}>
            <Refresh fontSize="small" />
          </IconButton>
        </Stack>

        {/* Action buttons row */}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap">
          <Button
            variant="contained"
            size="small"
            startIcon={<LinkIcon fontSize="small" />}
            onClick={() => setLinkDialogOpen(true)}
            sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.main' }, fontSize: '0.8rem', py: 0.5 }}
          >
            Link Docs
          </Button>

          <Button
            variant="contained"
            size="small"
            startIcon={<Add fontSize="small" />}
            onClick={() => setClusterDialogOpen(true)}
            sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' }, fontSize: '0.8rem', py: 0.5 }}
          >
            Create Cluster
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<AutoAwesome fontSize="small" />}
            onClick={handleAutoClusterTags}
            sx={{ color: 'success.main', borderColor: '#10b981', fontSize: '0.8rem', py: 0.5 }}
          >
            Auto (Tags)
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<AutoAwesome fontSize="small" />}
            onClick={handleAutoClusterAnalyses}
            sx={{ color: 'warning.main', borderColor: '#f59e0b', fontSize: '0.8rem', py: 0.5 }}
          >
            Auto (Analyses)
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
            sx={{ height: 28 }}
          >
            <ToggleButton value="full" sx={{ fontSize: '0.75rem', px: 1.5, py: 0.5, color: 'text.disabled', '&.Mui-selected': { color: 'secondary.main', bgcolor: 'rgba(37, 99, 235, 0.2)' } }}>
              Full
            </ToggleButton>
            <ToggleButton value="cluster" sx={{ fontSize: '0.75rem', px: 1.5, py: 0.5, color: 'text.disabled', '&.Mui-selected': { color: 'secondary.main', bgcolor: 'rgba(37, 99, 235, 0.2)' } }} disabled={!selectedCluster}>
              Cluster
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* Main content area */}
      <Box sx={{ display: 'flex', gap: 1.5, flexGrow: 1, minHeight: 0 }}>
        {/* Clusters panel */}
        <Paper sx={{ width: 240, p: 1.5, bgcolor: 'rgba(30, 41, 59, 0.95)', border: '1px solid #334155', overflowY: 'auto' }}>
          <Typography variant="subtitle1" sx={{ color: '#f8fafc', mb: 1.5, fontWeight: 600, fontSize: '0.95rem' }}>
            Clusters
          </Typography>

          {/* Manual Clusters */}
          {graphData.clusters.manual.length > 0 && (
            <>
              <Typography variant="caption" sx={{ color: 'text.disabled', mb: 0.5, fontWeight: 600, display: 'block' }}>
                MANUAL
              </Typography>
              <List dense sx={{ mb: 1 }}>
                {graphData.clusters.manual.map(cluster => (
                  <ListItemButton
                    key={cluster.id}
                    onClick={() => handleSelectCluster(cluster.id)}
                    selected={selectedCluster === cluster.id}
                    sx={{
                      borderRadius: 1,
                      mb: 0.3,
                      py: 0.5,
                      px: 1,
                      '&.Mui-selected': {
                        bgcolor: 'rgba(37, 99, 235, 0.2)',
                        borderLeft: '2px solid #2563eb'
                      }
                    }}
                  >
                    <ListItemText
                      primary={cluster.name}
                      secondary={`${cluster.doc_ids.length} docs`}
                      slotProps={{
                        primary: { sx: { color: '#f8fafc', fontSize: '0.8rem' } },
                        secondary: { sx: { color: 'text.secondary', fontSize: '0.7rem' } }
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </>
          )}

          {/* Auto Clusters */}
          {graphData.clusters.auto.length > 0 && (
            <>
              <Typography variant="caption" sx={{ color: 'text.disabled', mb: 0.5, fontWeight: 600, display: 'block' }}>
                AUTO
              </Typography>
              <List dense>
                {graphData.clusters.auto.map(cluster => (
                  <ListItemButton
                    key={cluster.id}
                    onClick={() => handleSelectCluster(cluster.id)}
                    selected={selectedCluster === cluster.id}
                    sx={{
                      borderRadius: 1,
                      mb: 0.3,
                      py: 0.5,
                      px: 1,
                      '&.Mui-selected': {
                        bgcolor: 'rgba(16, 185, 129, 0.2)',
                        borderLeft: '2px solid #10b981'
                      }
                    }}
                  >
                    <ListItemText
                      primary={cluster.name}
                      secondary={`${cluster.doc_ids.length} docs`}
                      slotProps={{
                        primary: { sx: { color: '#f8fafc', fontSize: '0.8rem' } },
                        secondary: { sx: { color: 'text.secondary', fontSize: '0.7rem' } }
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </>
          )}

          {graphData.clusters.manual.length === 0 && graphData.clusters.auto.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center', mt: 2 }}>
              No clusters yet
            </Typography>
          )}
        </Paper>

        {/* Nodes grid view */}
        <Paper sx={{ flexGrow: 1, bgcolor: 'text.primary', border: '1px solid #334155', p: 2, overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'flex-start' }}>
            {filteredData.nodes.map((node) => {
              const connections = graphData.edges.filter(e => e.source === node.id || e.target === node.id).length;
              const isDocument = node.type === 'document';

              return (
                <Card
                  key={node.id}
                  sx={{
                    width: 180,
                    height: 180,
                    bgcolor: isDocument ? 'rgba(37, 99, 235, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    border: selectedNode?.id === node.id
                      ? `3px solid ${isDocument ? '#3b82f6' : '#10b981'}`
                      : `2px solid ${isDocument ? 'rgba(37, 99, 235, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: `0 0 20px ${isDocument ? 'rgba(37, 99, 235, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                      border: `3px solid ${isDocument ? '#3b82f6' : '#10b981'}`
                    }
                  }}
                  onClick={() => setSelectedNode(node)}
                >
                  <CardContent sx={{ textAlign: 'center', p: 2 }}>
                    {/* Icon */}
                    <Box sx={{ mb: 1 }}>
                      {isDocument ? (
                        <Description sx={{ color: 'secondary.main', fontSize: 32 }} />
                      ) : (
                        <Assessment sx={{ color: 'success.main', fontSize: 32 }} />
                      )}
                    </Box>

                    {/* Title */}
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#f8fafc',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mb: 0.5
                      }}
                    >
                      {(node.filename || node.company_name || node.id).length > 15
                        ? (node.filename || node.company_name || node.id).substring(0, 15) + '...'
                        : (node.filename || node.company_name || node.id)}
                    </Typography>

                    {/* Connection count badge */}
                    {connections > 0 && (
                      <Chip
                        label={`${connections} link${connections > 1 ? 's' : ''}`}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(245, 158, 11, 0.3)',
                          color: '#fbbf24',
                          fontSize: '0.65rem',
                          height: 18,
                          fontWeight: 600
                        }}
                      />
                    )}

                    {/* Tags indicator */}
                    {node.tags && node.tags.length > 0 && (
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', display: 'block', mt: 0.5 }}>
                        {node.tags.length} tag{node.tags.length > 1 ? 's' : ''}
                      </Typography>
                    )}

                    {/* Tag button for documents */}
                    {isDocument && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                          setDocumentTags(node.tags.join(', '));
                          setTagDialogOpen(true);
                        }}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: 'rgba(30, 41, 59, 0.8)',
                          color: 'text.disabled',
                          width: 24,
                          height: 24,
                          '&:hover': {
                            bgcolor: 'rgba(59, 130, 246, 0.3)'
                          }
                        }}
                      >
                        <Label sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>

          {filteredData.nodes.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
                No nodes found
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Try adjusting your filters or upload some documents first
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Node details panel */}
        {selectedNode && (
          <Paper sx={{ width: 350, p: 2, bgcolor: 'rgba(30, 41, 59, 0.95)', border: '1px solid #334155', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 600 }}>
                Node Details
              </Typography>
              <IconButton size="small" onClick={() => setSelectedNode(null)} sx={{ color: 'text.disabled' }}>
                ✕
              </IconButton>
            </Box>

            <Chip
              label={selectedNode.type}
              size="small"
              icon={selectedNode.type === 'document' ? <Description /> : <Assessment />}
              sx={{
                mb: 2,
                bgcolor: selectedNode.type === 'document' ? 'rgba(37, 99, 235, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: selectedNode.type === 'document' ? '#3b82f6' : '#10b981'
              }}
            />

            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                  {selectedNode.type === 'document' ? 'Filename' : 'Company'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                  {selectedNode.filename || selectedNode.company_name || selectedNode.id}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                  ID
                </Typography>
                <Typography variant="body2" sx={{ color: '#f8fafc', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {selectedNode.id}
                </Typography>
              </Box>

              {selectedNode.tags && selectedNode.tags.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 1 }}>
                    Tags
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedNode.tags.map(tag => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(148, 163, 184, 0.2)',
                          color: '#cbd5e1',
                          fontSize: '0.7rem'
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {selectedNode.num_chunks && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                    Chunks
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                    {selectedNode.num_chunks}
                  </Typography>
                </Box>
              )}

              <Box>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                  {selectedNode.type === 'document' ? 'Uploaded' : 'Completed'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                  {new Date(selectedNode.upload_date || selectedNode.completed_at || '').toLocaleDateString()}
                </Typography>
              </Box>

              {/* Show connections */}
              <Box>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 1 }}>
                  Connections
                </Typography>
                <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                  {graphData.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length} relationships
                </Typography>

                {/* Show connected documents */}
                {graphData.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).map(edge => {
                  const connectedId = edge.source === selectedNode.id ? edge.target : edge.source;
                  const connectedNode = graphData.nodes.find(n => n.id === connectedId);
                  return connectedNode ? (
                    <Box key={edge.source + edge.target} sx={{ mt: 1, p: 1, bgcolor: 'rgba(15, 23, 42, 0.5)', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block' }}>
                        {edge.type} → {connectedNode.filename || connectedNode.company_name}
                      </Typography>
                    </Box>
                  ) : null;
                })}
              </Box>
            </Stack>
          </Paper>
        )}
      </Box>

      {/* Statistics */}
      <Paper sx={{ p: 2, mt: 2, bgcolor: 'rgba(30, 41, 59, 0.95)', border: '1px solid #334155' }}>
        <Typography variant="subtitle2" sx={{ color: '#f8fafc', mb: 1, fontWeight: 600 }}>
          Graph Statistics
        </Typography>
        <Stack direction="row" spacing={3}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Documents</Typography>
            <Typography variant="h6" sx={{ color: 'secondary.main', fontWeight: 600 }}>{graphData.statistics.documents}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Analyses</Typography>
            <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 600 }}>{graphData.statistics.analyses}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Relationships</Typography>
            <Typography variant="h6" sx={{ color: 'warning.main', fontWeight: 600 }}>{graphData.statistics.total_edges}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Tags</Typography>
            <Typography variant="h6" sx={{ color: '#a78bfa', fontWeight: 600 }}>{graphData.statistics.total_tags}</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Link Documents Dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: 'text.primary', color: '#f8fafc' }}>
          Link Documents
        </DialogTitle>
        <DialogContent sx={{ bgcolor: 'text.primary', pt: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.disabled', mb: 2 }}>
            Select exactly 2 documents to create a relationship between them.
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Relationship Type</InputLabel>
            <Select
              value={linkType}
              label="Relationship Type"
              onChange={(e) => setLinkType(e.target.value)}
            >
              <MenuItem value="related">Related</MenuItem>
              <MenuItem value="references">References</MenuItem>
              <MenuItem value="similar">Similar</MenuItem>
              <MenuItem value="contradicts">Contradicts</MenuItem>
              <MenuItem value="updates">Updates</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="subtitle2" sx={{ color: '#f8fafc', mb: 1 }}>
            Select Documents ({selectedForLink.length}/2):
          </Typography>

          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {filteredData.nodes.filter(n => n.type === 'document').map((node) => (
              <FormControlLabel
                key={node.id}
                control={
                  <Checkbox
                    checked={selectedForLink.includes(node.id)}
                    onChange={() => toggleDocumentSelection(node.id, true)}
                    disabled={selectedForLink.length >= 2 && !selectedForLink.includes(node.id)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                      {node.filename}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {node.id}
                    </Typography>
                  </Box>
                }
                sx={{ display: 'block', mb: 1, p: 1, borderRadius: 1, bgcolor: 'rgba(30, 41, 59, 0.5)' }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: 'text.primary' }}>
          <Button onClick={() => { setLinkDialogOpen(false); setSelectedForLink([]); }} sx={{ color: 'text.disabled' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateLink}
            variant="contained"
            disabled={selectedForLink.length !== 2}
            sx={{ bgcolor: 'secondary.main' }}
          >
            Create Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Cluster Dialog */}
      <Dialog open={clusterDialogOpen} onClose={() => setClusterDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: 'text.primary', color: '#f8fafc' }}>
          Create Document Cluster
        </DialogTitle>
        <DialogContent sx={{ bgcolor: 'text.primary', pt: 3 }}>
          <TextField
            fullWidth
            label="Cluster Name"
            value={clusterName}
            onChange={(e) => setClusterName(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Description (optional)"
            value={clusterDescription}
            onChange={(e) => setClusterDescription(e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Tags (comma-separated)"
            value={clusterTags}
            onChange={(e) => setClusterTags(e.target.value)}
            placeholder="e.g., AI, research, important"
            sx={{ mb: 3 }}
          />

          <Typography variant="subtitle2" sx={{ color: '#f8fafc', mb: 1 }}>
            Select Documents ({selectedForCluster.length} selected):
          </Typography>

          <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
            {filteredData.nodes.filter(n => n.type === 'document').map((node) => (
              <FormControlLabel
                key={node.id}
                control={
                  <Checkbox
                    checked={selectedForCluster.includes(node.id)}
                    onChange={() => toggleDocumentSelection(node.id, false)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                      {node.filename}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {node.id}
                    </Typography>
                  </Box>
                }
                sx={{ display: 'block', mb: 1, p: 1, borderRadius: 1, bgcolor: 'rgba(30, 41, 59, 0.5)' }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: 'text.primary' }}>
          <Button onClick={() => { setClusterDialogOpen(false); setSelectedForCluster([]); setClusterName(''); }} sx={{ color: 'text.disabled' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateCluster}
            variant="contained"
            disabled={selectedForCluster.length === 0 || !clusterName.trim()}
            sx={{ bgcolor: '#8b5cf6' }}
          >
            Create Cluster
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tag Document Dialog */}
      <Dialog open={tagDialogOpen} onClose={() => setTagDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'text.primary', color: '#f8fafc' }}>
          Tag Document
        </DialogTitle>
        <DialogContent sx={{ bgcolor: 'text.primary', pt: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.disabled', mb: 2 }}>
            Add tags to: {selectedNode?.filename}
          </Typography>
          <TextField
            fullWidth
            label="Tags (comma-separated)"
            value={documentTags}
            onChange={(e) => setDocumentTags(e.target.value)}
            placeholder="e.g., AI, transformers, important"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: 'text.primary' }}>
          <Button onClick={() => setTagDialogOpen(false)} sx={{ color: 'text.disabled' }}>
            Cancel
          </Button>
          <Button
            onClick={handleTagDocument}
            variant="contained"
            sx={{ bgcolor: 'success.main' }}
          >
            Save Tags
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentKnowledgeGraphViewer;
