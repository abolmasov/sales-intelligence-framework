import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  IconButton,
  Collapse,
  Alert,
  Stack,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  AccountTree,
  TrendingFlat,
  CheckCircle,
  RadioButtonUnchecked,
  ExpandMore,
  ExpandLess,
  PlayArrow,
  Refresh,
  Insights,
} from '@mui/icons-material';
import { API_BASE_URL } from '../config';

interface ConversationNode {
  id: string;
  question: string;
  category: string;
  reasoning: string;
  expectedAnswerTypes: string[];
  nextNodes: { [key: string]: string };
  keyTopics: string[];
}

interface ConversationFlow {
  id: string;
  name: string;
  description: string;
  targetPersona: string;
  estimatedDuration: string;
  nodes: ConversationNode[];
  keyOutcomes: string[];
  recommendedProducts: string[];
}

interface ConversationFlowDAGProps {
  companyName: string;
  researchSummary: string;
  keyInsights: string[];
  attendeeInfo: Array<{ name: string; email: string; role: string }>;
}

const ConversationFlowDAG: React.FC<ConversationFlowDAGProps> = ({
  companyName,
  researchSummary,
  keyInsights,
  attendeeInfo,
}) => {
  const [flow, setFlow] = useState<ConversationFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [currentNodeId, setCurrentNodeId] = useState<string>('q1');
  const [conversationPath, setConversationPath] = useState<string[]>(['q1']);

  useEffect(() => {
    generateFlow();
  }, [companyName]);

  const generateFlow = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai-questionnaire/generate-conversation-flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          research_summary: researchSummary,
          key_insights: keyInsights,
          attendee_info: attendeeInfo,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate conversation flow');
      }

      const data = await response.json();
      setFlow(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate flow');
    } finally {
      setLoading(false);
    }
  };

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const selectPath = (nextNodeId: string) => {
    setCurrentNodeId(nextNodeId);
    setConversationPath([...conversationPath, nextNodeId]);
  };

  const resetFlow = () => {
    setCurrentNodeId('q1');
    setConversationPath(['q1']);
    setExpandedNodes(new Set());
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      discovery: '#3b82f6',
      qualification: '#8b5cf6',
      'pain-point': '#ef4444',
      'solution-fit': '#10b981',
      'objection-handling': '#f59e0b',
      closing: '#06b6d4',
    };
    return colors[category] || '#6b7280';
  };

  const renderNode = (node: ConversationNode, isActive: boolean, isInPath: boolean) => {
    const isExpanded = expandedNodes.has(node.id);

    return (
      <Card
        key={node.id}
        sx={{
          mb: 2,
          border: isActive ? '3px solid #10b981' : isInPath ? '2px solid #93c5fd' : '1px solid #e5e7eb',
          borderRadius: 3,
          background: isActive
            ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
            : isInPath
            ? 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)'
            : 'white',
          boxShadow: isActive ? '0 4px 20px rgba(16, 185, 129, 0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'all 0.3s ease',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isActive ? (
                <RadioButtonUnchecked sx={{ color: 'success.main', fontSize: 24 }} />
              ) : isInPath ? (
                <CheckCircle sx={{ color: 'secondary.main', fontSize: 24 }} />
              ) : (
                <RadioButtonUnchecked sx={{ color: 'text.disabled', fontSize: 24 }} />
              )}
              <Box>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase' }}>
                  {node.id}
                </Typography>
                <Chip
                  label={node.category}
                  size="small"
                  sx={{
                    ml: 1,
                    backgroundColor: getCategoryColor(node.category),
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                  }}
                />
              </Box>
            </Box>
            <IconButton size="small" onClick={() => toggleNodeExpansion(node.id)}>
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>

          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1f2937' }}>
            {node.question}
          </Typography>

          <Collapse in={isExpanded}>
            <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', fontStyle: 'italic' }}>
                <strong>Why ask this:</strong> {node.reasoning}
              </Typography>

              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                Key Topics:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {node.keyTopics.map((topic, idx) => (
                  <Chip key={idx} label={topic} size="small" variant="outlined" />
                ))}
              </Box>

              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                Expected Answer Types:
              </Typography>
              <ul style={{ margin: '4px 0', paddingLeft: '20px', color: 'text.disabled' }}>
                {node.expectedAnswerTypes.map((type, idx) => (
                  <li key={idx}>
                    <Typography variant="body2">{type}</Typography>
                  </li>
                ))}
              </ul>
            </Box>
          </Collapse>

          {isActive && Object.keys(node.nextNodes).length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary' }}>
                Choose conversation direction:
              </Typography>
              <Stack spacing={1}>
                {Object.entries(node.nextNodes).map(([answerType, nextNodeId]) => (
                  <Button
                    key={answerType}
                    variant="outlined"
                    endIcon={<TrendingFlat />}
                    onClick={() => selectPath(nextNodeId)}
                    sx={{
                      justifyContent: 'space-between',
                      textTransform: 'none',
                      borderRadius: 2,
                      py: 1.5,
                      '&:hover': {
                        backgroundColor: '#f0fdf4',
                        borderColor: '#10b981',
                      },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {answerType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Typography>
                  </Button>
                ))}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 3, color: 'text.disabled' }}>
          Generating conversation flows based on research...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
        <Button onClick={generateFlow} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!flow) {
    return null;
  }

  return (
    <Box>
      <Paper sx={{ p: 4, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <AccountTree sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {flow.name}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {companyName} - {flow.description}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Chip label={flow.targetPersona} sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }} />
          <Chip label={flow.estimatedDuration} sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }} />
        </Box>
      </Paper>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Conversation Progress
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Progress: {conversationPath.length} / {flow.nodes.length} questions
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(conversationPath.length / flow.nodes.length) * 100}
            sx={{ mt: 1, width: 300, height: 8, borderRadius: 4 }}
          />
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={resetFlow}>
          Reset Flow
        </Button>
      </Box>

      {/* Render conversation nodes */}
      <Box>
        {flow.nodes.map((node) => {
          const isActive = node.id === currentNodeId;
          const isInPath = conversationPath.includes(node.id);
          return renderNode(node, isActive, isInPath);
        })}
      </Box>

      {/* Key Outcomes */}
      <Paper sx={{ p: 3, mt: 4, backgroundColor: '#f9fafb' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Insights sx={{ color: '#8b5cf6' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Key Outcomes & Recommendations
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          What You'll Learn:
        </Typography>
        <ul style={{ margin: '8px 0', paddingLeft: '20px', color: 'text.secondary' }}>
          {flow.keyOutcomes.map((outcome, idx) => (
            <li key={idx}>
              <Typography variant="body2">{outcome}</Typography>
            </li>
          ))}
        </ul>

        <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
          Recommended Products:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {flow.recommendedProducts.map((product, idx) => (
            <Chip key={idx} label={product} color="success" />
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default ConversationFlowDAG;
