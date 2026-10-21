import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  Refresh,
  Close,
} from '@mui/icons-material';
import { API_BASE_URL } from '../config';

interface Node {
  id: string;
  label: string;
  tags: string[];
  num_chunks: number;
  file_size: number;
  upload_date: string;
}

interface Edge {
  source: string;
  target: string;
  type: string;
  created_at: string;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
  tags: string[];
  stats: {
    total_documents: number;
    total_relationships: number;
    total_tags: number;
  };
}

interface DocumentKnowledgeGraphProps {
  onNodeClick?: (node: Node) => void;
}

const DocumentKnowledgeGraph: React.FC<DocumentKnowledgeGraphProps> = ({ onNodeClick }) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadGraphData();
  }, []);

  useEffect(() => {
    if (graphData && canvasRef.current) {
      drawGraph();
    }
  }, [graphData, zoom, pan, selectedTag]);

  const loadGraphData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/rag/knowledge-graph`);
      const data = await response.json();
      if (data.success) {
        setGraphData(data);
      }
    } catch (err) {
      setError('Failed to load knowledge graph');
    } finally {
      setLoading(false);
    }
  };

  const getTagColor = (tag: string): string => {
    const colors = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
    const index = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Filter nodes by selected tag
    const visibleNodes = selectedTag
      ? graphData.nodes.filter(node => node.tags.includes(selectedTag))
      : graphData.nodes;

    if (visibleNodes.length === 0) return;

    // Simple circular layout
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    // Calculate node positions
    const positions = visibleNodes.map((node, i) => {
      const angle = (i / visibleNodes.length) * 2 * Math.PI;
      return {
        id: node.id,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        node,
      };
    });

    // Apply zoom and pan
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    graphData.edges.forEach(edge => {
      const sourcePos = positions.find(p => p.id === edge.source);
      const targetPos = positions.find(p => p.id === edge.target);

      if (sourcePos && targetPos && visibleNodes.some(n => n.id === edge.source) && visibleNodes.some(n => n.id === edge.target)) {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw arrow
        const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
        const arrowSize = 10;
        ctx.beginPath();
        ctx.moveTo(
          targetPos.x - arrowSize * Math.cos(angle - Math.PI / 6),
          targetPos.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.lineTo(
          targetPos.x - arrowSize * Math.cos(angle + Math.PI / 6),
          targetPos.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.fillStyle = '#475569';
        ctx.fill();
      }
    });

    // Draw nodes
    positions.forEach(({ x, y, node }) => {
      const nodeRadius = 30;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);

      // Color by tag
      if (node.tags.length > 0) {
        ctx.fillStyle = getTagColor(node.tags[0]);
      } else {
        ctx.fillStyle = '#64748b';
      }
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#f8fafc';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Truncate long labels
      let label = node.label;
      if (label.length > 15) {
        label = label.substring(0, 12) + '...';
      }
      ctx.fillText(label, x, y + nodeRadius + 15);
    });

    ctx.restore();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!graphData || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const width = canvasRef.current.offsetWidth;
    const height = canvasRef.current.offsetHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    const visibleNodes = selectedTag
      ? graphData.nodes.filter(node => node.tags.includes(selectedTag))
      : graphData.nodes;

    visibleNodes.forEach((node, i) => {
      const angle = (i / visibleNodes.length) * 2 * Math.PI;
      const nodeX = centerX + radius * Math.cos(angle);
      const nodeY = centerY + radius * Math.sin(angle);

      const dist = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
      if (dist < 30) {
        setSelectedNode(node);
        if (onNodeClick) {
          onNodeClick(node);
        }
      }
    });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ color: 'text.disabled' }}>Loading knowledge graph...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: '#1e293b', border: '1px solid #334155' }}>
        <Typography variant="h6" sx={{ color: '#f8fafc', mb: 1 }}>
          No documents in knowledge graph
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          Upload and tag documents to see them in the knowledge graph
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Stats and Tags */}
      <Card elevation={0} sx={{ mb: 3, backgroundColor: '#1e293b', border: '1px solid #334155' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 700 }}>
              Knowledge Graph
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip label={`${graphData.stats.total_documents} Documents`} sx={{ backgroundColor: '#8b5cf6', color: '#ffffff' }} />
              <Chip label={`${graphData.stats.total_relationships} Links`} sx={{ backgroundColor: '#334155', color: '#ffffff' }} />
              <Chip label={`${graphData.stats.total_tags} Tags`} sx={{ backgroundColor: '#334155', color: '#ffffff' }} />
            </Box>
          </Box>

          {/* Tag filters */}
          {graphData.tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label="All Documents"
                onClick={() => setSelectedTag(null)}
                sx={{
                  backgroundColor: selectedTag === null ? '#8b5cf6' : '#334155',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              />
              {graphData.tags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  onClick={() => setSelectedTag(tag)}
                  sx={{
                    backgroundColor: selectedTag === tag ? getTagColor(tag) : '#334155',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Graph Canvas */}
      <Card elevation={0} sx={{ backgroundColor: '#1e293b', border: '1px solid #334155', position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', gap: 1 }}>
          <Tooltip title="Zoom In">
            <IconButton onClick={() => setZoom(prev => Math.min(3, prev * 1.2))} sx={{ backgroundColor: '#334155', color: '#f8fafc', '&:hover': { backgroundColor: '#475569' } }}>
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton onClick={() => setZoom(prev => Math.max(0.5, prev / 1.2))} sx={{ backgroundColor: '#334155', color: '#f8fafc', '&:hover': { backgroundColor: '#475569' } }}>
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset View">
            <IconButton onClick={resetView} sx={{ backgroundColor: '#334155', color: '#f8fafc', '&:hover': { backgroundColor: '#475569' } }}>
              <CenterFocusStrong />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={loadGraphData} sx={{ backgroundColor: '#334155', color: '#f8fafc', '&:hover': { backgroundColor: '#475569' } }}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
          style={{
            width: '100%',
            height: '600px',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        />
      </Card>

      {/* Node Details Dialog */}
      <Dialog open={!!selectedNode} onClose={() => setSelectedNode(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#1e293b', color: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Document Details</Typography>
          <IconButton onClick={() => setSelectedNode(null)} sx={{ color: 'text.disabled' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#0f172a', pt: 3 }}>
          {selectedNode && (
            <Box>
              <Typography variant="body1" sx={{ color: '#f8fafc', fontWeight: 700, mb: 2 }}>
                {selectedNode.label}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {selectedNode.tags.map(tag => (
                  <Chip key={tag} label={tag} size="small" sx={{ backgroundColor: getTagColor(tag), color: '#ffffff' }} />
                ))}
              </Box>
              <Typography variant="body2" sx={{ color: 'text.disabled', mb: 1 }}>
                Chunks: {selectedNode.num_chunks}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.disabled', mb: 1 }}>
                Size: {formatFileSize(selectedNode.file_size)}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                Uploaded: {new Date(selectedNode.upload_date).toLocaleString()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#1e293b' }}>
          <Button onClick={() => setSelectedNode(null)} sx={{ color: 'text.disabled' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentKnowledgeGraph;
