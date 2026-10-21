import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from '../utils/rechartsShim';
import { Box, Typography, Paper, Chip } from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  People,
  Assessment,
  ShowChart,
} from '@mui/icons-material';

interface FinancialMetrics {
  revenue?: { value: string; currency: string; year: string };
  revenueGrowth?: { value: number; period: string };
  quarterlyRevenue?: { value: string; quarter: string };
  netIncome?: { value: string; year: string };
  profitMargin?: { value: number; trend: string };
  marketCap?: { value: string; asOf: string };
  employees?: { count: number; trend: string };
  keyTrends?: string[];
}

interface FinancialChartsProps {
  financialData: string;
  financialMetrics?: FinancialMetrics;
}

const FinancialCharts: React.FC<FinancialChartsProps> = ({ financialData, financialMetrics }) => {
  // Parse value strings like "50.3B", "8.1B", "13.2M" to numeric values
  const parseValue = (valueStr: string): number => {
    if (!valueStr || valueStr === 'N/A') return 0;
    const match = valueStr.match(/([0-9.]+)([BMK]?)/i);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    const suffix = match[2].toUpperCase();

    switch (suffix) {
      case 'B': return num;
      case 'M': return num / 1000;
      case 'K': return num / 1000000;
      default: return num;
    }
  };

  // Create visualizations from actual metrics
  const revenue = financialMetrics?.revenue ? parseValue(financialMetrics.revenue.value) : 0;
  const netIncome = financialMetrics?.netIncome ? parseValue(financialMetrics.netIncome.value) : 0;
  const quarterlyRevenue = financialMetrics?.quarterlyRevenue ? parseValue(financialMetrics.quarterlyRevenue.value) : 0;
  const growthRate = typeof financialMetrics?.revenueGrowth?.value === 'number' ? financialMetrics.revenueGrowth.value : 0;
  const profitMargin = typeof financialMetrics?.profitMargin?.value === 'number' ? financialMetrics.profitMargin.value : 0;

  // Financial health radar chart data
  const healthMetrics = [
    { metric: 'Revenue', value: Math.min(revenue / 100 * 100, 100) },
    { metric: 'Growth', value: Math.min(Math.abs(growthRate) * 5, 100) },
    { metric: 'Profitability', value: Math.min(profitMargin * 5, 100) },
    { metric: 'Market Position', value: financialMetrics?.marketCap ? 85 : 60 },
    { metric: 'Workforce', value: financialMetrics?.employees?.count ? Math.min((financialMetrics.employees.count / 10000) * 10, 100) : 50 },
  ];

  // Quarterly performance (estimated from annual data)
  const quarterlyData = [
    { quarter: 'Q1', revenue: revenue * 0.23, income: netIncome * 0.22 },
    { quarter: 'Q2', revenue: revenue * 0.24, income: netIncome * 0.24 },
    { quarter: 'Q3', revenue: revenue * 0.25, income: netIncome * 0.26 },
    { quarter: 'Q4', revenue: revenue * 0.28, income: netIncome * 0.28 },
  ];

  // Always show charts - if no real data, the fallback will provide reasonable visualizations
  const hasMetrics = true;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Key Metrics Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', top: 10, right: 10, opacity: 0.2 }}>
              <AttachMoney sx={{ fontSize: 80, color: '#fff' }} />
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1, fontWeight: 500 }}>
              Annual Revenue
            </Typography>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>
              {financialMetrics?.revenue?.value || 'N/A'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {financialMetrics?.revenue?.currency} • {financialMetrics?.revenue?.year}
            </Typography>
          </Paper>
        <Paper
            elevation={0}
            sx={{
              p: 2.5,
              background: growthRate >= 0
                ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', top: 10, right: 10, opacity: 0.2 }}>
              {growthRate >= 0 ? <TrendingUp sx={{ fontSize: 80, color: '#fff' }} /> : <TrendingDown sx={{ fontSize: 80, color: '#fff' }} />}
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1, fontWeight: 500 }}>
              Revenue Growth
            </Typography>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>
              {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {financialMetrics?.revenueGrowth?.period || 'YoY'}
            </Typography>
          </Paper>
        <Paper
            elevation={0}
            sx={{
              p: 2.5,
              background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', top: 10, right: 10, opacity: 0.2 }}>
              <ShowChart sx={{ fontSize: 80, color: '#fff' }} />
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1, fontWeight: 500 }}>
              Profit Margin
            </Typography>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>
              {profitMargin.toFixed(1)}%
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {financialMetrics?.profitMargin?.trend || 'Trend: Stable'}
            </Typography>
          </Paper>
        <Paper
            elevation={0}
            sx={{
              p: 2.5,
              background: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', top: 10, right: 10, opacity: 0.2 }}>
              <People sx={{ fontSize: 80, color: '#fff' }} />
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1, fontWeight: 500 }}>
              Employees
            </Typography>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>
              {financialMetrics?.employees?.count ? (financialMetrics.employees.count / 1000).toFixed(0) + 'K' : 'N/A'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {financialMetrics?.employees?.trend || 'Workforce'}
            </Typography>
          </Paper>
      </Box>

      {/* Charts Row */}
      {hasMetrics && (
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Quarterly Performance */}
          <Box sx={{ flex: '1 1 500px', minWidth: 0 }}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: 2,
                border: '1px solid #334155',
              }}
            >
              <Typography
                variant="h6"
                gutterBottom
                sx={{ color: '#e2e8f0', mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Assessment sx={{ color: 'secondary.main' }} />
                Quarterly Performance Estimate
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={quarterlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="quarter" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                    }}
                  />
                  <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                  <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (B)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="income" fill="#10b981" name="Net Income (B)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Box>

          {/* Financial Health Radar */}
          <Box sx={{ flex: '1 1 500px', minWidth: 0 }}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: 2,
                border: '1px solid #334155',
              }}
            >
              <Typography
                variant="h6"
                gutterBottom
                sx={{ color: '#e2e8f0', mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <TrendingUp sx={{ color: 'success.main' }} />
                Financial Health Score
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={healthMetrics}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="metric" stroke="#94a3b8" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#94a3b8" />
                  <Radar
                    name="Performance"
                    dataKey="value"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.6}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Paper>
          </Box>
        </Box>
      )}

      {/* Key Financial Trends */}
      {financialMetrics?.keyTrends && financialMetrics.keyTrends.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            borderRadius: 2,
            border: '1px solid #334155',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{ color: '#e2e8f0', mb: 2, fontWeight: 600 }}
          >
            Key Financial Trends
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {financialMetrics.keyTrends.map((trend, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  p: 2,
                  background: 'rgba(59, 130, 246, 0.05)',
                  borderRadius: 1,
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <Chip
                  label={`#${index + 1}`}
                  size="small"
                  sx={{
                    bgcolor: 'secondary.main',
                    color: '#fff',
                    fontWeight: 600,
                    minWidth: 40,
                  }}
                />
                <Typography variant="body2" sx={{ color: '#cbd5e1', flex: 1, lineHeight: 1.6 }}>
                  {trend}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* Additional Metrics */}
      {financialMetrics?.marketCap && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: 2,
              border: '1px solid #334155',
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.disabled', mb: 1 }}>
              Market Capitalization
            </Typography>
            <Typography variant="h3" sx={{ color: 'secondary.main', fontWeight: 700 }}>
              ${financialMetrics.marketCap.value}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              As of {financialMetrics.marketCap.asOf}
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: 2,
              border: '1px solid #334155',
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.disabled', mb: 1 }}>
              Net Income
            </Typography>
            <Typography variant="h3" sx={{ color: 'success.main', fontWeight: 700 }}>
              ${financialMetrics.netIncome?.value || 'N/A'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {financialMetrics.netIncome?.year}
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default FinancialCharts;
