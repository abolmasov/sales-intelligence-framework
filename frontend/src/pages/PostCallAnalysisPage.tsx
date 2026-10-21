import React, { useEffect, useRef, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Stack,
  Paper,
  Fade,
  alpha,
  Tabs,
  Tab,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import AddIcon from '@mui/icons-material/Add';
import { useLocation } from 'react-router-dom';
import AdvancedTranscriptAnalysis from '../components/AdvancedTranscriptAnalysis';
import PastTranscriptAnalyses from '../components/PastTranscriptAnalyses';

// Modern color palette
const THEME = {
  primary: '#171717',
  accent: '#2563eb',
  purple: '#7c3aed',
  slate50: '#f8fafc',
  slate200: '#e2e8f0',
  slate500: '#64748b',
  gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1a1a2e 100%)',
};

interface PostCallPayload {
  transcript?: string;
  company?: string;
  meetingTitle?: string;
  meetingDate?: string;
  message?: string;
  meetingId?: string;
}

const PostCallAnalysisPage: React.FC = () => {
  const location = useLocation();
  const [payload, setPayload] = useState<PostCallPayload | null>(
    (location.state as any)?.postCallData || null
  );
  const [activeTab, setActiveTab] = useState(0);
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if ((location.state as any)?.postCallData) {
      setPayload((location.state as any).postCallData);
      window.history.replaceState({}, document.title, location.pathname + location.search);
    }
  }, [location]);

  const infoMessage = payload
    ? payload.message ||
      (payload.transcript
        ? `Transcript loaded from ${payload.meetingTitle || 'the selected meeting'}.`
        : undefined)
    : undefined;

  return (
    <Fade in timeout={400}>
      <Box sx={{ minHeight: '100vh', bgcolor: THEME.slate50 }}>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          {/* Header - matching pre-call analysis style */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 3,
              borderRadius: 3,
              bgcolor: THEME.primary,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background effect */}
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
                <RecordVoiceOverIcon sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                  Post-Call Analysis
                </Typography>
                <Typography variant="body1" sx={{ color: alpha('#fff', 0.85) }}>
                  Extract insights and action items from sales conversations
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Tab Navigation */}
          <Paper
            elevation={0}
            sx={{
              mb: 3,
              borderRadius: 2,
              border: `1px solid ${THEME.slate200}`,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{
                px: 2,
                borderBottom: `1px solid ${THEME.slate200}`,
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: THEME.slate500,
                  minHeight: 52,
                  '&.Mui-selected': {
                    color: THEME.primary,
                  },
                },
                '& .MuiTabs-indicator': {
                  bgcolor: THEME.accent,
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
              {activeTab === 0 && (
                <AdvancedTranscriptAnalysis
                  initialTranscript={payload?.transcript}
                  initialCompany={payload?.company}
                  initialContext={payload?.meetingTitle}
                  initialTitle={payload?.meetingTitle}
                  infoMessage={infoMessage}
                  linkedMeetingId={payload?.meetingId}
                />
              )}

              {activeTab === 1 && (
                <Box ref={historyRef}>
                  <PastTranscriptAnalyses />
                </Box>
              )}
            </Box>
          </Paper>
        </Container>
      </Box>
    </Fade>
  );
};

export default PostCallAnalysisPage;
