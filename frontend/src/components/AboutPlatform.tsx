import React from 'react';
import {
  Box,
  Typography,
  Card,
  Container,
  Stack,
  Divider,
  Grid,
} from '@mui/material';
import {
  Psychology,
  Hub,
  Description,
  CalendarMonth,
  Article,
  Analytics,
  Storage,
  Code,
  Security,
  Speed,
  Cloud,
  Search,
} from '@mui/icons-material';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface TechSpec {
  category: string;
  items: string[];
}

const AboutPlatform: React.FC = () => {
  const coreFeatures: Feature[] = [
    {
      icon: <Psychology sx={{ fontSize: 32 }} />,
      title: 'AI-Powered Research',
      description: 'Automated company intelligence gathering using GPT-4o with multi-agent orchestration through LangGraph. Delivers comprehensive market analysis, financial insights, and competitive intelligence.',
    },
    {
      icon: <Hub sx={{ fontSize: 32 }} />,
      title: 'Knowledge Graph',
      description: 'NetworkX-powered visual exploration of relationships between documents, companies, and case studies. Enables discovery of hidden connections and relevant content.',
    },
    {
      icon: <Description sx={{ fontSize: 32 }} />,
      title: 'RAG Q&A System',
      description: 'Retrieval-Augmented Generation with FAISS vector search. Query uploaded documents and research with context-aware responses powered by semantic search.',
    },
    {
      icon: <CalendarMonth sx={{ fontSize: 32 }} />,
      title: 'Calendar Integration',
      description: 'Microsoft 365 OAuth integration for calendar synchronization, meeting preparation workflows, and automated scheduling intelligence.',
    },
    {
      icon: <Article sx={{ fontSize: 32 }} />,
      title: 'Document Generation',
      description: 'AI-assisted RFP and SOW generation using template-based systems combined with knowledge base context and deal-specific intelligence.',
    },
    {
      icon: <Analytics sx={{ fontSize: 32 }} />,
      title: 'Sales Intelligence',
      description: 'Deep financial analysis, stakeholder mapping, strategic initiatives tracking, and competitive landscape assessment with automated insight extraction.',
    },
  ];

  const techStack: TechSpec[] = [
    {
      category: 'Backend',
      items: [
        'Express.js (TypeScript)',
        'LangGraph for AI orchestration',
        'OpenAI GPT-4o API',
        'SQLite with SQLAlchemy ORM',
        'FAISS vector database',
        'Microsoft Graph API',
      ],
    },
    {
      category: 'Frontend',
      items: [
        'React 19 with TypeScript',
        'Material-UI v7',
        'React Router v6',
        'Axios for HTTP',
        'D3.js for visualizations',
      ],
    },
    {
      category: 'AI & ML',
      items: [
        'LangGraph multi-agent systems',
        'RAG with semantic search',
        'Tavily web research API',
        'Vector embeddings (text-embedding-3)',
        'Prompt engineering framework',
      ],
    },
    {
      category: 'Infrastructure',
      items: [
        'Azure AD authentication',
        'Microsoft MSAL',
        'Local file storage',
        'Environment-based config',
        'RESTful API architecture',
      ],
    },
  ];

  const platformMetrics = [
    { label: 'Research Agents', value: '4+', description: 'Specialized AI agents for different research tasks' },
    { label: 'Case Studies', value: '112+', description: 'Northstar Integrators and Northstar library customer success stories' },
    { label: 'AI Model', value: 'GPT-4o', description: 'Latest OpenAI language model' },
    { label: 'Avg Response', value: '<2 min', description: 'Complete research analysis time' },
    { label: 'Vector Search', value: 'FAISS', description: 'Facebook AI Similarity Search' },
    { label: 'Graph Nodes', value: '1000+', description: 'Interconnected knowledge entities' },
  ];

  const dataFlow = [
    { step: '1', title: 'User Input', desc: 'Company name, meeting purpose, and context' },
    { step: '2', title: 'AI Orchestration', desc: 'LangGraph routes to specialized agents' },
    { step: '3', title: 'Parallel Research', desc: 'Financial, web, news, and case study agents' },
    { step: '4', title: 'Vector Search', desc: 'FAISS retrieves relevant documents' },
    { step: '5', title: 'Synthesis', desc: 'GPT-4o combines findings into insights' },
    { step: '6', title: 'Delivery', desc: 'Structured report with recommendations' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0f1a', py: 6 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 6, pb: 4, borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: '#f8fafc',
              mb: 2,
              letterSpacing: '-0.02em',
            }}
          >
            Sales Intelligence Platform
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'text.disabled',
              fontWeight: 400,
              mb: 3,
            }}
          >
            Enterprise AI-Powered Pre-Call Research and Deal Intelligence System
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: '#cbd5e1',
              lineHeight: 1.8,
              maxWidth: '900px',
            }}
          >
            A comprehensive platform that automates sales research, meeting preparation, and deal intelligence workflows.
            Built on LangGraph multi-agent architecture with OpenAI GPT-4o, FAISS vector search, and Microsoft 365 integration.
            Designed for enterprise sales teams requiring deep company intelligence, automated document generation, and
            knowledge graph-based relationship mapping.
          </Typography>
        </Box>

        {/* Platform Metrics */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 600, mb: 3 }}>
            Platform Metrics
          </Typography>
          <Grid container spacing={2}>
            {platformMetrics.map((metric) => (
              <Grid key={metric.label} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  sx={{
                    p: 2.5,
                    bgcolor: 'rgba(26, 31, 38, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: 1.5,
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                    {metric.label}
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.5 }}>
                    {metric.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    {metric.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Core Features */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 600, mb: 3 }}>
            Core Features
          </Typography>
          <Grid container spacing={3}>
            {coreFeatures.map((feature) => (
              <Grid key={feature.title} size={{ xs: 12, md: 6 }}>
                <Card
                  sx={{
                    p: 3,
                    bgcolor: 'rgba(26, 31, 38, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: 1.5,
                    height: '100%',
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: '#60A5FA',
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          color: '#f8fafc',
                          fontWeight: 600,
                          mb: 1,
                          fontSize: '1rem',
                        }}
                      >
                        {feature.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.disabled',
                          lineHeight: 1.7,
                          fontSize: '0.875rem',
                        }}
                      >
                        {feature.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Technical Stack */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 600, mb: 3 }}>
            Technical Stack
          </Typography>
          <Grid container spacing={3}>
            {techStack.map((spec) => (
              <Grid key={spec.category} size={{ xs: 12, sm: 6 }}>
                <Card
                  sx={{
                    p: 3,
                    bgcolor: 'rgba(26, 31, 38, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: 1.5,
                    height: '100%',
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{
                      color: '#f8fafc',
                      fontWeight: 600,
                      mb: 2,
                      pb: 1.5,
                      borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
                    }}
                  >
                    {spec.category}
                  </Typography>
                  <Stack spacing={1}>
                    {spec.items.map((item) => (
                      <Box key={item} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: '#60A5FA',
                            mr: 1.5,
                          }}
                        />
                        <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: '0.875rem' }}>
                          {item}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Data Processing Flow */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 600, mb: 3 }}>
            Data Processing Flow
          </Typography>
          <Card
            sx={{
              p: 4,
              bgcolor: 'rgba(26, 31, 38, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              borderRadius: 1.5,
            }}
          >
            <Grid container spacing={2}>
              {dataFlow.map((flow, index) => (
                <React.Fragment key={flow.step}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          bgcolor: 'rgba(59, 130, 246, 0.2)',
                          border: '1px solid rgba(59, 130, 246, 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2,
                          flexShrink: 0,
                        }}
                      >
                        <Typography sx={{ color: '#60A5FA', fontWeight: 700, fontSize: '0.875rem' }}>
                          {flow.step}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: '#f8fafc', fontWeight: 600, mb: 0.5 }}>
                          {flow.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>
                          {flow.desc}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  {index < dataFlow.length - 1 && index % 3 === 2 && (
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 1, borderColor: 'rgba(71, 85, 105, 0.2)' }} />
                    </Grid>
                  )}
                </React.Fragment>
              ))}
            </Grid>
          </Card>
        </Box>

        {/* System Architecture */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 600, mb: 3 }}>
            System Architecture
          </Typography>
          <Card
            sx={{
              p: 4,
              bgcolor: 'rgba(26, 31, 38, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              borderRadius: 1.5,
            }}
          >
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 1.5,
                      bgcolor: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <Code sx={{ fontSize: 28, color: '#60A5FA' }} />
                  </Box>
                  <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 600, mb: 1, fontSize: '0.95rem' }}>
                    Frontend Layer
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    React 19 with TypeScript, Material-UI v7, and D3.js for visualizations.
                    Responsive design with mobile-first approach.
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 1.5,
                      bgcolor: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <Cloud sx={{ fontSize: 28, color: '#60A5FA' }} />
                  </Box>
                  <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 600, mb: 1, fontSize: '0.95rem' }}>
                    API Layer
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    Express.js with TypeScript, RESTful endpoints, Azure AD authentication,
                    and Microsoft Graph integration.
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 1.5,
                      bgcolor: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <Storage sx={{ fontSize: 28, color: '#60A5FA' }} />
                  </Box>
                  <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 600, mb: 1, fontSize: '0.95rem' }}>
                    Data Layer
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    SQLite database, FAISS vector store, NetworkX graph database,
                    and local file storage for documents.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Card>
        </Box>

        {/* Key Capabilities */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 600, mb: 3 }}>
            Key Capabilities
          </Typography>
          <Grid container spacing={2}>
            {[
              { icon: <Search />, title: 'Web Intelligence', desc: 'Tavily API for real-time web research and news monitoring' },
              { icon: <Psychology />, title: 'Multi-Agent AI', desc: 'LangGraph orchestration with specialized research agents' },
              { icon: <Security />, title: 'Enterprise Auth', desc: 'Azure AD and Microsoft 365 OAuth integration' },
              { icon: <Speed />, title: 'Vector Search', desc: 'FAISS-powered semantic search across documents' },
            ].map((capability) => (
              <Grid key={capability.title} size={{ xs: 12, sm: 6 }}>
                <Card
                  sx={{
                    p: 2.5,
                    bgcolor: 'rgba(26, 31, 38, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: 1.5,
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        bgcolor: 'rgba(59, 130, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#60A5FA',
                      }}
                    >
                      {capability.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: '#f8fafc', fontWeight: 600, mb: 0.25 }}>
                        {capability.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
                        {capability.desc}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Footer Info */}
        <Box
          sx={{
            p: 3,
            borderRadius: 1.5,
            bgcolor: 'rgba(26, 31, 38, 0.6)',
            border: '1px solid rgba(71, 85, 105, 0.2)',
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.disabled', mb: 1.5, lineHeight: 1.7 }}>
            This platform is designed for enterprise sales teams requiring comprehensive company intelligence,
            automated research workflows, and AI-powered document generation. Built with modern TypeScript,
            React, and cutting-edge AI technologies to streamline sales preparation and deal management.
          </Typography>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Version: 2.0.0
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Last Updated: January 2025
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              License: MIT
            </Typography>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default AboutPlatform;
