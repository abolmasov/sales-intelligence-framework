/**
 * AgentCardWidget
 * Card showing an available agent with optional input form and start button
 */

import React, { useState } from 'react';
import { Avatar, Box, Button, Stack, Typography } from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import { AgentCardWidgetData } from '../../../types/aiChat';
import InlineFormWidget from './InlineFormWidget';

interface AgentCardWidgetProps {
  data: AgentCardWidgetData;
  onStart: (agentId: string, input?: Record<string, any>) => void;
}

const AgentCardWidget: React.FC<AgentCardWidgetProps> = ({ data, onStart }) => {
  const { agentId, agentName, description, icon, color, inputRequired } = data;
  const [formValues, setFormValues] = useState<Record<string, any> | null>(null);

  const handleFormSubmit = (_formId: string, values: Record<string, any>) => {
    setFormValues(values);
  };

  const handleStart = () => {
    onStart(agentId, formValues ?? undefined);
  };

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
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: color,
            fontSize: '1rem',
          }}
        >
          {icon}
        </Avatar>
        <Box>
          <Typography variant="body2" fontWeight={600} color="#171717">
            {agentName}
          </Typography>
          <Typography variant="caption" color="#737373">
            {description}
          </Typography>
        </Box>
      </Stack>

      {inputRequired && (
        <InlineFormWidget
          data={inputRequired}
          onSubmit={handleFormSubmit}
        />
      )}

      <Button
        size="small"
        variant="contained"
        startIcon={<PlayArrow sx={{ fontSize: 16 }} />}
        onClick={handleStart}
        sx={{
          mt: 1,
          textTransform: 'none',
          bgcolor: 'text.primary',
          fontSize: '0.8125rem',
          boxShadow: 'none',
          '&:hover': { bgcolor: '#262626', boxShadow: 'none' },
        }}
      >
        Start Agent
      </Button>
    </Box>
  );
};

export default AgentCardWidget;
