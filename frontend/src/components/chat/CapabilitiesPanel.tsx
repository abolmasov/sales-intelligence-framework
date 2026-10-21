/**
 * CapabilitiesPanel Component
 * Shows what the AI assistant can do ("What can I help you with?")
 */

import React from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  NavigateNext,
  Add,
  Search,
  Analytics,
  Description,
  TrendingUp,
  ExpandLess,
  ExpandMore,
  Lightbulb,
} from '@mui/icons-material';
import { AI_CAPABILITIES, CapabilityCategory, ActionIcon } from '../../types/aiChat';

// Icon mapping for capabilities
const CAPABILITY_ICONS: Record<string, React.ElementType> = {
  NavigateNext,
  Add,
  Search,
  Analytics,
  Description,
  TrendingUp,
};

function getCapabilityIcon(iconName: ActionIcon): React.ElementType {
  return CAPABILITY_ICONS[iconName] || Lightbulb;
}

interface CapabilitiesPanelProps {
  expanded: boolean;
  onToggle: () => void;
  onExampleClick: (example: string) => void;
}

/**
 * Expandable panel showing AI capabilities and example queries
 */
export const CapabilitiesPanel: React.FC<CapabilitiesPanelProps> = ({
  expanded,
  onToggle,
  onExampleClick,
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.default',
        borderColor: 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
      }}
    >
      {/* Header - always visible */}
      <Box
        onClick={onToggle}
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Lightbulb sx={{ fontSize: 18, color: 'text.disabled' }} />
          <Typography variant="body2" fontWeight={600} color="#171717">
            What can I help you with?
          </Typography>
        </Stack>
        <IconButton size="small" sx={{ p: 0.5 }}>
          {expanded ? (
            <ExpandLess sx={{ fontSize: 18, color: 'text.disabled' }} />
          ) : (
            <ExpandMore sx={{ fontSize: 18, color: 'text.disabled' }} />
          )}
        </IconButton>
      </Box>

      {/* Expandable content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 1.5, pt: 0 }}>
          <Stack spacing={2}>
            {AI_CAPABILITIES.map((category) => (
              <CapabilitySection
                key={category.id}
                category={category}
                onExampleClick={onExampleClick}
              />
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};

interface CapabilitySectionProps {
  category: CapabilityCategory;
  onExampleClick: (example: string) => void;
}

/**
 * Individual capability category section
 */
const CapabilitySection: React.FC<CapabilitySectionProps> = ({
  category,
  onExampleClick,
}) => {
  const Icon = getCapabilityIcon(category.icon);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Icon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="caption" fontWeight={600} color="#171717">
          {category.title}
        </Typography>
        <Typography variant="caption" color="#737373">
          – {category.description}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {category.examples.slice(0, 2).map((example, idx) => (
          <Chip
            key={idx}
            label={example}
            size="small"
            onClick={() => onExampleClick(example)}
            sx={{
              height: 24,
              fontSize: '0.7rem',
              bgcolor: 'background.paper',
              borderColor: 'divider',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover',
                borderColor: 'divider',
              },
            }}
          />
        ))}
      </Stack>
    </Box>
  );
};

/**
 * Compact version for the empty state
 */
interface QuickCapabilitiesProps {
  onExampleClick: (example: string) => void;
}

export const QuickCapabilities: React.FC<QuickCapabilitiesProps> = ({
  onExampleClick,
}) => {
  // Show one example from each category
  const quickExamples = AI_CAPABILITIES.map(cat => ({
    category: cat.title,
    example: cat.examples[0],
    icon: cat.icon,
  }));

  return (
    <Stack spacing={1}>
      {quickExamples.slice(0, 4).map((item, idx) => {
        const Icon = getCapabilityIcon(item.icon);
        return (
          <Chip
            key={idx}
            label={item.example}
            icon={<Icon sx={{ fontSize: 14, color: 'text.secondary' }} />}
            size="small"
            onClick={() => onExampleClick(item.example)}
            sx={{
              height: 'auto',
              py: 0.5,
              fontSize: '0.75rem',
              bgcolor: 'background.paper',
              borderColor: 'divider',
              cursor: 'pointer',
              '& .MuiChip-label': {
                whiteSpace: 'normal',
              },
              '&:hover': {
                bgcolor: 'action.hover',
                borderColor: 'divider',
              },
            }}
          />
        );
      })}
    </Stack>
  );
};

export default CapabilitiesPanel;
