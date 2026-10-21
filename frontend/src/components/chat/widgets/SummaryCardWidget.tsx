/**
 * SummaryCardWidget
 * Displays a title, metric chips grid, and optional action buttons
 */

import React from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { AIAction, SummaryCardWidgetData } from '../../../types/aiChat';

interface SummaryCardWidgetProps {
  data: SummaryCardWidgetData;
  onAction?: (action: AIAction) => void;
}

const SummaryCardWidget: React.FC<SummaryCardWidgetProps> = ({ data, onAction }) => {
  const { title, metrics, actions } = data;

  return (
    <Box
      sx={{
        mt: 1,
        p: 1.5,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.default',
      }}
    >
      <Typography variant="body2" fontWeight={600} color="#171717" sx={{ mb: 1 }}>
        {title}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 0.75,
          mb: actions && actions.length > 0 ? 1.5 : 0,
        }}
      >
        {metrics.map((metric, idx) => (
          <Box
            key={idx}
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: 'background.paper',
              borderColor: 'divider',
              textAlign: 'center',
            }}
          >
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{ color: metric.color || '#171717', fontSize: '1rem' }}
            >
              {metric.value}
            </Typography>
            <Typography variant="caption" color="#737373" sx={{ fontSize: '0.65rem' }}>
              {metric.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {actions && actions.length > 0 && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {actions.map((action) => (
            <Button
              key={action.id}
              size="small"
              variant="outlined"
              onClick={() => onAction?.(action)}
              sx={{
                textTransform: 'none',
                borderColor: 'divider',
                color: 'text.secondary',
                fontSize: '0.75rem',
                '&:hover': { borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', bgcolor: 'action.hover' },
              }}
            >
              {action.label}
            </Button>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default SummaryCardWidget;
