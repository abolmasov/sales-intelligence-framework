import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  Paper,
  Chip,
  LinearProgress,
  IconButton,
  Fade,
  Avatar,
  Stack,
  Tabs,
  Tab,
  Divider,
  Typography,
  CircularProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Search,
  CheckCircle,
  Assessment,
  Refresh,
  Launch,
  Analytics,
  Code,
  CloudUpload,
  Quiz,
  PersonAdd,
  Delete,
  Download,
  Description,
  InsertDriveFile,
  Psychology,
  History as HistoryIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../config';
import FinancialCharts from '../components/FinancialCharts';
import PastAnalyses from '../components/PastAnalyses';
import AIQuestionnaire from '../components/AIQuestionnaire';
import ReactMarkdown from 'react-markdown';
import {
  DealHealthScoreCard,
  ActionItemsPanel,
  InsightCard,
  CompanyIntelligenceGrid,
  StakeholderMap,
  InternalKbInsightsPanel,
} from '../components/insights';
import { deriveCompanyFromAttendeeEmails, isInternalAttendee } from '../utils/meetingActions';
import { apiPost } from '../utils/api';
import { Group } from '@mui/icons-material';
import { useAppShell } from '../context/AppShellContext';
import { useSyncEmitters } from '../hooks/useStoreSync';
import { alpha } from '@mui/material/styles';
import { COLORS } from '../styles/pageStyles';
import FeedbackWidget from '../components/FeedbackWidget';

interface ProgressState {
  company_research: 'pending' | 'running' | 'completed';
  questionnaire: 'pending' | 'running' | 'completed';
  sales_analysis: 'pending' | 'running' | 'completed';
  report_generation: 'pending' | 'running' | 'completed';
}

interface InternalKnowledgeProgressState {
  status: 'idle' | 'signing_in' | 'creating_session' | 'streaming' | 'complete' | 'error';
  sessionId?: string;
  elapsedSeconds: number;
  messagesCollected: number;
  referencesCollected: number;
  eventsReceived: number;
  firstMessageAt?: number;
  lastUpdate: string;
}

interface SalesData {
  companyName: string;
  purposeOfMeeting?: string;
  meetingContext?: string;
  executiveSummary: string;
  financialPerformance: string;
  financialMetrics?: any;
  salesOpportunities: string;
  actionPlan?: string;
  meetingQuestionnaire?: string;
  integratorCaseStudies: any[];
  libraryCaseStudies: any[];
  sharepointDocuments?: any[];
  internalKbAiInsights?: string; // InternalKnowledge AI generated analysis/insights
  internalKbRaw?: any; // Full InternalKnowledge payload (JSON)
  internalKbSimilarEngagements?: any[];
  confidenceScore: number;
  recent_headlines?: any[];
  news_summary?: string;
  news_sentiment?: string;
  key_topics?: string[];
  keyInsights?: string[];
  enterpriseRecommendations?: string[];
  recommendedProducts?: string[];
  aiQuestionnaire?: any; // Pre-generated AI questionnaire from research
  externalAttendeeResearch?: Array<{ name?: string; company?: string; research?: string; summary?: string; role?: string }> | string;
  // Enhanced Sales Intelligence (NEW)
  dealHealthSignals?: {
    overallScore: number;
    budgetMentioned: boolean;
    timelineUrgency: 'high' | 'medium' | 'low' | 'unknown';
    decisionMakerPresent: boolean;
    painPointsIdentified: string[];
    competitorMentions: string[];
    riskFactors: string[];
    opportunitySignals: string[];
  };
  suggestedActions?: Array<{
    id: string;
    priority: 'high' | 'medium' | 'low';
    action: string;
    rationale: string;
    dueWithin: string;
    category?: 'follow-up' | 'meeting' | 'research' | 'internal' | 'other';
  }>;
  companyIntelligence?: {
    employeeCount?: string;
    revenue?: string;
    industry: string;
    sector?: string;
    techStack?: string[];
    recentNewsSentiment: 'positive' | 'neutral' | 'negative';
    keyHighlights: string[];
    fundingInfo?: string;
    headquarters?: string;
  };
  stakeholderInsights?: Array<{
    name: string;
    role: string;
    company?: string;
    email?: string;
    influenceLevel: 'high' | 'medium' | 'low';
    talkingPoints: string[];
    linkedInSummary?: string;
    department?: string;
    isDecisionMaker?: boolean;
  }>;
}

