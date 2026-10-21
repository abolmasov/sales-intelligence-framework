/**
 * AgentProgressWidget
 * Shows agent execution status with progress bar and step info
 */

import React from 'react';
import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { AgentStatusWidget } from '../../../types/aiChat';

interface AgentProgressWidgetProps {
  status: AgentStatusWidget;
}

const STATUS_COLOR: Record<AgentStatusWidget['status'], 'default' | 'info' | 'success' | 'error'> = {
  pending: 'default',
  running: 'info',
  completed: 'success',
  error: 'error',
};

const AgentProgressWidget: React.FC<AgentProgressWidgetProps> = ({ status }) => {
  const { agentName, status: agentStatus, percentage, currentStep } = status;
  const chipColor = STATUS_COLOR[agentStatus];

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
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        {agentStatus === 'completed' && <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />}
        {agentStatus === 'error' && <ErrorIcon sx={{ fontSize: 18, color: 'error.main' }} />}
        <Typography variant="body2" fontWeight={600} color="#171717" sx={{ flex: 1 }}>
          {agentName}
        </Typography>
        <Chip
          label={agentStatus}
          size="small"
          color={chipColor}
          sx={{ height: 22, fontSize: '0.7rem', textTransform: 'capitalize' }}
        />
      </Stack>

      <LinearProgress
        variant="determinate"
        value={percentage}
        color={chipColor === 'default' ? 'inherit' : chipColor}
        sx={{
          height: 4,
          borderRadius: 2,
          bgcolor: 'action.selected',
          mb: currentStep ? 0.75 : 0,
        }}
      />

      {currentStep && (
        <Typography variant="caption" color="#737373" sx={{ mt: 0.5, display: 'block' }}>
          {currentStep}
        </Typography>
      )}
    </Box>
  );
};

export default AgentProgressWidget;
