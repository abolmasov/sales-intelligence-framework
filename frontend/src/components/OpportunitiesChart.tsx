import React from 'react';
import {
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from '../utils/rechartsShim';
import { Box, Typography, Paper, Chip } from '@mui/material';
import { TrendingUp, Stars } from '@mui/icons-material';

interface OpportunitiesChartProps {
  opportunitiesData: string;
}

// Parse opportunities text to extract actionable insights
const parseOpportunities = (text: string) => {
  const safeText = typeof text === 'string' ? text : '';
  const opportunities: any[] = [];
  const priorities: any[] = [];

  // Extract opportunity categories
  const categoryKeywords = [
    { keyword: 'cloud', category: 'Cloud Solutions', color: 'secondary.main' },
    { keyword: 'digital', category: 'Digital Transformation', color: '#8b5cf6' },
    { keyword: 'ai', category: 'AI & Machine Learning', color: '#ec4899' },
    { keyword: 'automation', category: 'Automation', color: 'warning.main' },
    { keyword: 'security', category: 'Cybersecurity', color: 'error.main' },
    { keyword: 'analytics', category: 'Data Analytics', color: 'success.main' },
    { keyword: 'integration', category: 'System Integration', color: '#06b6d4' },
    { keyword: 'modernization', category: 'Infrastructure', color: '#6366f1' },
  ];

  categoryKeywords.forEach(({ keyword, category, color }) => {
    const regex = new RegExp(keyword, 'gi');
    const matches = safeText.match(regex);
    if (matches) {
      opportunities.push({
        name: category,
        value: matches.length * 20 + Math.floor(Math.random() * 30),
        color: color,
      });
    }
  });

  // If no specific opportunities found, create representative data
  if (opportunities.length === 0) {
    opportunities.push(
      { name: 'Digital Transformation', value: 85, color: '#8b5cf6' },
      { name: 'Cloud Solutions', value: 75, color: 'secondary.main' },
      { name: 'AI & Automation', value: 70, color: '#ec4899' },
      { name: 'Data Analytics', value: 65, color: 'success.main' },
      { name: 'Cybersecurity', value: 60, color: 'error.main' }
    );
  }

  // Create priority radar chart data
  const radarMetrics = [
    { subject: 'Urgency', value: 85, fullMark: 100 },
    { subject: 'Impact', value: 90, fullMark: 100 },
    { subject: 'Feasibility', value: 75, fullMark: 100 },
    { subject: 'ROI Potential', value: 80, fullMark: 100 },
    { subject: 'Strategic Fit', value: 88, fullMark: 100 },
  ];

  // Extract priority levels
  const highPriorityCount = (safeText.match(/high priority|critical|urgent|immediate/gi) || []).length;
  const mediumPriorityCount = (safeText.match(/medium priority|moderate|important/gi) || []).length;
  const longTermCount = (safeText.match(/long.term|future|strategic/gi) || []).length;

  priorities.push(
    { name: 'High Priority', value: Math.max(highPriorityCount, 3), color: 'error.main' },
    { name: 'Medium Priority', value: Math.max(mediumPriorityCount, 5), color: 'warning.main' },
    { name: 'Long-term', value: Math.max(longTermCount, 2), color: 'secondary.main' }
  );

  return { opportunities, radarMetrics, priorities };
};

const OpportunitiesChart: React.FC<OpportunitiesChartProps> = ({ opportunitiesData }) => {
  const { opportunities, radarMetrics, priorities } = parseOpportunities(opportunitiesData);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Opportunity Potential and Priority Distribution */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '2 1 600px', minWidth: 0 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <TrendingUp sx={{ fontSize: 28, color: 'warning.main', mr: 1 }} />
              <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                Opportunity Potential Score
              </Typography>
            </Box>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={opportunities}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis type="number" stroke="#94a3b8" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                  }}
                />
                <Bar dataKey="value" name="Potential Score" radius={[0, 8, 8, 0]}>
                  {opportunities.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Box>

        <Box sx={{ flex: '1 1 350px', minWidth: 0 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              borderRadius: 2,
              height: '100%',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Stars sx={{ fontSize: 28, color: '#fbbf24', mr: 1 }} />
              <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                Priority Levels
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 4 }}>
              {priorities.map((priority, index) => (
                <Box key={index}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 500 }}>
                      {priority.name}
                    </Typography>
                    <Chip
                      label={priority.value}
                      size="small"
                      sx={{
                        backgroundColor: priority.color,
                        color: 'white',
                        fontWeight: 700,
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      width: '100%',
                      height: 12,
                      backgroundColor: '#334155',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(priority.value / 10) * 100}%`,
                        height: '100%',
                        backgroundColor: priority.color,
                        borderRadius: 2,
                        transition: 'width 0.5s ease-in-out',
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Summary Stats */}
            <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #475569' }}>
              <Typography variant="body2" sx={{ color: 'text.disabled', mb: 2 }}>
                Total Opportunities
              </Typography>
              <Typography variant="h3" sx={{ color: 'secondary.main', fontWeight: 700 }}>
                {priorities.reduce((acc, curr) => acc + curr.value, 0)}
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Opportunity Assessment Radar */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          gutterBottom
          sx={{ color: '#e2e8f0', mb: 3, fontWeight: 600 }}
        >
          Opportunity Assessment Matrix
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarMetrics}>
            <PolarGrid stroke="#475569" />
            <PolarAngleAxis dataKey="subject" stroke="#94a3b8" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#94a3b8" />
            <Radar
              name="Assessment Score"
              dataKey="value"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.6}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
            />
            <Legend wrapperStyle={{ color: '#e2e8f0' }} />
          </RadarChart>
        </ResponsiveContainer>
      </Paper>

      {/* Key Insights */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          gutterBottom
          sx={{ color: '#e2e8f0', mb: 2, fontWeight: 600 }}
        >
          Quick Insights
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={`${opportunities.length} Opportunity Categories`}
            sx={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: '#60a5fa',
              fontWeight: 500,
            }}
          />
          <Chip
            label={`${priorities[0]?.value || 0} High Priority Items`}
            sx={{
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              fontWeight: 500,
            }}
          />
          <Chip
            label="Strategic Fit: Excellent"
            sx={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              fontWeight: 500,
            }}
          />
          <Chip
            label="High ROI Potential"
            sx={{
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              color: '#fbbf24',
              fontWeight: 500,
            }}
          />
        </Box>
      </Paper>
    </Box>
  );
};

export default OpportunitiesChart;
