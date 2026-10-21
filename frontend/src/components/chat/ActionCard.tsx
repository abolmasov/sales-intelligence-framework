/**
 * ActionCard Component
 * Clean, minimal action buttons for AI assistant
 */

import React from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import {
  NavigateNext,
  Add,
  Edit,
  Search,
  OpenInNew,
  PlayArrow,
  Analytics,
  Description,
  Event,
  Business,
  TrendingUp,
} from '@mui/icons-material';
import { AIAction, ActionIcon } from '../../types/aiChat';

// Icon mapping
const ICON_MAP: Record<ActionIcon, React.ElementType> = {
  NavigateNext,
  Add,
  Edit,
  Search,
  OpenInNew,
  PlayArrow,
  Analytics,
  Description,
  Event,
  Business,
  TrendingUp,
};

function getIcon(iconName?: ActionIcon): React.ElementType {
  return iconName ? ICON_MAP[iconName] || NavigateNext : NavigateNext;
}

interface ActionCardProps {
  actions: AIAction[];
  onExecute: (action: AIAction) => void;
  disabled?: boolean;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  actions,
  onExecute,
  disabled = false,
}) => {
  if (!actions || actions.length === 0) return null;

  const primaryAction = actions.find(a => a.primary);
  const secondaryActions = actions.filter(a => !a.primary);

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography
        variant="caption"
        fontWeight={500}
        color="#737373"
        sx={{ mb: 0.75, display: 'block', fontSize: '0.7rem' }}
      >
        Actions
      </Typography>

      <Stack spacing={0.75}>
        {primaryAction && (
          <ActionButton
            action={primaryAction}
            onExecute={onExecute}
            disabled={disabled}
            primary
          />
        )}

        {secondaryActions.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {secondaryActions.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                onExecute={onExecute}
                disabled={disabled}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

interface ActionButtonProps {
  action: AIAction;
  onExecute: (action: AIAction) => void;
  disabled?: boolean;
  primary?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  action,
  onExecute,
  disabled = false,
  primary = false,
}) => {
  const Icon = getIcon(action.icon);

  const handleClick = () => {
    if (!disabled) {
      onExecute(action);
    }
  };

  if (primary) {
    return (
      <Button
        fullWidth
        variant="contained"
        startIcon={<Icon sx={{ fontSize: 16 }} />}
        endIcon={<NavigateNext sx={{ fontSize: 16 }} />}
        onClick={handleClick}
        disabled={disabled}
        sx={{
          justifyContent: 'flex-start',
          textTransform: 'none',
          bgcolor: 'text.primary',
          color: 'white',
          py: 1,
          px: 1.5,
          borderRadius: 1,
          fontSize: '0.8125rem',
          fontWeight: 500,
          boxShadow: 'none',
          '& .MuiButton-endIcon': {
            ml: 'auto',
          },
          '&:hover': {
            bgcolor: '#262626',
            boxShadow: 'none',
          },
          '&.Mui-disabled': {
            bgcolor: 'action.selected',
            color: 'text.disabled',
          },
        }}
      >
        {action.label}
      </Button>
    );
  }

  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<Icon sx={{ fontSize: 14 }} />}
      onClick={handleClick}
      disabled={disabled}
      sx={{
        textTransform: 'none',
        borderColor: 'divider',
        color: 'text.secondary',
        bgcolor: 'background.paper',
        fontSize: '0.75rem',
        py: 0.5,
        px: 1,
        borderRadius: 1,
        '&:hover': {
          borderColor: 'divider',
          bgcolor: 'background.default',
        },
        '&.Mui-disabled': {
          borderColor: '#f5f5f5',
          color: '#d4d4d4',
        },
      }}
    >
      {action.label}
    </Button>
  );
};

export const ActionChips: React.FC<{
  actions: AIAction[];
  onExecute: (action: AIAction) => void;
  disabled?: boolean;
}> = ({ actions, onExecute, disabled = false }) => {
  if (!actions || actions.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
      {actions.slice(0, 3).map((action) => {
        const Icon = getIcon(action.icon);
        return (
          <Button
            key={action.id}
            size="small"
            variant="text"
            startIcon={<Icon sx={{ fontSize: 12 }} />}
            onClick={() => !disabled && onExecute(action)}
            disabled={disabled}
            sx={{
              textTransform: 'none',
              fontSize: '0.7rem',
              px: 0.75,
              py: 0.25,
              minHeight: 22,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            {action.label}
          </Button>
        );
      })}
    </Stack>
  );
};

export default ActionCard;
