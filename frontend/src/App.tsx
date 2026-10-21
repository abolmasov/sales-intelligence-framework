import React, { useEffect, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import { createAppTheme } from './theme/professionalTheme';
import './styles/animations.css';
import AppShellProvider from './context/AppShellProvider';
import { UserTimeZoneProvider } from './context/UserTimeZoneContext';
import { useAppStore } from './store/appStore';

// Global accessibility components
import CommandPalette from './components/CommandPalette';
import AIChatAssistant from './components/AIChatAssistant';
import SmartContextSidebar from './components/SmartContextSidebar';
import BackgroundJobsBadge from './components/BackgroundJobsBadge';

// Page imports
// import AboutPlatform from './components/AboutPlatform';
import AccountsPage from './pages/AccountsPage';
import AnalysisPage from './pages/AnalysisPage';
import PostCallAnalysisPage from './pages/PostCallAnalysisPage';
import DealsPage from './pages/DealsPage';
import DealDetailPage from './pages/DealDetailPage';
import SettingsPage from './pages/SettingsPage';
import HelpSettingsPage from './pages/HelpSettingsPage';
// import LogDashboard from './pages/LogDashboard';
// import RAGPage from './pages/RAGPage';
// import CaseStudiesPage from './components/CaseStudiesPage';
// import KnowledgeGraphsView from './components/KnowledgeGraphsView';
import SalesMeetingsCalendar from './components/SalesMeetingsCalendar';
import RFPSOWGenerator from './pages/RFPSOWGenerator';
import PPTGenerator from './pages/PptGenerator';
import MeetingDetailPage from './pages/MeetingDetailPage';
import AtlassianAssessmentListPage from './pages/AtlassianAssessmentListPage';
import AtlassianAssessmentDetailPage from './pages/AtlassianAssessmentDetailPage';
import MetricsPage from './pages/MetricsPage';
import ProposalEvaluationPage from './pages/ProposalEvaluationPage';
import TranscriptAnalysisPage from './pages/TranscriptAnalysisPage';
import WorkspacesPage from './pages/WorkspacesPage';
import DiscoveryPage from './pages/DiscoveryPage';
import AgentHubPage from './pages/AgentHubPage';
import DashboardPage from './pages/DashboardPage';

const App: React.FC = () => {
  const themeMode = useAppStore((s) => s.theme);
  const muiTheme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  // Global keyboard shortcut for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Dispatch custom event for CommandPalette to listen to
        window.dispatchEvent(new CustomEvent('open-command-palette'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AppShellProvider>
        <UserTimeZoneProvider>
          {/* Global Components */}
          <CommandPalette />
          <AIChatAssistant />
          <SmartContextSidebar />
          <BackgroundJobsBadge />

          <Layout>
            <Routes>
            <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:accountId" element={<AccountsPage />} />
          <Route path="/analysis/postcall" element={<PostCallAnalysisPage />} />
          <Route path="/analysis/transcript/:analysisId" element={<TranscriptAnalysisPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/calendar" element={<SalesMeetingsCalendar />} />
          <Route path="/calendar/meetings/:meetingId" element={<MeetingDetailPage />} />
          <Route path="/history" element={<Navigate to="/analysis" replace />} />
          {/* <Route path="/knowledge-graphs" element={<KnowledgeGraphsView />} /> */}
          {/* <Route path="/rag" element={<RAGPage />} /> */}
          {/* <Route path="/case-studies" element={<CaseStudiesPage />} /> */}
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/:dealId" element={<DealDetailPage />} />
          <Route path="/rfp-sow-generator" element={<RFPSOWGenerator />} />
          <Route path="/ppt-generator" element={<PPTGenerator />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspacesPage />} />
          <Route path="/atlassian-assessment" element={<AtlassianAssessmentListPage />} />
          <Route path="/atlassian-assessment/:assessmentId" element={<AtlassianAssessmentDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpSettingsPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/proposal-evaluation" element={<ProposalEvaluationPage />} />
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/agents" element={<AgentHubPage />} />
            {/* <Route path="/logs" element={<LogDashboard />} /> */}

          </Routes>
          </Layout>
        </UserTimeZoneProvider>
      </AppShellProvider>
    </ThemeProvider>
  );
};

export default App;
