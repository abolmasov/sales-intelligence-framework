import React from 'react';
import { Box, Typography, Paper, Stack } from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
} from '@mui/icons-material';

export interface InsightCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'success' | 'warning' | 'error' | 'info' | 'primary';
  onClick?: () => void;
}

const colorMap = {
  success: { main: '#059669', bg: 'rgba(5, 150, 105, 0.1)', light: 'rgba(5, 150, 105, 0.15)' },
  warning: { main: '#d97706', bg: 'rgba(217, 119, 6, 0.1)', light: 'rgba(217, 119, 6, 0.15)' },
  error: { main: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', light: 'rgba(220, 38, 38, 0.15)' },
  info: { main: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)', light: 'rgba(2, 132, 199, 0.15)' },
  primary: { main: '#525252', bg: 'rgba(82, 82, 82, 0.1)', light: 'rgba(82, 82, 82, 0.15)' },
};

const trendIcons = {
  up: <TrendingUp fontSize="small" />,
  down: <TrendingDown fontSize="small" />,
  neutral: <TrendingFlat fontSize="small" />,
};

const trendColors = {
  up: '#059669',
  down: '#dc2626',
  neutral: '#737373',
};

const InsightCard: React.FC<InsightCardProps> = ({
  icon,
  title,
  value,
  subtitle,
  trend,
  color = 'primary',
  onClick,
}) => {
  const colors = colorMap[color];

  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2,
        borderRadius: 1.5,
        borderColor: 'divider',
        background: '#FFFFFF',
        boxShadow: 'none',
        transition: 'border-color 0.15s',
        cursor: onClick ? 'pointer' : 'default',
        minWidth: 160,
        flex: 1,
        '&:hover': onClick ? {
          borderColor: 'divider',
        } : {},
      }}
    >
      <Stack spacing={1.5}>
        {/* Icon */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            bgcolor: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.main,
          }}
        >
          {icon}
        </Box>

        {/* Title */}
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontSize: '0.7rem',
          }}
        >
          {title}
        </Typography>

        {/* Value with trend */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography
            variant="h5"
            sx={{
              color: 'text.primary',
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {value}
          </Typography>
          {trend && (
            <Box sx={{ color: trendColors[trend], display: 'flex', alignItems: 'center' }}>
              {trendIcons[trend]}
            </Box>
          )}
        </Stack>

        {/* Subtitle */}
        {subtitle && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.disabled',
              fontSize: '0.8rem',
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default InsightCard;
