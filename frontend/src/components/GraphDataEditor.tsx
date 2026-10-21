import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
} from '@mui/material';
import {
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Link as LinkIcon,
  Circle as NodeIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../config';

interface Node {
  id: string;
  label: string;
  group?: string;
  [key: string]: any;
}

interface Link {
  source: string;
  target: string;
  label?: string;
  [key: string]: any;
}

interface GraphDataEditorProps {
  graphId: string;
  initialData: {
    nodes: Node[];
    links: Link[];
  };
  onDataChange: (newData: { nodes: Node[]; links: Link[] }) => void;
}

const GraphDataEditor: React.FC<GraphDataEditorProps> = ({
  graphId,
  initialData,
  onDataChange,
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [editingLink, setEditingLink] = useState<Link | null>(null);

  // Form states for node
  const [nodeForm, setNodeForm] = useState({ id: '', label: '', group: '' });

  // Form states for link
  const [linkForm, setLinkForm] = useState({ source: '', target: '', label: '' });

  // Load data from backend on mount
  useEffect(() => {
    fetchGraphData();
  }, [graphId]);

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/knowledge-graphs/type/${graphId}`);
      const result = await response.json();

      if (result.success && result.data) {
        setNodes(result.data.nodes || []);
        setLinks(result.data.links || []);
      } else {
        // Use initial data if no saved data exists
        setNodes(initialData.nodes || []);
        setLinks(initialData.links || []);
      }
    } catch (err: any) {
      console.error('Error fetching graph data:', err);
      // Use initial data on error
      setNodes(initialData.nodes || []);
      setLinks(initialData.links || []);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/knowledge-graphs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graphType: graphId,
          name: `${graphId} Knowledge Graph`,
          description: `Knowledge graph for ${graphId}`,
          nodes,
          links,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to save graph');
      }

      onDataChange({ nodes, links });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(`Failed to save: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Node operations
  const handleAddNode = () => {
    setEditingNode(null);
    setNodeForm({ id: '', label: '', group: '' });
    setNodeDialogOpen(true);
  };

  const handleEditNode = (node: Node) => {
    setEditingNode(node);
    setNodeForm({ id: node.id, label: node.label, group: node.group || '' });
    setNodeDialogOpen(true);
  };

  const handleSaveNode = () => {
    if (!nodeForm.id || !nodeForm.label) {
      setError('Node ID and Label are required');
      return;
    }

    if (editingNode) {
      // Edit existing node
      setNodes(nodes.map((n) => (n.id === editingNode.id ? { ...n, ...nodeForm } : n)));
    } else {
      // Add new node
      if (nodes.find((n) => n.id === nodeForm.id)) {
        setError('Node ID must be unique');
        return;
      }
      setNodes([...nodes, nodeForm]);
    }

    setNodeDialogOpen(false);
    setError(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes(nodes.filter((n) => n.id !== nodeId));
    // Also delete links connected to this node
    setLinks(links.filter((l) => l.source !== nodeId && l.target !== nodeId));
  };

  // Link operations
  const handleAddLink = () => {
    setEditingLink(null);
    setLinkForm({ source: '', target: '', label: '' });
    setLinkDialogOpen(true);
  };

  const handleEditLink = (link: Link) => {
    setEditingLink(link);
    setLinkForm({ source: link.source, target: link.target, label: link.label || '' });
    setLinkDialogOpen(true);
  };

  const handleSaveLink = () => {
    if (!linkForm.source || !linkForm.target) {
      setError('Source and Target nodes are required');
      return;
    }

    // Verify nodes exist
    if (!nodes.find((n) => n.id === linkForm.source) || !nodes.find((n) => n.id === linkForm.target)) {
      setError('Source and Target nodes must exist');
      return;
    }

    if (editingLink) {
      // Edit existing link
      setLinks(
        links.map((l) =>
          l.source === editingLink.source && l.target === editingLink.target
            ? { ...l, ...linkForm }
            : l
        )
      );
    } else {
      // Add new link
      if (links.find((l) => l.source === linkForm.source && l.target === linkForm.target)) {
        setError('Link already exists');
        return;
      }
      setLinks([...links, linkForm]);
    }

    setLinkDialogOpen(false);
    setError(null);
  };

  const handleDeleteLink = (source: string, target: string) => {
    setLinks(links.filter((l) => !(l.source === source && l.target === target)));
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
          <NodeIcon /> Graph Editor
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
          Graph saved successfully!
        </Alert>
      )}

      {/* Editor Content */}
      <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
        {/* Nodes Section */}
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(15, 23, 42, 0.8)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
              Nodes ({nodes.length})
            </Typography>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddNode}
              sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.main' } }}
            >
              Add Node
            </Button>
          </Box>

          <List dense>
            {nodes.map((node) => (
              <ListItem
                key={node.id}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  mb: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
                }}
              >
                <ListItemText
                  primary={<Typography sx={{ color: '#fff' }}>{node.label}</Typography>}
                  secondary={
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Chip label={`ID: ${node.id}`} size="small" sx={{ fontSize: '0.7rem' }} />
                      {node.group && (
                        <Chip label={`Group: ${node.group}`} size="small" sx={{ fontSize: '0.7rem' }} />
                      )}
                    </Stack>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton size="small" onClick={() => handleEditNode(node)} sx={{ color: 'text.disabled' }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDeleteNode(node.id)} sx={{ color: 'error.main' }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Links Section */}
        <Paper sx={{ p: 2, bgcolor: 'rgba(15, 23, 42, 0.8)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
              Edges ({links.length})
            </Typography>
            <Button
              size="small"
              variant="contained"
              startIcon={<LinkIcon />}
              onClick={handleAddLink}
              sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.main' } }}
              disabled={nodes.length < 2}
            >
              Add Edge
            </Button>
          </Box>

          <List dense>
            {links.map((link, index) => (
              <ListItem
                key={index}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  mb: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
                }}
              >
                <ListItemText
                  primary={
                    <Typography sx={{ color: '#fff' }}>
                      {link.source} → {link.target}
                    </Typography>
                  }
                  secondary={
                    link.label && (
                      <Chip label={link.label} size="small" sx={{ mt: 0.5, fontSize: '0.7rem' }} />
                    )
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton size="small" onClick={() => handleEditLink(link)} sx={{ color: 'text.disabled' }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteLink(link.source, link.target)}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      </Box>

      {/* Save Button */}
      <Button
        fullWidth
        variant="contained"
        startIcon={<SaveIcon />}
        onClick={handleSave}
        disabled={loading}
        sx={{
          bgcolor: 'secondary.main',
          '&:hover': {
            bgcolor: 'secondary.main',
          },
        }}
      >
        {loading ? 'Saving...' : 'Save Graph'}
      </Button>

      {/* Node Dialog */}
      <Dialog open={nodeDialogOpen} onClose={() => setNodeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingNode ? 'Edit Node' : 'Add Node'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Node ID"
              value={nodeForm.id}
              onChange={(e) => setNodeForm({ ...nodeForm, id: e.target.value })}
              disabled={!!editingNode}
              fullWidth
              required
            />
            <TextField
              label="Label"
              value={nodeForm.label}
              onChange={(e) => setNodeForm({ ...nodeForm, label: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Group (Optional)"
              value={nodeForm.group}
              onChange={(e) => setNodeForm({ ...nodeForm, group: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNodeDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveNode} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingLink ? 'Edit Edge' : 'Add Edge'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Source Node</InputLabel>
              <Select
                value={linkForm.source}
                onChange={(e) => setLinkForm({ ...linkForm, source: e.target.value })}
                label="Source Node"
                disabled={!!editingLink}
              >
                {nodes.map((node) => (
                  <MenuItem key={node.id} value={node.id}>
                    {node.label} ({node.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Target Node</InputLabel>
              <Select
                value={linkForm.target}
                onChange={(e) => setLinkForm({ ...linkForm, target: e.target.value })}
                label="Target Node"
                disabled={!!editingLink}
              >
                {nodes.map((node) => (
                  <MenuItem key={node.id} value={node.id}>
                    {node.label} ({node.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Label (Optional)"
              value={linkForm.label}
              onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveLink} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GraphDataEditor;