const AnalysisPage: React.FC = () => {
  const theme = useTheme();
  const navigateRouter = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { emitPreCallStarted, emitPreCallCompleted } = useSyncEmitters();
  const normalizeCompanyDisplay = (...values: Array<string | undefined | null>): string => {
    for (const value of values) {
      if (!value) continue;
      const trimmed = value.toString().trim();
      if (!trimmed) continue;
      if (trimmed.toLowerCase() === 'unknown') continue;
      return trimmed;
    }
    return 'Pre-call analysis';
  };
  const [appState, setAppState] = useState<'search' | 'researching' | 'completed'>('search');
  const [companyName, setCompanyName] = useState('');
  const [purposeOfMeeting, setPurposeOfMeeting] = useState('');
  const [meetingContext, setMeetingContext] = useState('');
  const [linkedMeetingId, setLinkedMeetingId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Array<{ name: string; email: string; role: string }>>([]);
  const [shouldAutoStart, setShouldAutoStart] = useState(false);
  const autoStartCompanyRef = useRef<string | null>(null);
  const [currentAttendee, setCurrentAttendee] = useState({ name: '', email: '', role: '' });
  const [pageTab, setPageTab] = useState(0); // Main page tabs: 0 = New Analysis, 1 = History
  const [activeTab, setActiveTab] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [pollingSessionId, setPollingSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    company_research: 'pending',
    questionnaire: 'pending',
    sales_analysis: 'pending',
    report_generation: 'pending',
  });
  const [progressPercentage, setProgressPercentage] = useState(0); // New percentage-based progress
  const [currentStep, setCurrentStep] = useState('');
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [cancellingResearch, setCancellingResearch] = useState(false);
  const [internalKbProgress, setKmhubProgress] = useState<InternalKnowledgeProgressState | null>(null);
  const { addNotification } = useAppShell();
  const notifiedCompletionRef = useRef<Set<string>>(new Set());

  // Reusable markdown styling so pre-call output inherits the app typography
  const markdownBaseSx = {
    color: theme.palette.text.primary,
    fontFamily: '"Barlow", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    lineHeight: 1.7,
    '& *:not(code)': {
      fontFamily: '"Barlow", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    },
    '& h1': { ...theme.typography.h4, mb: 1, fontFamily: '"Playfair Display", Georgia, serif' },
    '& h2': { ...theme.typography.h5, mb: 1, fontFamily: '"Playfair Display", Georgia, serif' },
    '& h3': { ...theme.typography.subtitle1, fontWeight: 700, mb: 0.75, fontFamily: '"Playfair Display", Georgia, serif' },
    '& h4, & h5, & h6': { ...theme.typography.subtitle2, fontWeight: 700, mb: 0.5, fontFamily: '"Playfair Display", Georgia, serif' },
    '& ul, & ol': { paddingLeft: '1.5rem', marginBottom: '1rem' },
    '& li': { marginBottom: '0.5rem' },
    '& strong, & em': {
      color: 'inherit',
      backgroundColor: 'transparent',
      fontWeight: 600,
      fontStyle: 'normal',
    },
  } as const;

  const markdownComponents = {
    h1: ({ node, ...props }: any) => (
      <Typography
        variant="h4"
        sx={{ fontWeight: 700, mb: 1, mt: 2, fontFamily: '"Playfair Display", Georgia, serif' }}
        {...props}
      />
    ),
    h2: ({ node, ...props }: any) => (
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, mb: 1, mt: 1.5, fontFamily: '"Playfair Display", Georgia, serif' }}
        {...props}
      />
    ),
    h3: ({ node, ...props }: any) => (
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 700, mb: 0.75, mt: 1.25, fontFamily: '"Playfair Display", Georgia, serif' }}
        {...props}
      />
    ),
    h4: ({ node, ...props }: any) => (
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 700, mb: 0.5, mt: 1, fontFamily: '"Playfair Display", Georgia, serif' }}
        {...props}
      />
    ),
    p: ({ node, ...props }: any) => (
      <Typography
        variant="body1"
        sx={{
          mb: 1.5,
          lineHeight: 1.7,
          fontFamily: '"Barlow", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        }}
        {...props}
      />
    ),
    li: ({ node, ...props }: any) => <li {...props} />,
  };

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const resetResearchState = () => {
    setAppState('search');
    setPollingSessionId(null);
    setProgress({
      company_research: 'pending',
      questionnaire: 'pending',
      sales_analysis: 'pending',
      report_generation: 'pending',
    });
    setProgressPercentage(0);
    setCurrentStep('');
    setKmhubProgress(null);
  };

  const resultsTopRef = useRef<HTMLDivElement | null>(null);

  const fetchResults = async (id: string) => {
    if (!id) {
      addLog('No session ID provided');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/research/${id}/result`);
      if (response.ok) {
        const result = await response.json();
        const normalizedExecutiveSummary =
          typeof result.executiveSummary === 'string'
            ? result.executiveSummary
            : typeof result.executiveSummary?.summary === 'string'
              ? result.executiveSummary.summary
              : typeof result.companyDeepDive === 'string'
                ? result.companyDeepDive
                : typeof result.companyDeepDive?.summary === 'string'
                  ? result.companyDeepDive.summary
                  : '';

        // Check if this is the old format (already has executiveSummary) or new format (has companyAnalysis)
        if (result.executiveSummary) {
          // Old format - use as is
          const internalKbPreCallCamel =
            result.internalKbPreCall ||
            result.companyDeepDive?.internalKbPreCall ||
            result.internal_kb_pre_call ||
            result.companyDeepDive?.internal_kb_pre_call ||
            null;

          setSalesData({
            ...result,
            executiveSummary: normalizedExecutiveSummary,
            internalKbRaw: internalKbPreCallCamel,
            internalKbSimilarEngagements:
              internalKbPreCallCamel?.similarEngagements ||
              internalKbPreCallCamel?.similar_engagements ||
              result.internalKbSimilarEngagements ||
              [],
            internalKbAiInsights:
              result.internalKbAiInsights ||
              internalKbPreCallCamel?.pastEngagements ||
              internalKbPreCallCamel?.past_engagements ||
              '',
            // Enhanced Sales Intelligence
            dealHealthSignals: result.dealHealthSignals || undefined,
            suggestedActions: result.suggestedActions || undefined,
            companyIntelligence: result.companyIntelligence || undefined,
            stakeholderInsights: result.stakeholderInsights || undefined,
          });
        } else {
          // New format - transform to match expected structure
          // Helper to safely filter and validate news articles
          const safeArticles = (articles: any[]): any[] => {
            if (!Array.isArray(articles)) return [];
            return articles.filter(article => {
              // Ensure article exists and has required fields
              if (!article || typeof article !== 'object') return false;

              // Must have a valid title
              if (!article.title || typeof article.title !== 'string') return false;

              // Ensure source is defined (even if empty string)
              if (article.source === undefined || article.source === null) {
                article.source = 'Unknown';
              }

              // Ensure date is defined
              if (!article.date) {
                article.date = new Date().toISOString();
              }

              return true;
            });
          };

          // DEBUG: Log newsIntelligence structure
          console.log('=== NEWS DATA EXTRACTION DEBUG ===');
          console.log('newsIntelligence:', result.newsIntelligence);
          console.log('newsIntelligence.news_analysis:', result.newsIntelligence?.news_analysis);
          console.log('recent_headlines:', result.newsIntelligence?.news_analysis?.recent_headlines || result.newsIntelligence?.recent_headlines);
          console.log('news_summary:', result.newsIntelligence?.news_summary);
          console.log('news_sentiment:', result.newsIntelligence?.news_sentiment);
          console.log('===================================');

          const executiveSummary =
            typeof result.executiveSummary === 'string'
              ? result.executiveSummary
              : typeof result.executiveSummary?.summary === 'string'
                ? result.executiveSummary.summary
                : typeof result.companyDeepDive === 'string'
                  ? result.companyDeepDive
                  : typeof result.companyDeepDive?.summary === 'string'
                    ? result.companyDeepDive.summary
                    : formatCompanyAnalysis(result.companyAnalysis);

        const internalKbPreCallCamel =
          result.internalKbPreCall ||
          result.companyDeepDive?.internalKbPreCall ||
          result.internal_kb_pre_call ||
          result.companyDeepDive?.internal_kb_pre_call ||
          null;

        const transformedData: SalesData = {
          companyName: result.companyName || '',
          purposeOfMeeting: result.purposeOfMeeting || '',
          meetingContext: result.meetingContext || '',
          executiveSummary,
          financialPerformance: extractFinancialData(result.companyAnalysis, result.companyDeepDive),
          financialMetrics: result.companyDeepDive?.financials || result.financialMetrics || null,
          salesOpportunities: formatRecommendations(result.recommendations),
          actionPlan: formatActionPlan(result.recommendations),
          meetingQuestionnaire: result.meetingQuestionnaire || '',
          integratorCaseStudies: result.integratorCaseStudies || [],
          libraryCaseStudies: result.libraryCaseStudies || [],
          sharepointDocuments: result.companyDeepDive?.sharepointDocuments || result.sharepointDocuments || [],
          internalKbAiInsights:
            result.internalKbAiInsights ||
            result.companyDeepDive?.internalKbSummary ||
            internalKbPreCallCamel?.pastEngagements ||
            '',
          confidenceScore: result.confidenceScore || calculateConfidenceScore(result),
          internalKbSimilarEngagements:
            internalKbPreCallCamel?.similarEngagements ||
            internalKbPreCallCamel?.similar_engagements ||
            result.companyDeepDive?.internalKbPreCall?.similarEngagements ||
            result.companyDeepDive?.internalKbPreCall?.similar_engagements ||
            result.companyDeepDive?.internal_kb_pre_call?.similarEngagements ||
            result.companyDeepDive?.internal_kb_pre_call?.similar_engagements ||
            [],
          recent_headlines: safeArticles(
            result.newsIntelligence?.news_analysis?.recent_headlines ||
              result.newsIntelligence?.recent_headlines ||
              result.companyDeepDive?.news ||
              result.recent_headlines ||
              []
          ),
          news_summary:
            result.newsIntelligence?.news_analysis?.summary ||
            result.newsIntelligence?.news_summary ||
            result.news_summary ||
            '',
          news_sentiment:
            result.newsIntelligence?.news_analysis?.overall_sentiment ||
            result.newsIntelligence?.news_sentiment ||
            result.news_sentiment ||
            'neutral',
          key_topics:
            result.newsIntelligence?.news_analysis?.key_topics ||
            result.newsIntelligence?.key_topics ||
            result.key_topics ||
            [],
          keyInsights: extractKeyInsights(result.companyAnalysis) || result.keyInsights || [],
          enterpriseRecommendations: extractIntegratorRecommendations(result.recommendations) || result.enterpriseRecommendations || [],
          recommendedProducts: extractRecommendedProducts(result.recommendations) || result.recommendedProducts || [],
          aiQuestionnaire: result.aiQuestionnaire || null, // Pre-generated AI questionnaire
          externalAttendeeResearch: result.externalAttendeeResearch || [],
          internalKbRaw: internalKbPreCallCamel,
        };

          setSalesData(transformedData);
        }

        setAppState('completed');
        addLog('Results loaded successfully!');

        // Emit sync event so other components (calendar, meeting detail) refresh
        if (currentSessionId && linkedMeetingId) {
          emitPreCallCompleted(linkedMeetingId, currentSessionId, 'AnalysisPage');
        }
      } else if (response.status === 404) {
        addLog('Research not yet complete, waiting for results...');
        // Don't show error for 404, research might still be in progress
      } else {
        addLog(`Failed to fetch results: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      addLog(`Failed to fetch results: ${err}`);
    }
  };

  // Helper function to format companyAnalysis into executive summary
  const formatCompanyAnalysis = (analysis: any): string => {
    if (!analysis) return 'No analysis data available.';

    let summary = '';

    // Company Overview
    if (analysis['Key business information']) {
      const info = analysis['Key business information'];
      summary += '## Company Overview\n\n';

      if (info['Company Name']) {
        summary += `**${info['Company Name']}** is`;
      }

      if (info['Industries'] && Array.isArray(info['Industries'])) {
        summary += ` a leader in ${info['Industries'].join(' and ')}`;
      }

      if (info['Headquarters']) {
        summary += `, headquartered in ${info['Headquarters']}`;
      }

      if (info['Global Presence']) {
        summary += ` with ${info['Global Presence'].toLowerCase()}`;
      }
      summary += '.\n\n';

      if (info['Products and Services'] && Array.isArray(info['Products and Services'])) {
        summary += `Their portfolio includes ${info['Products and Services'].join(', ')}.\n\n`;
      }
    }

    // Financial Performance
    if (analysis['Financial highlights']) {
      summary += '## Financial Performance\n\n';
      const financial = analysis['Financial highlights'];
      Object.entries(financial).forEach(([key, value]) => {
        summary += `• **${key}**: ${value}\n`;
      });
      summary += '\n';
    }

    // Market Position
    if (analysis['Market position']) {
      summary += '## Market Position\n\n';
      const market = analysis['Market position'];
      Object.entries(market).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          summary += `**${key}**:\n`;
          value.forEach(item => {
            summary += `  • ${item}\n`;
          });
        } else {
          summary += `• **${key}**: ${value}\n`;
        }
      });
      summary += '\n';
    }

    // Strategic Initiatives
    if (analysis['Strategic initiatives']) {
      summary += '## Strategic Initiatives\n\n';
      const strategic = analysis['Strategic initiatives'];
      Object.entries(strategic).forEach(([key, value]) => {
        if (typeof value === 'string') {
          summary += `• **${key}**: ${value}\n`;
        }
      });
      summary += '\n';
    }

    // Pain Points and Challenges
    if (analysis['Potential pain points']) {
      summary += '## Current Challenges\n\n';
      const painPoints = analysis['Potential pain points'];
      Object.entries(painPoints).forEach(([key, value]) => {
        if (typeof value === 'string') {
          summary += `• **${key}**: ${value}\n`;
        }
      });
      summary += '\n';
    }

    // Buying Signals
    if (analysis['Buying signals']) {
      summary += '## Positive Indicators\n\n';
      const buyingSignals = analysis['Buying signals'];
      Object.entries(buyingSignals).forEach(([key, value]) => {
        if (typeof value === 'string') {
          summary += `• **${key}**: ${value}\n`;
        }
      });
      summary += '\n';
    }

    return summary;
  };

  // Helper function to extract financial data
  const extractFinancialData = (analysis: any, companyData: any): string => {
    console.log('=== FINANCIAL DATA EXTRACTION DEBUG ===');
    console.log('companyData:', companyData);
    console.log('companyDeepDive:', companyData?.companyDeepDive);
    console.log('financialPerformance:', companyData?.companyDeepDive?.financialPerformance);
    console.log('======================================');

    // Extract from companyDeepDive.financialPerformance (new structure)
    const financialPerf = companyData?.companyDeepDive?.financialPerformance;

    if (!financialPerf || typeof financialPerf !== 'object') {
      console.warn('No financial performance data found');
      return 'Financial data not available. The research may still be processing or no financial information was found for this company.';
    }

    let financial = '';

    // Annual Revenue
    if (financialPerf.annualRevenue && financialPerf.annualRevenue !== 'Not available') {
      financial += '## Annual Revenue\n\n';
      financial += financialPerf.annualRevenue;
      financial += '\n\n';
    }

    // Stock Performance
    if (financialPerf.stockPerformance && financialPerf.stockPerformance !== 'Not available') {
      financial += '## Stock Performance\n\n';
      financial += financialPerf.stockPerformance;
      financial += '\n\n';
    }

    // Quarterly Performance
    const hasQuarterlyData = (
      (financialPerf.q1_2024 && financialPerf.q1_2024 !== 'Q1 2024 financial data not available') ||
      (financialPerf.q2_2024 && financialPerf.q2_2024 !== 'Q2 2024 financial data not available') ||
      (financialPerf.q3_2024 && financialPerf.q3_2024 !== 'Q3 2024 financial data not available') ||
      (financialPerf.q4_2024 && financialPerf.q4_2024 !== 'Q4 2024 financial data not available')
    );

    if (hasQuarterlyData) {
      financial += '## Quarterly Performance (2024)\n\n';

      if (financialPerf.q1_2024 && financialPerf.q1_2024 !== 'Q1 2024 financial data not available') {
        financial += '### Q1 2024\n\n';
        financial += financialPerf.q1_2024;
        financial += '\n\n';
      }

      if (financialPerf.q2_2024 && financialPerf.q2_2024 !== 'Q2 2024 financial data not available') {
        financial += '### Q2 2024\n\n';
        financial += financialPerf.q2_2024;
        financial += '\n\n';
      }

      if (financialPerf.q3_2024 && financialPerf.q3_2024 !== 'Q3 2024 financial data not available') {
        financial += '### Q3 2024\n\n';
        financial += financialPerf.q3_2024;
        financial += '\n\n';
      }

      if (financialPerf.q4_2024 && financialPerf.q4_2024 !== 'Q4 2024 financial data not available') {
        financial += '### Q4 2024\n\n';
        financial += financialPerf.q4_2024;
        financial += '\n\n';
      }
    }

    // Growth Rate
    if (financialPerf.growthRate && financialPerf.growthRate !== 'Not available') {
      financial += '## Growth Rate\n\n';
      financial += financialPerf.growthRate;
      financial += '\n\n';
    }

    // Profitability
    if (financialPerf.profitability && financialPerf.profitability !== 'Not available' && financialPerf.profitability !== 'Profitability metrics not available') {
      financial += '## Profitability Metrics\n\n';
      financial += financialPerf.profitability;
      financial += '\n\n';
    }

    return financial || 'Financial data was collected but no specific metrics are available.';
  };

  // Helper function to format recommendations for sales opportunities
  const formatRecommendations = (recommendations: any): string => {
    if (!recommendations) return 'No recommendations available.';

    let formatted = '';

    if (typeof recommendations === 'object' && recommendations !== null) {
      // Focus on value propositions and key talking points for sales opportunities
      if (recommendations['Value propositions to emphasize']) {
        formatted += '## Value Propositions\n\n';
        const valueProps = recommendations['Value propositions to emphasize'];
        if (Array.isArray(valueProps)) {
          valueProps.forEach((item, idx) => {
            formatted += `${idx + 1}. ${item}\n\n`;
          });
        }
      }

      if (recommendations['Key talking points']) {
        formatted += '## Key Talking Points\n\n';
        const talkingPoints = recommendations['Key talking points'];
        if (Array.isArray(talkingPoints)) {
          talkingPoints.forEach((item, idx) => {
            formatted += `${idx + 1}. ${item}\n\n`;
          });
        }
      }

      if (recommendations['Questions to ask in next meeting']) {
        formatted += '## Discovery Questions\n\n';
        const questions = recommendations['Questions to ask in next meeting'];
        if (Array.isArray(questions)) {
          questions.forEach((item, idx) => {
            formatted += `${idx + 1}. ${item}\n\n`;
          });
        }
      }
    } else if (typeof recommendations === 'string') {
      formatted = recommendations;
    }

    return formatted || 'No sales opportunities identified.';
  };

  // Helper function to format action plan
  const formatActionPlan = (recommendations: any): string => {
    if (!recommendations) return 'No action plan available.';

    let formatted = '';

    if (typeof recommendations === 'object' && recommendations !== null) {
      // Focus on recommended next steps and objection handling
      if (recommendations['Recommended next steps']) {
        formatted += '## Recommended Next Steps\n\n';
        const nextSteps = recommendations['Recommended next steps'];
        if (Array.isArray(nextSteps)) {
          nextSteps.forEach((item, idx) => {
            formatted += `${idx + 1}. ${item}\n\n`;
          });
        }
      }

      if (recommendations['Potential objections and responses']) {
        formatted += '## Objection Handling\n\n';
        const objections = recommendations['Potential objections and responses'];
        if (typeof objections === 'object' && objections !== null) {
          Object.entries(objections).forEach(([objection, response]) => {
            formatted += `**${objection}**\n${response}\n\n`;
          });
        }
      }

      if (recommendations['Key talking points']) {
        formatted += '## Preparation Checklist\n\n';
        const talkingPoints = recommendations['Key talking points'];
        if (Array.isArray(talkingPoints)) {
          talkingPoints.forEach((item, idx) => {
            formatted += `☐ ${item}\n\n`;
          });
        }
      }
    } else if (typeof recommendations === 'string') {
      formatted = recommendations;
    }

    return formatted || 'No action plan available.';
  };

  // Helper function to calculate confidence score
  const calculateConfidenceScore = (result: any): number => {
    // Simple heuristic: check how much data is available
    let score = 0.5;

    if (result.companyAnalysis) score += 0.15;
    if (result.companyData) score += 0.15;
    if (result.newsIntelligence) score += 0.1;
    if (result.recommendations) score += 0.1;

    return Math.min(score, 1.0);
  };

  // Helper function to extract key insights
  const extractKeyInsights = (analysis: any): string[] => {
    const insights: string[] = [];

    if (analysis && analysis['Strategic initiatives']) {
      const initiatives = analysis['Strategic initiatives'];
      if (Array.isArray(initiatives)) {
        insights.push(...initiatives);
      } else if (typeof initiatives === 'object') {
        Object.values(initiatives).forEach(value => {
          if (Array.isArray(value)) {
            insights.push(...value);
          } else if (typeof value === 'string') {
            insights.push(value);
          }
        });
      }
    }

    if (analysis && analysis['Market position']) {
      const market = analysis['Market position'];
      if (Array.isArray(market)) {
        insights.push(...market);
      } else if (typeof market === 'object') {
        Object.values(market).forEach(value => {
          if (Array.isArray(value)) {
            insights.push(...value);
          } else if (typeof value === 'string') {
            insights.push(value);
          }
        });
      }
    }

    return insights.slice(0, 10); // Limit to 10 insights
  };

  // Helper function to extract Northstar Integrators recommendations
  const extractIntegratorRecommendations = (recommendations: any): string[] => {
    const recs: string[] = [];

    if (recommendations && typeof recommendations === 'object') {
      Object.values(recommendations).forEach(value => {
        if (Array.isArray(value)) {
          recs.push(...value.map(String));
        } else if (typeof value === 'string') {
          recs.push(value);
        }
      });
    }

    return recs.slice(0, 5);
  };

  // Helper function to extract recommended products
  const extractRecommendedProducts = (recommendations: any): string[] => {
    const products: string[] = [];

    if (recommendations && recommendations['Recommended solutions']) {
      const solutions = recommendations['Recommended solutions'];
      if (Array.isArray(solutions)) {
        products.push(...solutions);
      } else if (typeof solutions === 'object') {
        Object.values(solutions).forEach(value => {
          if (Array.isArray(value)) {
            products.push(...value);
          }
        });
      }
    }

    return products;
  };

  // Check for ongoing research in localStorage and restore it SEAMLESSLY
  useEffect(() => {
    const ongoingResearch = localStorage.getItem('ongoingResearch');

    if (ongoingResearch) {
      try {
        const savedData = JSON.parse(ongoingResearch);
        const {
          sessionId,
          companyName: savedCompanyName,
          purposeOfMeeting: savedPurpose,
          progressPercentage: savedProgress,
          currentStep: savedStep,
          progress: savedProgressState
        } = savedData;

        // Validate sessionId
        if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
          localStorage.removeItem('ongoingResearch');
          return;
        }

        // IMMEDIATELY restore UI state from localStorage - NO "resuming" message
        setCompanyName(savedCompanyName);
        if (savedPurpose) setPurposeOfMeeting(savedPurpose);
        setCurrentSessionId(sessionId);
        setAppState('researching');
        if (savedData.meetingId) {
          setLinkedMeetingId(savedData.meetingId);
        }

        // Restore progress state immediately from localStorage
        if (savedProgress !== undefined) {
          setProgressPercentage(savedProgress);
        }
        if (savedStep) {
          setCurrentStep(savedStep);
        }
        if (savedProgressState) {
          setProgress(savedProgressState);
        }

        // Silently start polling - backend check happens in background
        fetch(`${API_BASE_URL}/api/research/status/${sessionId}`)
          .then(response => {
            if (!response.ok) {
              localStorage.removeItem('ongoingResearch');
              setAppState('search');
              return null;
            }
            return response.json();
          })
          .then(data => {
            if (!data) return;

            const statusData = data.data || data;

            if (statusData.status === 'in_progress') {
              // Start polling silently - UI is already showing progress
              setPollingSessionId(sessionId);

              // Update with latest backend state if available
              if (statusData.progress?.percentage !== undefined) {
                setProgressPercentage(statusData.progress.percentage);
              }
              if (statusData.currentStep || statusData.current_step) {
                setCurrentStep(statusData.currentStep || statusData.current_step);
              }
            } else if (statusData.status === 'completed') {
              // Research completed while user was away
              addLog('Research completed. Loading results...');
              localStorage.removeItem('ongoingResearch');
              fetchResults(sessionId);
            } else {
              // Error or not found
              localStorage.removeItem('ongoingResearch');
              setAppState('search');
            }
          })
          .catch(() => {
            // Network error - keep showing current state, user can retry
            // Still start polling in case it's a temporary issue
            setPollingSessionId(sessionId);
          });
      } catch (err) {
        localStorage.removeItem('ongoingResearch');
      }
    }
  }, []);

  // Check for sessionId in URL and load results if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('sessionId');
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      return;
    }

    // Switch to the New Analysis tab to show loaded results
    setPageTab(0);

    const ongoingResearch = localStorage.getItem('ongoingResearch');
    if (ongoingResearch) {
      addLog('Clearing previous in-progress research so a saved analysis can be opened.');
      localStorage.removeItem('ongoingResearch');
      resetResearchState();
    }

    addLog(`Loading analysis for session: ${sessionId}`);
    setCurrentSessionId(sessionId);
    fetchResults(sessionId).then(() => {
      // Scroll to the top of the analysis results container for visibility
      setTimeout(() => {
        if (resultsTopRef.current) {
          resultsTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    });
    setSearchParams({});
  }, [location.search, setSearchParams]);

  useEffect(() => {
    if (companyName.trim() || attendees.length === 0) {
      return;
    }
    const derivedCompany = deriveCompanyFromAttendeeEmails(attendees);
    if (derivedCompany) {
      setCompanyName(derivedCompany);
      addLog(`Detected company from attendee domain: ${derivedCompany}`);
    }
  }, [attendees, companyName]);

  // Check for meeting data in URL query parameters and pre-fill the form
  useEffect(() => {
    const company = searchParams.get('company');
    const purpose = searchParams.get('purpose');
    const meetingContextParam =
      searchParams.get('meetingContext') || searchParams.get('meeting_context') || searchParams.get('context');
    const attendeesParam = searchParams.get('attendees');
    const meetingIdParam = searchParams.get('meetingId');

    let shouldClearParams = false;

    if (company) {
      setCompanyName(company);
      addLog(`Pre-filled company: ${company}`);
      shouldClearParams = true;
    }

    if (purpose) {
      setPurposeOfMeeting(purpose);
      addLog(`Pre-filled purpose: ${purpose}`);
      shouldClearParams = true;
    }

    if (meetingContextParam) {
      setMeetingContext(meetingContextParam);
      addLog(`Pre-filled meeting context`);
      shouldClearParams = true;
    }

    if (attendeesParam) {
      try {
        const parsedAttendees = JSON.parse(attendeesParam);
        if (Array.isArray(parsedAttendees) && parsedAttendees.length > 0) {
          setAttendees(parsedAttendees);
          addLog(`Pre-filled ${parsedAttendees.length} attendees`);
          if (!company) {
            const derivedCompany = deriveCompanyFromAttendeeEmails(parsedAttendees);
            if (derivedCompany) {
              setCompanyName(derivedCompany);
              addLog(`Detected company from attendee domain: ${derivedCompany}`);
            }
          }
        }
      } catch (error) {
        console.error('Failed to parse attendees from URL:', error);
      }
      shouldClearParams = true;
    }

    if (meetingIdParam) {
      setLinkedMeetingId(meetingIdParam);
      addLog(`Linked analysis to meeting ${meetingIdParam}`);
      shouldClearParams = true;
    }

    // Check for autoStart parameter (from AI Assistant)
    const autoStartParam = searchParams.get('autoStart');

    if (shouldClearParams) {
      setSearchParams({});
    }

    // Auto-start analysis if company is provided and autoStart is true
    if (autoStartParam === 'true' && company) {
      autoStartCompanyRef.current = company;
      setShouldAutoStart(true);
    }
  }, []); // Run only once on mount

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const extractResearchText = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object' && typeof parsed.research === 'string') {
            return parsed.research;
          }
        } catch {
          // fall back to raw string
        }
      }
      return trimmed;
    }
    if (typeof value === 'object' && typeof value.research === 'string') {
      return value.research;
    }
    return '';
  };

  const handleSearch = async (attendees: any[] = [], companyOverride?: string) => {
    const company = companyOverride || companyName;
    if (!company.trim()) return;

    // Also update the state if we're using an override
    if (companyOverride && companyOverride !== companyName) {
      setCompanyName(companyOverride);
    }

    setAppState('researching');
    setError('');
    setProgressPercentage(0); // Reset progress bar
    addLog(`Starting research for ${company}`);
    if (linkedMeetingId) {
      addLog(`Linking analysis to meeting ${linkedMeetingId}`);
    }

    try {
      const result = await apiPost('/api/research/start', {
        companyName: company,
        purposeOfMeeting: purposeOfMeeting || 'General business discussion',
        meetingContext: meetingContext,
        attendees: attendees,
        meetingId: linkedMeetingId || undefined,
      });

      const sessionId =
        result?.sessionId ||
        result?.data?.sessionId ||
        result?.data?.session_id ||
        null;

      if (sessionId) {
        const isResume = !result?.success && result?.data?.sessionId;
        addLog(isResume ? `Pre-call already running. Resuming session: ${sessionId}` : `Research session started: ${sessionId}`);

        setCurrentSessionId(sessionId);
        setPollingSessionId(sessionId);
        notifiedCompletionRef.current.delete(sessionId);
        addNotification({
          title: 'Pre-call analysis started',
          message: `${company} research is running.`,
          type: 'info',
        });

        // Emit sync event so other components (calendar, meeting detail) update
        if (linkedMeetingId && sessionId) {
          emitPreCallStarted(linkedMeetingId, sessionId, 'AnalysisPage');
        }

        // Save to localStorage so we can resume if user navigates away
        localStorage.setItem('ongoingResearch', JSON.stringify({
          sessionId: sessionId,
          companyName: company,
          purposeOfMeeting: purposeOfMeeting,
          meetingContext,
          attendees,
          meetingId: linkedMeetingId,
          startTime: Date.now(),
          progressPercentage: 0,
          currentStep: 'Starting research...',
          progress: {
            external_research: 'pending',
            integrator_cases: 'pending',
            library_cases: 'pending',
            report_generation: 'pending',
          },
          logs: [`Research session started: ${sessionId}`]
        }));
      } else {
        const serverMsg = result?.message || result?.error || '';
        throw new Error(serverMsg || 'Failed to start research');
      }
    } catch (err) {
      setError('Failed to start research. Please try again.');
      setAppState('search');
      localStorage.removeItem('ongoingResearch');
      addLog(`Error: ${err}`);
    }
  };

  // Effect to auto-start research when triggered from AI Assistant
  useEffect(() => {
    if (shouldAutoStart && appState === 'search') {
      // Use the ref to get the company name directly from URL params
      const companyToResearch = autoStartCompanyRef.current || companyName;
      if (companyToResearch.trim()) {
        addLog('Auto-starting analysis from AI Assistant...');
        setShouldAutoStart(false);
        autoStartCompanyRef.current = null;
        handleSearch(attendees, companyToResearch);
      }
    }
  }, [shouldAutoStart, appState]);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!pollingSessionId) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Track if component is still mounted
    let isMounted = true;

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/research/status/${pollingSessionId}`);
        if (!response.ok || !isMounted) return;

        const result = await response.json();
        const statusData = result.data || result; // Unwrap data if present

        // Only update state if component is still mounted
        if (!isMounted) return;

        // Only update progress if it exists and has the expected structure
        if (statusData.progress && typeof statusData.progress === 'object' && !statusData.progress.percentage) {
          // This is the old progress format with external_research, integrator_cases, etc.
          setProgress((prev) => {
            const newProgress = statusData.progress;
            Object.keys(newProgress).forEach((key) => {
              if (prev[key as keyof ProgressState] !== newProgress[key]) {
                if (newProgress[key] === 'running') {
                  addLog(`${key.replace('_', ' ')} started`);
                } else if (newProgress[key] === 'completed') {
                  addLog(`${key.replace('_', ' ')} completed`);
                }
              }
            });
            return newProgress;
          });
        } else if (statusData.progress && statusData.progress.percentage !== undefined) {
          // New progress format with percentage - update both state and logs
          const percentage = statusData.progress.percentage;
          setProgressPercentage(percentage);

          // Map percentage to individual step statuses for the pipeline display (8-step pipeline)
          // Step 1-4: 10%-50% - Company research, news, analysis, attendees
          // Step 5-6: 60%-75% - RAG content search, recommendations
          // Step 7: 85% - Compiling results
          // Step 8: 95%-100% - AI questionnaire generation
          const newProgress: ProgressState = {
            // 10–65 %: company deep dive + attendee research running in parallel
            company_research: percentage >= 65 ? 'completed' : percentage >= 10 ? 'running' : 'pending',
            // 65–70 %: AI questionnaire generation
            questionnaire: percentage >= 70 ? 'completed' : percentage >= 65 ? 'running' : 'pending',
            // 70–90 %: deal health, stakeholder insights, action items
            sales_analysis: percentage >= 90 ? 'completed' : percentage >= 70 ? 'running' : 'pending',
            // 90–100 %: compiling final report
            report_generation: percentage >= 100 ? 'completed' : percentage >= 90 ? 'running' : 'pending',
          };

          // Update progress state if it has changed
          setProgress(prev => {
            const hasChanged = Object.keys(newProgress).some(
              key => prev[key as keyof ProgressState] !== newProgress[key as keyof ProgressState]
            );
            if (hasChanged) {
              // Log status changes
              Object.keys(newProgress).forEach(key => {
                const typedKey = key as keyof ProgressState;
                if (prev[typedKey] !== newProgress[typedKey]) {
                  if (newProgress[typedKey] === 'running') {
                    addLog(`${key.replace('_', ' ')} started`);
                  } else if (newProgress[typedKey] === 'completed') {
                    addLog(`${key.replace('_', ' ')} completed`);
                  }
                }
              });
              return newProgress;
            }
            return prev;
          });

          if (statusData.progress.step) {
            addLog(`Progress: ${percentage}% - ${statusData.progress.step}`);
          }
        }

        if (statusData.currentStep || statusData.current_step) {
          setCurrentStep(statusData.currentStep || statusData.current_step);
        }

        // Update InternalKnowledge progress if available
        if (statusData.internalKbProgress) {
          setKmhubProgress(statusData.internalKbProgress);
        }

        // Update localStorage with current state for seamless navigation
        const existingData = localStorage.getItem('ongoingResearch');
        if (existingData && statusData.status === 'in_progress') {
          try {
            const parsed = JSON.parse(existingData);
            const updatedData = {
              ...parsed,
              progressPercentage: statusData.progress?.percentage || parsed.progressPercentage || 0,
              currentStep: statusData.currentStep || statusData.current_step || parsed.currentStep,
              progress: statusData.progress && !statusData.progress.percentage ? statusData.progress : parsed.progress,
              lastUpdated: Date.now()
            };
            localStorage.setItem('ongoingResearch', JSON.stringify(updatedData));
          } catch (e) {
            // Ignore localStorage errors
          }
        }

        if (statusData.status === 'completed') {
          addLog('Research completed! Fetching results...');
          setProgressPercentage(100); // Ensure progress bar reaches 100%
          setPollingSessionId(null);
          localStorage.removeItem('ongoingResearch');
          if (!notifiedCompletionRef.current.has(pollingSessionId)) {
            const nameForNotification = salesData?.companyName || companyName || 'Research';
            addNotification({
              title: 'Pre-call analysis completed',
              message: `${nameForNotification} analysis completed.`,
              type: 'success',
            });
            notifiedCompletionRef.current.add(pollingSessionId);
          }

          // Only fetch results if component is still mounted
          if (isMounted) {
            fetchResults(pollingSessionId);
          }
        } else if (statusData.status === 'error') {
          setError(statusData.error || 'Research failed');
          setAppState('search');
          setPollingSessionId(null);
          localStorage.removeItem('ongoingResearch');
          addLog(`Research failed: ${statusData.error}`);
          if (!notifiedCompletionRef.current.has(pollingSessionId)) {
            addNotification({
              title: 'Pre-call analysis failed',
              message: statusData.error || 'Research failed.',
              type: 'error',
            });
            notifiedCompletionRef.current.add(pollingSessionId);
          }
        } else if (statusData.status === 'cancelled') {
          // Research was cancelled (possibly from another tab/window)
          setAppState('search');
          setPollingSessionId(null);
          localStorage.removeItem('ongoingResearch');
          addLog('Research was cancelled');
        }
      } catch (err) {
        if (isMounted) {
          addLog('Connection error, retrying...');
        }
      }
    };

    poll();
    pollingIntervalRef.current = setInterval(poll, 2000);

    return () => {
      // Mark component as unmounted
      isMounted = false;

      // Clear the polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [pollingSessionId]);

  const handleDownloadQuestionnaire = () => {
    if (!salesData || !salesData.aiQuestionnaire) {
      setError('No questionnaire available to download yet.');
      addLog('Questionnaire download requested but no questionnaire was available.');
      return;
    }

    try {
      const questionnaire = salesData.aiQuestionnaire;
      const lines: string[] = [];
      const timestamp = new Date().toLocaleString();
      lines.push(`Meeting Questionnaire – ${salesData.companyName || 'Company'}`);
      lines.push(`Generated on ${timestamp}`);
      lines.push('');

      if (questionnaire.researchContext) {
        lines.push('Research Context:');
        lines.push(questionnaire.researchContext);
        lines.push('');
      }
      if (questionnaire.valueProposition) {
        lines.push('Value Proposition:');
        lines.push(questionnaire.valueProposition);
        lines.push('');
      }

      const questionList = Array.isArray(questionnaire.questions) ? questionnaire.questions : [];
      if (questionList.length > 0) {
        lines.push('Questions:');
        questionList.forEach((question: any, index: number) => {
          if (!question?.question) {
            return;
          }
          lines.push(`${index + 1}. ${question.question}`);
          if (question.context) {
            lines.push(`   Context: ${question.context}`);
          }
          if (question.category) {
            lines.push(`   Category: ${question.category}`);
          }
          if (question.target_persona) {
            lines.push(`   Persona: ${question.target_persona}`);
          }
          lines.push('');
        });
      } else if (typeof questionnaire === 'string') {
        lines.push(questionnaire);
      } else if (questionnaire.meetingQuestionnaireText) {
        lines.push(questionnaire.meetingQuestionnaireText);
      } else {
        lines.push('No structured questions available in this questionnaire.');
      }

      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sanitizedCompany = (salesData.companyName || 'meeting').replace(/[\\/:*?"<>|]/g, '_');
      link.download = `${sanitizedCompany}-questionnaire.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addLog('Questionnaire downloaded.');
    } catch (err) {
      setError('Failed to download questionnaire. Please try again.');
      addLog(`Questionnaire download failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCancelResearch = async () => {
    if (!currentSessionId) {
      return;
    }

    setCancellingResearch(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/research/${currentSessionId}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        addLog('Research cancelled');
        // Stop polling
        setPollingSessionId(null);
        // Clear localStorage
        localStorage.removeItem('ongoingResearch');
        // Reset state
        setAppState('search');
        setProgress({
          company_research: 'pending',
          questionnaire: 'pending',
          sales_analysis: 'pending',
          report_generation: 'pending',
        });
        setProgressPercentage(0);
        setCurrentStep('');
      } else {
        addLog('Failed to cancel research');
      }
    } catch (err) {
      addLog(`Error cancelling research: ${err}`);
    } finally {
      setCancellingResearch(false);
    }
  };

  const calculateProgress = () => {
    // Use new percentage-based progress if available, otherwise fall back to old calculation
    if (progressPercentage > 0) {
      return progressPercentage;
    }
    const statuses = Object.values(progress);
    const completed = statuses.filter((s) => s === 'completed').length;
    const running = statuses.filter((s) => s === 'running').length;
    return ((completed + running * 0.5) / statuses.length) * 100;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Fade in timeout={400}>
      <Box>
      {/* Hero Header */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 4,
          borderRadius: 4,
          background: COLORS.gradient,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '50%',
            height: '100%',
            opacity: 0.1,
            background: 'radial-gradient(circle at 50% 50%, white 0%, transparent 70%)',
          }}
        />
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Stack direction="row" spacing={3} alignItems="center">
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                bgcolor: alpha('#fff', 0.15),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Analytics sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                Pre-Call Research
              </Typography>
              <Typography variant="body1" sx={{ color: alpha('#fff', 0.85) }}>
                Generate comprehensive sales intelligence with AI-driven insights
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={() => navigateRouter('/app/analysis/postcall')}
            sx={{
              bgcolor: alpha('#fff', 0.15),
              color: 'white',
              fontWeight: 600,
              borderRadius: 2,
              '&:hover': {
                bgcolor: alpha('#fff', 0.25),
              },
            }}
          >
            Open Post-Call Analysis
          </Button>
        </Stack>
      </Paper>

      {/* Tab Navigation */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={pageTab}
          onChange={(_, v) => setPageTab(v)}
          sx={{
            px: 2,
            borderBottom: 1, borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'text.secondary',
              minHeight: 52,
              '&.Mui-selected': {
                color: 'text.primary',
              },
            },
            '& .MuiTabs-indicator': {
              bgcolor: 'secondary.main',
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab
            icon={<AddIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="New Analysis"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={<HistoryIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Analysis History"
            sx={{ gap: 1 }}
          />
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ p: 3 }}>
          {pageTab === 0 && (
            <>
      {appState === 'search' && (
        <Fade in={true} timeout={800}>
          <Paper
            elevation={0}
            sx={{
              p: 6,
              textAlign: 'center',
              mb: 4,
              bgcolor: 'background.paper',
              borderColor: 'divider',
              borderRadius: 3,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)',
              },
            }}
          >
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h4"
                sx={{
                  mb: 2,
                  fontWeight: 700,
                  color: 'text.primary',
                }}
              >
                AI-Powered Company Research
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'text.secondary',
                  fontSize: '1.125rem',
                  maxWidth: 500,
                  mx: 'auto',
                  lineHeight: 1.6,
                }}
              >
                Enter a company name to generate comprehensive sales intelligence with AI-driven insights
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                maxWidth: 600,
                mx: 'auto',
                mb: 3,
              }}
            >
              <TextField
                fullWidth
                label="Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Microsoft, Apple, Tesla"
                required
                sx={{
                  '& .MuiInputLabel-root': {
                    color: 'text.secondary',
                    fontWeight: 500,
                  },
                  '& .MuiOutlinedInput-input': {
                    fontSize: '1.125rem',
                    fontWeight: 500,
                  },
                }}
              />

              <TextField
                fullWidth
                label="Purpose of Meeting"
                value={purposeOfMeeting}
                onChange={(e) => setPurposeOfMeeting(e.target.value)}
                placeholder="e.g., Discuss digital transformation opportunities"
                sx={{
                  '& .MuiInputLabel-root': {
                    color: 'text.secondary',
                    fontWeight: 500,
                  },
                }}
              />

              <TextField
                fullWidth
                label="Meeting Context (Optional)"
                value={meetingContext}
                onChange={(e) => setMeetingContext(e.target.value)}
                placeholder="e.g., Focus on AI/ML advancements, CRM integrations, cloud migration"
                multiline
                rows={3}
                helperText="Add specific topics you want to discuss during the meeting"
                sx={{
                  '& .MuiInputLabel-root': {
                    color: 'text.secondary',
                    fontWeight: 500,
                  },
                  '& .MuiFormHelperText-root': {
                    color: 'text.disabled',
                  },
                }}
              />

              <Divider sx={{ my: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', px: 2, fontWeight: 600 }}>
                  Meeting Attendees (Optional)
                </Typography>
              </Divider>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Add attendees to research their backgrounds and generate personalized engagement strategies
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    label="Name"
                    value={currentAttendee.name}
                    onChange={(e) => setCurrentAttendee({ ...currentAttendee, name: e.target.value })}
                    placeholder="John Doe"
                    sx={{ flex: 2 }}
                  />
                  <TextField
                    size="small"
                    label="Email"
                    type="email"
                    value={currentAttendee.email}
                    onChange={(e) => setCurrentAttendee({ ...currentAttendee, email: e.target.value })}
                    placeholder="john@company.com"
                    sx={{ flex: 2 }}
                  />
                  <TextField
                    size="small"
                    label="Role"
                    value={currentAttendee.role}
                    onChange={(e) => setCurrentAttendee({ ...currentAttendee, role: e.target.value })}
                    placeholder="CTO"
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    color="primary"
                    onClick={() => {
                      if (currentAttendee.name.trim() && currentAttendee.email.trim()) {
                        setAttendees([...attendees, currentAttendee]);
                        setCurrentAttendee({ name: '', email: '', role: '' });
                      }
                    }}
                    disabled={!currentAttendee.name.trim() || !currentAttendee.email.trim()}
                    sx={{
                      bgcolor: 'secondary.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'secondary.main' },
                      '&:disabled': { bgcolor: 'rgba(148, 163, 184, 0.3)' },
                    }}
                  >
                    <PersonAdd />
                  </IconButton>
                </Box>

                {attendees.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    {attendees.map((attendee, index) => (
                      <Chip
                        key={index}
                        label={`${attendee.name} (${attendee.role || 'Role not specified'})`}
                        onDelete={() => setAttendees(attendees.filter((_, i) => i !== index))}
                        deleteIcon={<Delete />}
                        sx={{
                          bgcolor: 'background.paper',
                          borderColor: 'divider',
                          color: 'text.primary',
                          fontWeight: 600,
                          '& .MuiChip-deleteIcon': {
                            color: 'text.disabled',
                            '&:hover': { color: 'error.main' },
                          },
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>

              <Button
                variant="contained"
                size="large"
                onClick={() => handleSearch(attendees)}
                disabled={!companyName.trim()}
                startIcon={<Search />}
                data-testid="start-research-button"
                sx={{
                  height: 56,
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'white',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                  },
                }}
              >
                Analyze
              </Button>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              {['Microsoft', 'Apple', 'Tesla', 'Amazon', 'Google'].map((company) => (
                <Chip
                  key={company}
                  label={company}
                  variant="outlined"
                  clickable
                  onClick={() => setCompanyName(company)}
                  sx={{
                    borderColor: 'divider',
                    color: 'text.secondary',
                    fontSize: '0.875rem',
                    '&:hover': {
                      borderColor: '#2563eb',
                      backgroundColor: 'rgba(37, 99, 235, 0.06)',
                      color: 'secondary.main',
                    },
                  }}
                />
              ))}
            </Box>

            {error && (
              <Fade in={true}>
                <Alert
                  severity="error"
                  sx={{
                    mt: 3,
                    maxWidth: 600,
                    mx: 'auto',
                    borderRadius: 2,
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'error.main',
                  }}
                >
                  {error}
                </Alert>
              </Fade>
            )}
          </Paper>
        </Fade>
      )}

      {/* Progress Tracking */}
      {appState === 'researching' && (
        <Fade in={true} timeout={600}>
          <Box>
            {/* Progress Header */}
            <Paper
              elevation={0}
              sx={{
                p: 4,
                mb: 4,
                bgcolor: 'background.paper',
                borderRadius: 3,
                borderColor: 'divider',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
                  Researching: {normalizeCompanyDisplay(companyName)}
                </Typography>
                <Typography variant="h6" sx={{ color: 'text.secondary', mb: 3, fontWeight: 400 }}>
                  {currentStep}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={calculateProgress()}
                      sx={{
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 6,
                          backgroundColor: '#2563eb',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                        },
                      }}
                    />
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                      Processing {Math.round(calculateProgress())}% complete
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {Math.round(calculateProgress())}%
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Complete
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    onClick={handleCancelResearch}
                    disabled={cancellingResearch}
                    sx={{
                      ml: 2,
                      color: 'error.main',
                      borderColor: '#ef4444',
                      backgroundColor: 'rgba(239, 68, 68, 0.05)',
                      '&:hover': {
                        borderColor: '#dc2626',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      },
                      '&:disabled': {
                        color: 'rgba(239, 68, 68, 0.4)',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    {cancellingResearch ? 'Cancelling...' : 'Cancel'}
                  </Button>
                </Box>
              </Box>
            </Paper>

            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Main Pipeline */}
              <Card sx={{ flex: '2 1 520px' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Main Pipeline
                    </Typography>
                    <Chip label="SEQUENTIAL" size="small" sx={{ bgcolor: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 600, fontSize: '0.65rem' }} />
                  </Box>

                  <Stack spacing={2}>
                    {[
                      {
                        key: 'company_research',
                        label: 'Company & Attendee Research',
                        icon: <Assessment />,
                        description: 'Web research: financials, strategy, market position, attendee backgrounds — runs in parallel',
                      },
                      {
                        key: 'questionnaire',
                        label: 'Meeting Questionnaire',
                        icon: <Quiz />,
                        description: 'AI-generated discovery questions tailored to the company and meeting purpose',
                      },
                      {
                        key: 'sales_analysis',
                        label: 'Sales Intelligence Analysis',
                        icon: <Analytics />,
                        description: 'Deal health signals, stakeholder insights, and suggested actions',
                      },
                      {
                        key: 'report_generation',
                        label: 'Report Compilation',
                        icon: <CloudUpload />,
                        description: 'Synthesising all findings into the final pre-call intelligence report',
                      },
                    ].map((step, index) => {
                      const status = progress[step.key as keyof ProgressState] || 'pending';
                      const isCompleted = status === 'completed';
                      const isRunning = status === 'running';

                      return (
                        <Box
                          key={step.key}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            p: 3,
                            borderRadius: 2,
                            background: isCompleted
                              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)'
                              : isRunning
                              ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(29, 78, 216, 0.05) 100%)'
                              : 'white',
                            border: `1px solid ${
                              isCompleted ? 'rgba(16, 185, 129, 0.4)' : isRunning ? 'rgba(37, 99, 235, 0.35)' : '#e2e8f0'
                            }`,
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            '&::before': isRunning
                              ? {
                                  content: '""',
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: '3px',
                                  background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                                  borderRadius: '0 2px 2px 0',
                                }
                              : {},
                          }}
                        >
                          <Avatar
                            sx={{
                              mr: 2,
                              bgcolor: isCompleted ? '#059669' : isRunning ? '#2563eb' : '#f1f5f9',
                              color: isCompleted || isRunning ? '#FFFFFF' : '#64748b',
                              width: 40,
                              height: 40,
                            }}
                          >
                            {isCompleted ? (
                              <CheckCircle />
                            ) : isRunning ? (
                              <CircularProgress size={20} color="inherit" />
                            ) : (
                              step.icon
                            )}
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: 600,
                                color: isCompleted ? '#059669' : isRunning ? '#2563eb' : '#171717',
                                mb: 0.5,
                              }}
                            >
                              {step.label}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'text.secondary',
                                fontSize: '0.875rem',
                                lineHeight: 1.4,
                              }}
                            >
                              {step.description}
                            </Typography>
                          </Box>
                          <Chip
                            label={status.replace('_', ' ').toUpperCase()}
                            size="small"
                            sx={{
                              backgroundColor: isCompleted
                                ? 'rgba(5, 150, 105, 0.12)'
                                : isRunning
                                ? 'rgba(37, 99, 235, 0.12)'
                                : '#f1f5f9',
                              color: isCompleted ? '#059669' : isRunning ? '#2563eb' : '#64748b',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              border: 'none',
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>

              {/* Background Workers Column */}
              <Box sx={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Section header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Background Workers
                  </Typography>
                  <Chip label="PARALLEL" size="small" sx={{ bgcolor: 'rgba(124,58,237,0.08)', color: '#7c3aed', fontWeight: 600, fontSize: '0.65rem' }} />
                </Box>

                {/* Internal Knowledge Search worker */}
                <Card
                  sx={{
                    border: '1px solid',
                    borderColor: internalKbProgress?.status === 'complete'
                      ? 'rgba(16,185,129,0.35)'
                      : internalKbProgress?.status === 'error'
                      ? 'rgba(239,68,68,0.25)'
                      : 'rgba(124,58,237,0.25)',
                    bgcolor: internalKbProgress?.status === 'complete'
                      ? 'rgba(16,185,129,0.04)'
                      : internalKbProgress?.status === 'error'
                      ? 'rgba(239,68,68,0.04)'
                      : 'rgba(124,58,237,0.04)',
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    {/* Worker header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: internalKbProgress?.status === 'complete'
                            ? 'rgba(16,185,129,0.15)'
                            : internalKbProgress?.status === 'error'
                            ? 'rgba(239,68,68,0.12)'
                            : 'rgba(124,58,237,0.12)',
                          color: internalKbProgress?.status === 'complete' ? '#059669'
                            : internalKbProgress?.status === 'error' ? '#ef4444' : '#7c3aed',
                        }}
                      >
                        {internalKbProgress?.status === 'complete' ? (
                          <CheckCircle sx={{ fontSize: 20 }} />
                        ) : internalKbProgress?.status === 'error' ? (
                          <Description sx={{ fontSize: 20 }} />
                        ) : (
                          <Psychology sx={{ fontSize: 20 }} />
                        )}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
                          Internal Knowledge Search
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Northstar Integrators Knowledge Hub · decoupled worker
                        </Typography>
                      </Box>
                    </Box>

                    {/* Status row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Chip
                        label={
                          !internalKbProgress || internalKbProgress.status === 'idle' ? 'QUEUED'
                          : internalKbProgress.status === 'streaming' ? 'SEARCHING'
                          : internalKbProgress.status === 'complete' ? 'COMPLETE'
                          : internalKbProgress.status === 'error' ? 'TIMED OUT'
                          : 'STARTING'
                        }
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          bgcolor: internalKbProgress?.status === 'complete'
                            ? 'rgba(16,185,129,0.15)' : internalKbProgress?.status === 'error'
                            ? 'rgba(239,68,68,0.12)' : 'rgba(124,58,237,0.12)',
                          color: internalKbProgress?.status === 'complete' ? '#059669'
                            : internalKbProgress?.status === 'error' ? '#ef4444' : '#7c3aed',
                        }}
                      />
                      {internalKbProgress && internalKbProgress.status !== 'idle' && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {internalKbProgress.elapsedSeconds}s elapsed
                        </Typography>
                      )}
                    </Box>

                    {/* Description */}
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.5, mb: 1.5 }}>
                      {internalKbProgress?.status === 'complete'
                        ? `Found ${internalKbProgress.referencesCollected} internal document${internalKbProgress.referencesCollected !== 1 ? 's' : ''}. Results merged into report.`
                        : internalKbProgress?.status === 'error'
                        ? 'Search timed out. Report will complete without internal knowledge — results still available via external research.'
                        : 'Searching Northstar Integrators case studies, proposals, and past engagements in the background. Does not block the main pipeline.'}
                    </Typography>

                    {/* Running animation */}
                    {internalKbProgress?.status === 'streaming' && (
                      <LinearProgress
                        sx={{
                          borderRadius: 4,
                          height: 3,
                          bgcolor: 'rgba(124,58,237,0.12)',
                          '& .MuiLinearProgress-bar': { bgcolor: '#7c3aed' },
                        }}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Explanation note */}
                <Box sx={{ px: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.6 }}>
                    Background workers run independently and merge results into the report when complete. The main pipeline never waits for them.
                  </Typography>
                </Box>
              </Box>

              {/* Live Logs */}
              <Card sx={{ flex: '1 1 300px', minHeight: 400 }}>
                <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                    Live Logs
                    <Chip
                      label={logs.length}
                      size="small"
                      sx={{
                        ml: 2,
                        backgroundColor: '#f1f5f9',
                        color: 'text.secondary',
                        fontWeight: 600,
                      }}
                    />
                  </Typography>
                  <Box
                    sx={{
                      flexGrow: 1,
                      maxHeight: 320,
                      overflowY: 'auto',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 2,
                      backgroundColor: 'background.default',
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      '&::-webkit-scrollbar': {
                        width: '6px',
                      },
                      '&::-webkit-scrollbar-track': {
                        backgroundColor: '#f1f5f9',
                        borderRadius: '3px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#cbd5e1',
                        borderRadius: '3px',
                        '&:hover': {
                          backgroundColor: '#94a3b8',
                        },
                      },
                    }}
                  >
                    {logs.length === 0 ? (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontStyle: 'italic',
                          textAlign: 'center',
                          py: 4,
                        }}
                      >
                        Waiting for process logs...
                      </Typography>
                    ) : (
                      logs.map((log, index) => (
                        <Typography
                          key={index}
                          variant="caption"
                          sx={{
                            display: 'block',
                            mb: 0.5,
                            color: log.includes('completed') || log.includes('successfully')
                              ? '#059669'
                              : log.includes('started') || log.includes('Starting')
                              ? '#2563eb'
                              : log.includes('failed') || log.includes('Error')
                              ? '#ef4444'
                              : log.includes('error') || log.includes('retrying')
                              ? '#f59e0b'
                              : '#475569',
                            fontSize: '0.75rem',
                            lineHeight: 1.4,
                            fontFamily: 'inherit',
                          }}
                        >
                          {log}
                        </Typography>
                      ))
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Fade>
      )}

      {/* Company Research Results Display */}
      {appState === 'completed' && salesData && (
        <Fade in={true} timeout={800}>
          <Box>
            <Paper
              elevation={0}
              sx={{
                p: 0,
                mb: 4,
                bgcolor: 'background.paper',
                borderRadius: 3,
                overflow: 'hidden',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  p: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 3,
                }}
              >
                {/* Left section - Company info and score */}
                <Box sx={{ flex: 1, minWidth: '300px' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          background: 'rgba(5, 150, 105, 0.1)',
                          backdropFilter: 'blur(4px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CheckCircle sx={{ fontSize: 28, color: 'success.main' }} />
                      </Box>
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'success.main',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Research Complete
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                          {salesData.companyName}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Deal Health Score - Compact */}
                    {salesData.dealHealthSignals && (
                      <DealHealthScoreCard
                        companyName={salesData.companyName}
                        signals={salesData.dealHealthSignals}
                        compact
                      />
                    )}
                  </Stack>
                </Box>

                {/* Right section - Action buttons */}
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Button
                    variant="contained"
                    startIcon={<Download />}
                    disabled={!salesData.aiQuestionnaire}
                    sx={{
                      backgroundColor: '#2563eb',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      px: 3,
                      py: 1.5,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '0.95rem',
                      boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: '#1d4ed8',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
                      },
                      '&:disabled': {
                        backgroundColor: 'rgba(37, 99, 235, 0.3)',
                        color: '#FFFFFF',
                      },
                    }}
                    onClick={handleDownloadQuestionnaire}
                  >
                    Download Questionnaire
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    sx={{
                      color: 'text.secondary',
                      borderColor: '#cbd5e1',
                      fontWeight: 600,
                      px: 3,
                      py: 1.5,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '0.95rem',
                      backgroundColor: 'transparent',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: 'background.default',
                        borderColor: '#94a3b8',
                        transform: 'translateY(-1px)',
                      },
                    }}
                    onClick={() => {
                      setAppState('search');
                      setCompanyName('');
                      setSalesData(null);
                      setLogs([]);
                      setActiveTab(0);
                      setLinkedMeetingId(null);
                    }}
                  >
                    Research Another Company
                  </Button>
                </Box>
              </Box>
            </Paper>

            {/* Tabbed Results Interface */}
            <Box sx={{ width: '100%' }}>
              <div ref={resultsTopRef} />
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
              sx={{
                  mb: 4,
                  borderBottom: 1, borderColor: 'divider',
                  '& .MuiTab-root': {
                    minWidth: 120,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'text.secondary',
                    '&.Mui-selected': {
                      color: 'text.primary',
                    },
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#2563eb',
                    height: 3,
                    borderRadius: '3px 3px 0 0',
                  },
                }}
              >
                <Tab icon={<Assessment sx={{ fontSize: 20 }} />} iconPosition="start" label="Overview" />
                <Tab icon={<Group sx={{ fontSize: 20 }} />} iconPosition="start" label="Attendees" />
                <Tab icon={<Description sx={{ fontSize: 20 }} />} iconPosition="start" label={
                  (() => {
                    const siCount = (salesData.internalKbSimilarEngagements?.length ?? 0) + ((salesData.internalKbRaw as any)?.relevantArtifacts?.length ?? 0);
                    return siCount > 0 ? `Sales Intelligence (${siCount})` : 'Sales Intelligence';
                  })()
                } />
                <Tab icon={<Quiz sx={{ fontSize: 20 }} />} iconPosition="start" label="Questionnaire" />
              </Tabs>

              {/* Tab Content */}
              <Fade in={true} key={activeTab} timeout={400}>
                <Box sx={{ overflow: 'visible' }}>
                  {/* Overview Tab */}
                  {activeTab === 0 && (
                    <Stack spacing={3}>
                      {/* Quick Stats Row - Company Intelligence Cards */}
                      {salesData.companyIntelligence && (
                        <CompanyIntelligenceGrid
                          companyName={salesData.companyName}
                          intelligence={salesData.companyIntelligence}
                        />
                      )}

                      {/* Action Items and Deal Health Side by Side */}
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                        {/* Action Items Panel */}
                        {salesData.suggestedActions && salesData.suggestedActions.length > 0 && (
                          <Box sx={{ flex: 1 }}>
                            <ActionItemsPanel
                              actionItems={salesData.suggestedActions}
                              companyName={salesData.companyName}
                            />
                          </Box>
                        )}

                        {/* Deal Health Score - Full Version */}
                        {salesData.dealHealthSignals && (
                          <Box sx={{ flex: 1 }}>
                            <DealHealthScoreCard
                              companyName={salesData.companyName}
                              signals={salesData.dealHealthSignals}
                            />
                          </Box>
                        )}
                      </Stack>

                      {/* Executive Summary */}
                      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                          Executive Summary
                        </Typography>
                        <Box
                          sx={{
                            ...markdownBaseSx,
                            '& p': { m: 0, lineHeight: 1.35 },
                            '& ul, & ol': { mt: 0.5, mb: 0.5, pl: 2.25 },
                            '& li': { mb: 0.25, lineHeight: 1.35 },
                            '& li > p': { display: 'inline' },
                            '& h1, & h2, & h3, & h4, & h5, & h6': { my: 0.75, lineHeight: 1.25 },
                          }}
                        >
                          <ReactMarkdown components={markdownComponents}>
                            {typeof salesData.executiveSummary === 'string' ? salesData.executiveSummary : ''}
                          </ReactMarkdown>
                        </Box>
                      </Paper>
                    </Stack>
                  )}

                  {/* External Attendees Tab - Enhanced with Stakeholder Map */}
                  {activeTab === 1 && (
                    <Stack spacing={3}>
                      {/* Stakeholder Map - New Visual Component */}
                      {salesData.stakeholderInsights && salesData.stakeholderInsights.length > 0 && (
                        <StakeholderMap
                          stakeholders={salesData.stakeholderInsights}
                          companyName={salesData.companyName}
                        />
                      )}

                      {/* Legacy Attendee Research - Fallback */}
                      {(!salesData.stakeholderInsights || salesData.stakeholderInsights.length === 0) && (
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                            External Attendee Research
                          </Typography>

                          {(() => {
                            const data = salesData.externalAttendeeResearch;
                            if (typeof data === 'string') {
                              return (
                                <Box
                                  sx={{
                                    ...markdownBaseSx,
                                    '& p': { m: 0, lineHeight: 1.35 },
                                    '& ul, & ol': { mt: 0.5, mb: 0.5, pl: 2.25 },
                                    '& li': { mb: 0.25, lineHeight: 1.35 },
                                    '& li > p': { display: 'inline' },
                                    '& h1, & h2, & h3, & h4, & h5, & h6': { my: 0.75, lineHeight: 1.25 },
                                  }}
                                >
                                  <ReactMarkdown components={markdownComponents}>{data}</ReactMarkdown>
                                </Box>
                              );
                            }

                            const list = Array.isArray(data) ? data : [];
                            if (list.length === 0) {
                              return (
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                  No external attendee research available.
                                </Typography>
                              );
                            }

                            const emailByName = new Map(
                              (attendees || [])
                                .filter((a: any) => a?.name)
                                .map((a: any) => [String(a.name).trim().toLowerCase(), a.email])
                            );

                            return (
                              <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto', mt: 1.5 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Name</TableCell>
                                      <TableCell>Email</TableCell>
                                      <TableCell>Company</TableCell>
                                      <TableCell>Research</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {list.map((att: any, idx: number) => {
                                      if (typeof att === 'string') {
                                        return (
                                          <TableRow key={`attendee-${idx}`}>
                                            <TableCell colSpan={4}>
                                              <Box
                                                sx={{
                                                  ...markdownBaseSx,
                                                  '& p': { m: 0, lineHeight: 1.35 },
                                                  '& ul, & ol': { mt: 0.5, mb: 0.5, pl: 2.25 },
                                                  '& li': { mb: 0.25, lineHeight: 1.35 },
                                                  '& li > p': { display: 'inline' },
                                                  '& h1, & h2, & h3, & h4, & h5, & h6': { my: 0.75, lineHeight: 1.25 },
                                                }}
                                              >
                                                <ReactMarkdown components={markdownComponents}>{att}</ReactMarkdown>
                                              </Box>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      }

                                      const name = att?.name || 'Attendee';
                                      const email =
                                        att?.email ||
                                        emailByName.get(String(name).trim().toLowerCase()) ||
                                        '—';
                                      const company = att?.company || '—';
                                      const researchText = extractResearchText(att?.research || att?.summary || '');

                                      return (
                                        <TableRow key={`${name}-${idx}`}>
                                          <TableCell>{name}</TableCell>
                                          <TableCell>{email}</TableCell>
                                          <TableCell>{company}</TableCell>
                                          <TableCell
                                            sx={{
                                              '& p': { m: 0, lineHeight: 1.35 },
                                              '& ul, & ol': { mt: 0.5, mb: 0.5, pl: 2.25 },
                                              '& li': { mb: 0.25, lineHeight: 1.35 },
                                              '& li > p': { display: 'inline' },
                                              '& h1, & h2, & h3, & h4, & h5, & h6': { my: 0.75, lineHeight: 1.25 },
                                            }}
                                          >
                                            {researchText ? (
                                              <ReactMarkdown components={markdownComponents}>{researchText}</ReactMarkdown>
                                            ) : (
                                              '—'
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </Paper>
                            );
                          })()}
                        </Paper>
                      )}
                    </Stack>
                  )}

                  {/* InternalKnowledge Internal Knowledge Tab */}
                  {activeTab === 2 && (
                    <Box>
                      {(() => {
                        // Extract InternalKnowledge data from various possible locations
                        const raw = salesData.internalKbRaw || {};
                        const pastEngagements =
                          raw.pastEngagements ||
                          raw.past_engagements ||
                          raw.past_engagement ||
                          raw.pastEngagementsText ||
                          raw.past_engagements_text ||
                          salesData.internalKbAiInsights ||
                          '';

                        const similarEngagementsSource =
                          (salesData.internalKbSimilarEngagements && salesData.internalKbSimilarEngagements.length > 0
                            ? salesData.internalKbSimilarEngagements
                            : raw.similarEngagements ||
                              raw.similar_engagements ||
                              raw.similarEngagement ||
                              raw.similar_engagement ||
                              raw.internalKbPreCall?.similarEngagements ||
                              raw.internalKbPreCall?.similar_engagements ||
                              raw.internal_kb_pre_call?.similarEngagements ||
                              raw.internal_kb_pre_call?.similar_engagements) || [];

                        const similarEngagements = Array.isArray(similarEngagementsSource)
                          ? similarEngagementsSource.map((item: any) => ({
                              title: item.title || item.name || 'Engagement',
                              url: item.url || item.link,
                              why_relevant: item.why_relevant || item.whyRelevant || '',
                              client: item.client,
                              industry: item.industry,
                              services: item.services,
                              outcome: item.outcome,
                            }))
                          : [];

                        const relevantArtifacts = (
                          raw.relevantArtifacts ||
                          raw.relevant_artifacts ||
                          raw.relevant_docs ||
                          []
                        ).map((artifact: any) => ({
                          title: artifact.title || artifact.name || 'Document',
                          url: artifact.url || artifact.link,
                          why_relevant: artifact.why_relevant || artifact.whyRelevant,
                          type: artifact.type || artifact.documentType || 'document',
                          excerpt: artifact.excerpt || artifact.content,
                        }));

                        const unknowns = Array.isArray(raw.unknowns)
                          ? raw.unknowns
                          : Array.isArray(raw.unknown)
                          ? raw.unknown
                          : [];

                        const rawSummary = raw.rawSummary || raw.raw_summary || raw.summary || '';

                        const hasData = !!pastEngagements?.trim() || similarEngagements.length > 0 || relevantArtifacts.length > 0;
                        const internalKbStatus = (salesData as any).internalKbStatus;

                        if (!hasData && internalKbStatus === 'pending') {
                          return (
                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                              Sales Intelligence search is still running in the background. Refresh in a moment to see results.
                            </Alert>
                          );
                        }

                        return (
                          <InternalKbInsightsPanel
                            companyName={salesData.companyName}
                            data={{
                              pastEngagements,
                              similarEngagements,
                              relevantArtifacts,
                              unknowns,
                              rawSummary,
                            }}
                            showRawSummary={true}
                          />
                        );
                      })()}
                    </Box>
                  )}

                  {/* Meeting Questionnaire Tab */}
                  {activeTab === 3 && salesData && (
                    <Box>
                      <AIQuestionnaire
                        companyName={salesData.companyName}
                        researchSummary={salesData.executiveSummary || ''}
                        keyInsights={salesData.keyInsights || []}
                        attendeeInfo={attendees}
                        enterpriseRecommendations={salesData.enterpriseRecommendations || []}
                        recommendedProducts={salesData.recommendedProducts || []}
                        preGeneratedQuestions={salesData.aiQuestionnaire}
                      />
                    </Box>
                  )}
                </Box>
              </Fade>
              
              {/* Feedback Widget */}
              <Box sx={{ mt: 4, px: 2, pb: 2 }}>
                <FeedbackWidget 
                  category="account_research" 
                  referenceId={currentSessionId || undefined} 
                  metadata={{ companyName: salesData.companyName }} 
                />
              </Box>
            </Box>
          </Box>
        </Fade>
      )}
            </>
          )}

          {pageTab === 1 && (
            <PastAnalyses />
          )}
        </Box>
      </Paper>
      </Box>
      </Fade>
    </Container>
  );
};

export default AnalysisPage;
