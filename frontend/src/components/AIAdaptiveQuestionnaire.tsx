import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Stack,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ArrowForward,
  ArrowBack,
  Refresh,
  CheckCircle,
  AccountTree,
  Psychology,
  Send
} from '@mui/icons-material';
import * as d3 from 'd3';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

interface ConversationMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
}

interface QuestionAnalysis {
  question: string;
  category: string;
  reasoning: string;
  suggestedAnswers?: string[];
  followUpTopics: string[];
  identifiedNeeds: string[];
  productRecommendations: string[];
  nextQuestionHint: string;
}

interface ConversationNode {
  id: string;
  question: string;
  answer?: string;
  category: string;
  insights: string[];
  x?: number;
  y?: number;
}

interface ConversationLink {
  source: string;
  target: string;
}

const AIAdaptiveQuestionnaire: React.FC = () => {
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionAnalysis | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationNodes, setConversationNodes] = useState<ConversationNode[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [showDAG, setShowDAG] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<{
    identifiedNeeds: string[];
    productRecommendations: string[];
    nextSteps: string[];
  }>({
    identifiedNeeds: [],
    productRecommendations: [],
    nextSteps: []
  });

  const dagRef = useRef<SVGSVGElement>(null);
  const questionCount = useRef(0);

  useEffect(() => {
    startConversation();
  }, []);

  useEffect(() => {
    if (showDAG && conversationNodes.length > 0) {
      renderDAG();
    }
  }, [showDAG, conversationNodes]);

  const startConversation = async () => {
    setLoading(true);
    setError(null);

    const systemPrompt: ConversationMessage = {
      role: 'system',
      content: `You are an expert sales discovery AI assistant for enterprise software solutions (Atlassian and ServiceNow products). Your role is to conduct a sophisticated discovery interview to:

1. Understand the prospect's current challenges and pain points
2. Identify their existing tools and satisfaction levels
3. Uncover specific needs that align with Atlassian or ServiceNow solutions
4. Qualify the opportunity and identify decision criteria
5. Build towards specific product recommendations

Guidelines:
- Ask ONE focused, open-ended question at a time
- Build on previous answers to go deeper
- Use insights from answers to guide the next question
- Identify patterns and opportunities
- Be consultative, not pushy
- Focus on business value and outcomes
- Adapt your questions based on the prospect's responses

For each question you generate, provide:
1. The question itself
2. Category (discovery, qualification, pain-point, solution-fit, objection-handling, closing)
3. Your reasoning for asking this question
4. Identified needs or opportunities from previous answers
5. Potential product recommendations to explore
6. Topics to follow up on

Current product knowledge:
- Atlassian: Jira (Software, Service Management, Work Management, Align), Confluence, Bitbucket, Rovo (AI search & agents), Trello, Loom, Atlas
- ServiceNow: ITSM, ITOM, CSM, Security Operations, HR Service Delivery, GRC, Now Platform

Start with a high-level discovery question about their biggest business challenge.`
    };

    const initialHistory = [systemPrompt];
    setConversationHistory(initialHistory);

    try {
      const firstQuestion = await generateNextQuestion(initialHistory);
      setCurrentQuestion(firstQuestion);
    } catch (err: any) {
      setError(err.message || 'Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };

  const generateNextQuestion = async (
    history: ConversationMessage[]
  ): Promise<QuestionAnalysis> => {
    const response = await axios.post(`${API_URL}/api/ai-questionnaire/next-question`, {
      conversation_history: history
    });

    return response.data;
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !currentQuestion) return;

    setLoading(true);
    setError(null);
    questionCount.current += 1;

    // Add answer to conversation
    const userMessage: ConversationMessage = {
      role: 'user',
      content: userAnswer
    };

    // Create node for this Q&A
    const newNode: ConversationNode = {
      id: `q${questionCount.current}`,
      question: currentQuestion.question,
      answer: userAnswer,
      category: currentQuestion.category,
      insights: [
        ...currentQuestion.identifiedNeeds,
        ...currentQuestion.productRecommendations
      ]
    };

    setConversationNodes([...conversationNodes, newNode]);

    // Update insights
    setInsights(prev => ({
      identifiedNeeds: [
        ...new Set([...prev.identifiedNeeds, ...currentQuestion.identifiedNeeds])
      ],
      productRecommendations: [
        ...new Set([...prev.productRecommendations, ...currentQuestion.productRecommendations])
      ],
      nextSteps: currentQuestion.followUpTopics
    }));

    const updatedHistory = [...conversationHistory, userMessage];
    setConversationHistory(updatedHistory);
    setUserAnswer('');

    try {
      // Check if we should continue or wrap up
      const shouldContinue = await shouldContinueConversation(updatedHistory);

      if (!shouldContinue || questionCount.current >= 10) {
        // Generate final summary
        await generateFinalSummary(updatedHistory);
        setIsComplete(true);
      } else {
        // Generate next question
        const nextQuestion = await generateNextQuestion(updatedHistory);
        setCurrentQuestion(nextQuestion);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process answer');
    } finally {
      setLoading(false);
    }
  };

  const shouldContinueConversation = async (
    history: ConversationMessage[]
  ): Promise<boolean> => {
    const response = await axios.post(`${API_URL}/api/ai-questionnaire/should-continue`, {
      conversation_history: history
    });

    return response.data.should_continue;
  };

  const generateFinalSummary = async (history: ConversationMessage[]) => {
    const response = await axios.post(`${API_URL}/api/ai-questionnaire/summary`, {
      conversation_history: history
    });

    setInsights(prev => ({
      ...prev,
      ...response.data
    }));
  };

  const handleBack = () => {
    if (conversationNodes.length === 0) return;

    // Remove last Q&A
    const newNodes = [...conversationNodes];
    newNodes.pop();
    setConversationNodes(newNodes);

    // Remove last 2 messages (user answer and assistant question)
    const newHistory = [...conversationHistory];
    newHistory.pop(); // Remove user answer
    setConversationHistory(newHistory);

    questionCount.current -= 1;
    setIsComplete(false);
  };

  const handleReset = () => {
    setConversationHistory([]);
    setConversationNodes([]);
    setCurrentQuestion(null);
    setUserAnswer('');
    setIsComplete(false);
    setInsights({
      identifiedNeeds: [],
      productRecommendations: [],
      nextSteps: []
    });
    questionCount.current = 0;
    startConversation();
  };

  const renderDAG = () => {
    if (!dagRef.current) return;

    const width = 1400;
    const height = 800;

    d3.select(dagRef.current).selectAll("*").remove();

    const svg = d3.select(dagRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    // Build hierarchical tree structure
    interface TreeNode {
      id: string;
      question: string;
      answer?: string;
      category: string;
      insights: string[];
      children?: TreeNode[];
      isActualPath: boolean;
      isPotential: boolean;
    }

    // Create root
    const root: TreeNode = {
      id: 'root',
      question: 'Start Discovery',
      category: 'discovery',
      insights: [],
      isActualPath: true,
      isPotential: false,
      children: []
    };

    // Add actual conversation path
    let currentParent: TreeNode = root;
    conversationNodes.forEach((node, idx) => {
      const treeNode: TreeNode = {
        ...node,
        isActualPath: true,
        isPotential: false,
        children: []
      };
      currentParent.children = [treeNode];
      currentParent = treeNode;
    });

    // Add potential next questions as branches from current node
    if (currentQuestion && !isComplete) {
      const potentialNodes: TreeNode[] = currentQuestion.followUpTopics.map((topic, idx) => ({
        id: `potential-${idx}`,
        question: `Follow-up on: ${topic}`,
        category: currentQuestion.category,
        insights: [],
        isActualPath: false,
        isPotential: true
      }));
      currentParent.children = potentialNodes;
    }

    // Create D3 hierarchy
    const hierarchy = d3.hierarchy(root);
    const treeLayout = d3.tree<TreeNode>()
      .size([width - 200, height - 200])
      .separation((a, b) => (a.parent === b.parent ? 1.5 : 2));

    const treeData = treeLayout(hierarchy);

    // Get nodes and links
    const nodes = treeData.descendants();
    const links = treeData.links();

    // Translate to center
    const xOffset = 100;
    const yOffset = 100;

    // Draw links
    const linkGenerator = d3.linkVertical<any, any>()
      .x(d => d.x + xOffset)
      .y(d => d.y + yOffset);

    const link = g.append('g')
      .selectAll('.dag-link')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'dag-link')
      .attr('d', linkGenerator as any)
      .attr('fill', 'none')
      .attr('stroke', (d: any) => {
        return d.target.data.isActualPath ? '#10b981' : '#475569';
      })
      .attr('stroke-width', (d: any) => {
        return d.target.data.isActualPath ? 3 : 1.5;
      })
      .attr('stroke-opacity', (d: any) => {
        return d.target.data.isActualPath ? 0.8 : 0.3;
      })
      .attr('marker-end', (d: any) => {
        return d.target.data.isActualPath ? 'url(#arrowhead-active)' : 'url(#arrowhead-potential)';
      });

    // Arrow markers
    const defs = svg.append('defs');

    defs.append('marker')
      .attr('id', 'arrowhead-active')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 35)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#10b981');

    defs.append('marker')
      .attr('id', 'arrowhead-potential')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 35)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#475569');

    // Draw nodes
    const node = g.append('g')
      .selectAll('.dag-node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'dag-node')
      .attr('transform', (d: any) => `translate(${d.x + xOffset},${d.y + yOffset})`);

    // Node circles
    node.append('circle')
      .attr('r', (d: any) => d.data.isActualPath ? 35 : 25)
      .attr('fill', (d: any) => {
        if (d.data.id === 'root') return '#1e293b';
        if (d.data.isPotential) return '#334155';

        const colors: Record<string, string> = {
          discovery: '#3b82f6',
          qualification: '#8b5cf6',
          'pain-point': '#ef4444',
          'solution-fit': '#10b981',
          'objection-handling': '#f59e0b',
          closing: '#ec4899'
        };
        return colors[d.data.category] || '#475569';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', (d: any) => d.data.isActualPath ? 3 : 1.5)
      .attr('opacity', (d: any) => d.data.isPotential ? 0.5 : 1);

    // Node labels (question number)
    node.append('text')
      .text((d: any, i) => {
        if (d.data.id === 'root') return 'START';
        if (d.data.isPotential) return '?';
        return i.toString();
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', '#fff')
      .attr('font-weight', 600)
      .attr('font-size', (d: any) => d.data.isActualPath ? 14 : 11);

    // Category badges
    node.append('text')
      .text((d: any) => d.data.category.replace('-', ' ').toUpperCase())
      .attr('text-anchor', 'middle')
      .attr('dy', 55)
      .attr('fill', '#cbd5e1')
      .attr('font-size', 9)
      .attr('font-weight', 600);

    // Question text (wrapped)
    node.each(function(d: any) {
      const nodeGroup = d3.select(this);
      const questionText = d.data.question;
      const maxWidth = 200;
      const words = questionText.split(' ');
      let line = '';
      let lineNumber = 0;
      const lineHeight = 14;
      const y = -50;

      words.forEach((word: string) => {
        const testLine = line + word + ' ';
        if (testLine.length > 30 && line !== '') {
          nodeGroup.append('text')
            .attr('x', 0)
            .attr('y', y + lineNumber * lineHeight)
            .attr('text-anchor', 'middle')
            .attr('fill', d.data.isActualPath ? '#f8fafc' : '#94a3b8')
            .attr('font-size', 11)
            .attr('font-weight', d.data.isActualPath ? 500 : 400)
            .text(line.trim());
          line = word + ' ';
          lineNumber++;
          if (lineNumber >= 2) return; // Max 2 lines
        } else {
          line = testLine;
        }
      });

      if (line && lineNumber < 2) {
        nodeGroup.append('text')
          .attr('x', 0)
          .attr('y', y + lineNumber * lineHeight)
          .attr('text-anchor', 'middle')
          .attr('fill', d.data.isActualPath ? '#f8fafc' : '#94a3b8')
          .attr('font-size', 11)
          .attr('font-weight', d.data.isActualPath ? 500 : 400)
          .text(line.trim());
      }
    });

    // Answer preview for actual path
    node.filter((d: any) => d.data.answer && d.data.isActualPath)
      .append('text')
      .text((d: any) => '✓ Answered')
      .attr('text-anchor', 'middle')
      .attr('dy', 70)
      .attr('fill', '#10b981')
      .attr('font-size', 10)
      .attr('font-weight', 600);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);
  };

  if (isComplete) {
    return (
      <Box>
        <Paper sx={{ p: 4, bgcolor: 'rgba(30, 35, 50, 0.95)', mb: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h4" sx={{ color: '#fff', mb: 2 }}>
              Discovery Complete!
            </Typography>
            <Typography variant="body1" sx={{ color: '#cbd5e1', mb: 3 }}>
              AI-powered analysis of {conversationNodes.length} questions completed.
            </Typography>
          </Box>

          <Divider sx={{ my: 3, borderColor: '#334155' }} />

          {/* Identified Needs */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
              Identified Needs & Pain Points
            </Typography>
            <Stack spacing={1}>
              {insights.identifiedNeeds.map((need, idx) => (
                <Chip
                  key={idx}
                  label={need}
                  sx={{ bgcolor: 'error.main', color: '#fff', justifyContent: 'flex-start' }}
                />
              ))}
            </Stack>
          </Box>

          {/* Product Recommendations */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
              Recommended Solutions
            </Typography>
            <Stack spacing={1}>
              {insights.productRecommendations.map((rec, idx) => (
                <Chip
                  key={idx}
                  label={rec}
                  sx={{ bgcolor: 'success.main', color: '#fff', justifyContent: 'flex-start' }}
                />
              ))}
            </Stack>
          </Box>

          {/* Next Steps */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
              Recommended Next Steps
            </Typography>
            <Stack spacing={1}>
              {insights.nextSteps.map((step, idx) => (
                <Chip
                  key={idx}
                  label={step}
                  sx={{ bgcolor: 'secondary.main', color: '#fff', justifyContent: 'flex-start' }}
                />
              ))}
            </Stack>
          </Box>

          <Divider sx={{ my: 3, borderColor: '#334155' }} />

          {/* Conversation History */}
          <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
            Conversation History
          </Typography>
          <Stack spacing={2} sx={{ mb: 3 }}>
            {conversationNodes.map((node, idx) => (
              <Card key={idx} sx={{ bgcolor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      label={`Q${idx + 1}`}
                      size="small"
                      sx={{ bgcolor: 'secondary.main', color: '#fff' }}
                    />
                    <Chip
                      label={node.category}
                      size="small"
                      sx={{ bgcolor: 'text.secondary', color: '#fff' }}
                    />
                  </Box>
                  <Typography variant="subtitle2" sx={{ color: 'text.disabled', mb: 1 }}>
                    {node.question}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500 }}>
                    {node.answer}
                  </Typography>
                  {node.insights.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {node.insights.map((insight, i) => (
                        <Chip
                          key={i}
                          label={insight}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: '#334155', color: 'text.secondary', fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="contained"
              onClick={handleReset}
              startIcon={<Refresh />}
              sx={{ bgcolor: 'secondary.main' }}
            >
              Start New Interview
            </Button>
            <Button
              variant="outlined"
              onClick={() => setShowDAG(!showDAG)}
              startIcon={<AccountTree />}
              sx={{ borderColor: '#334155', color: '#cbd5e1' }}
            >
              {showDAG ? 'Hide' : 'Show'} Conversation Flow
            </Button>
          </Stack>

          {showDAG && (
            <Paper sx={{ mt: 3, p: 2, bgcolor: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                AI Conversation Flow
              </Typography>
              <Box sx={{ overflow: 'auto' }}>
                <svg ref={dagRef} />
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip label="Discovery" size="small" sx={{ bgcolor: 'secondary.main', color: '#fff' }} />
                <Chip label="Qualification" size="small" sx={{ bgcolor: '#8b5cf6', color: '#fff' }} />
                <Chip label="Pain Point" size="small" sx={{ bgcolor: 'error.main', color: '#fff' }} />
                <Chip label="Solution Fit" size="small" sx={{ bgcolor: 'success.main', color: '#fff' }} />
                <Chip label="Objection Handling" size="small" sx={{ bgcolor: 'warning.main', color: '#fff' }} />
                <Chip label="Closing" size="small" sx={{ bgcolor: '#ec4899', color: '#fff' }} />
              </Box>
            </Paper>
          )}
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      {/* Progress */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
            Question {questionCount.current + 1}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              icon={<Psychology />}
              label="AI-Powered"
              size="small"
              sx={{ bgcolor: '#8b5cf6', color: '#fff' }}
            />
            {currentQuestion && (
              <Chip
                label={currentQuestion.category.replace('-', ' ')}
                size="small"
                sx={{ bgcolor: 'secondary.main', color: '#fff' }}
              />
            )}
          </Box>
        </Box>
        <LinearProgress
          variant="determinate"
          value={(questionCount.current / 10) * 100}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'text.primary',
            '& .MuiLinearProgress-bar': { bgcolor: 'success.main' }
          }}
        />
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Current Question */}
      {currentQuestion && !loading && (
        <Paper sx={{ p: 4, bgcolor: 'rgba(30, 35, 50, 0.95)', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
            <Psychology sx={{ fontSize: 40, color: '#8b5cf6' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ color: '#fff', mb: 2 }}>
                {currentQuestion.question}
              </Typography>
              {currentQuestion.reasoning && (
                <Paper sx={{ p: 2, bgcolor: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6' }}>
                  <Typography variant="caption" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>
                    AI Reasoning: {currentQuestion.reasoning}
                  </Typography>
                </Paper>
              )}
            </Box>
          </Box>

          {/* Answer Input */}
          <TextField
            fullWidth
            multiline
            rows={4}
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Share your thoughts in detail..."
            variant="outlined"
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(15, 23, 42, 0.6)',
                color: '#fff',
                '& fieldset': { borderColor: '#334155' },
                '&:hover fieldset': { borderColor: '#475569' },
                '&.Mui-focused fieldset': { borderColor: '#2563eb' }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleSubmitAnswer();
              }
            }}
          />

          {/* Suggested Answers */}
          {currentQuestion.suggestedAnswers && currentQuestion.suggestedAnswers.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 1 }}>
                Quick responses (optional):
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {currentQuestion.suggestedAnswers.map((suggestion, idx) => (
                  <Chip
                    key={idx}
                    label={suggestion}
                    onClick={() => setUserAnswer(suggestion)}
                    sx={{
                      bgcolor: 'rgba(37, 99, 235, 0.1)',
                      color: 'secondary.main',
                      border: '1px solid #2563eb',
                      '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.2)' }
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={handleBack}
              disabled={conversationNodes.length === 0}
              startIcon={<ArrowBack />}
              sx={{ borderColor: '#334155', color: '#cbd5e1' }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmitAnswer}
              disabled={!userAnswer.trim()}
              endIcon={<Send />}
              sx={{ bgcolor: 'success.main', flex: 1 }}
            >
              Submit Answer (Ctrl+Enter)
            </Button>
            <Tooltip title="View conversation flow">
              <IconButton
                onClick={() => setShowDAG(!showDAG)}
                sx={{ color: '#cbd5e1', border: '1px solid #334155' }}
              >
                <AccountTree />
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>
      )}

      {/* Loading State */}
      {loading && (
        <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
          <CircularProgress sx={{ color: '#8b5cf6', mb: 2 }} />
          <Typography sx={{ color: '#cbd5e1' }}>
            AI is analyzing and generating next question...
          </Typography>
        </Paper>
      )}

      {/* DAG Visualization */}
      {showDAG && conversationNodes.length > 0 && (
        <Paper sx={{ p: 3, bgcolor: 'rgba(30, 35, 50, 0.95)', mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
            Conversation Flow
          </Typography>
          <Box sx={{ overflow: 'auto', bgcolor: 'rgba(15, 23, 42, 0.6)', borderRadius: 2, p: 2 }}>
            <svg ref={dagRef} />
          </Box>
        </Paper>
      )}

      {/* Current Insights */}
      {(insights.identifiedNeeds.length > 0 || insights.productRecommendations.length > 0) && (
        <Paper sx={{ p: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
            Insights So Far
          </Typography>
          <Stack spacing={2}>
            {insights.identifiedNeeds.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ color: 'text.disabled', mb: 1 }}>
                  Identified Needs:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {insights.identifiedNeeds.map((need, idx) => (
                    <Chip
                      key={idx}
                      label={need}
                      size="small"
                      sx={{ bgcolor: 'error.main', color: '#fff' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
            {insights.productRecommendations.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ color: 'text.disabled', mb: 1 }}>
                  Potential Solutions:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {insights.productRecommendations.map((rec, idx) => (
                    <Chip
                      key={idx}
                      label={rec}
                      size="small"
                      sx={{ bgcolor: 'success.main', color: '#fff' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default AIAdaptiveQuestionnaire;
