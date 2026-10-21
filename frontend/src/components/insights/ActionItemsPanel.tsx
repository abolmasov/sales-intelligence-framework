import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Checkbox,
  IconButton,
  Button,
  Chip,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Email,
  Event,
  ExpandMore,
  ExpandLess,
  ContentCopy,
  Flag,
} from '@mui/icons-material';

export interface ActionItem {
  id: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  dueWithin: string;
  category?: 'follow-up' | 'meeting' | 'research' | 'internal' | 'other';
}

interface ActionItemsPanelProps {
  actionItems: ActionItem[];
  companyName: string;
  onGenerateEmail?: () => void;
  onScheduleMeeting?: () => void;
}

const priorityConfig = {
  high: { color: 'error.main', bg: 'rgba(220, 38, 38, 0.1)', label: 'High' },
  medium: { color: 'warning.main', bg: 'rgba(217, 119, 6, 0.1)', label: 'Medium' },
  low: { color: 'text.disabled', bg: 'rgba(115, 115, 115, 0.1)', label: 'Low' },
};

const ActionItemsPanel: React.FC<ActionItemsPanelProps> = ({
  actionItems,
  companyName,
  onGenerateEmail,
  onScheduleMeeting,
}) => {
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleComplete = (id: string) => {
    const newCompleted = new Set(completedItems);
    if (newCompleted.has(id)) {
      newCompleted.delete(id);
    } else {
      newCompleted.add(id);
    }
    setCompletedItems(newCompleted);
  };

  const toggleExpand = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const sortedItems = [...actionItems].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const completedCount = completedItems.size;
  const totalCount = actionItems.length;

  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 1.5,
        borderColor: 'divider',
        background: '#FFFFFF',
        boxShadow: 'none',
      }}
    >
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography
              variant="h6"
              sx={{
                color: 'text.primary',
                fontWeight: 600,
              }}
            >
              Action Items
            </Typography>
            <Typography variant="body2" color="#737373">
              {completedCount} of {totalCount} completed
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {onGenerateEmail && (
              <Tooltip title="Draft Follow-up Email">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Email />}
                  onClick={onGenerateEmail}
                  sx={{
                    borderColor: 'divider',
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: '#a3a3a3',
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  Draft Email
                </Button>
              </Tooltip>
            )}
            {onScheduleMeeting && (
              <Tooltip title="Schedule Follow-up Meeting">
                <IconButton
                  size="small"
                  onClick={onScheduleMeeting}
                  sx={{ color: 'text.secondary' }}
                >
                  <Event />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* Progress Bar */}
        <Box
          sx={{
            height: 4,
            borderRadius: 2,
            bgcolor: 'action.selected',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${(completedCount / totalCount) * 100}%`,
              bgcolor: 'success.main',
              transition: 'width 0.15s ease',
            }}
          />
        </Box>

        {/* Action Items List */}
        <Stack spacing={1}>
          {sortedItems.map((item) => {
            const isCompleted = completedItems.has(item.id);
            const isExpanded = expandedItem === item.id;
            const config = priorityConfig[item.priority];

            return (
              <Paper
                key={item.id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  borderColor: isCompleted ? 'rgba(5, 150, 105, 0.3)' : '#e5e5e5',
                  bgcolor: isCompleted ? 'rgba(5, 150, 105, 0.05)' : '#fafafa',
                  transition: 'border-color 0.15s',
                  opacity: isCompleted ? 0.7 : 1,
                }}
              >
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  {/* Checkbox */}
                  <Checkbox
                    checked={isCompleted}
                    onChange={() => toggleComplete(item.id)}
                    icon={<RadioButtonUnchecked />}
                    checkedIcon={<CheckCircle />}
                    sx={{
                      p: 0,
                      color: '#d4d4d4',
                      '&.Mui-checked': {
                        color: 'success.main',
                      },
                    }}
                  />

                  {/* Content */}
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          flex: 1,
                          color: isCompleted ? '#737373' : '#171717',
                          fontWeight: 500,
                          textDecoration: isCompleted ? 'line-through' : 'none',
                        }}
                      >
                        {item.action}
                      </Typography>
                      <Chip
                        size="small"
                        icon={<Flag sx={{ fontSize: '0.75rem !important' }} />}
                        label={config.label}
                        sx={{
                          height: 20,
                          bgcolor: config.bg,
                          color: config.color,
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          '& .MuiChip-icon': {
                            color: config.color,
                          },
                        }}
                      />
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" color="text.secondary">
                        Due: {item.dueWithin}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => toggleExpand(item.id)}
                        sx={{ p: 0.25 }}
                      >
                        {isExpanded ? (
                          <ExpandLess fontSize="small" />
                        ) : (
                          <ExpandMore fontSize="small" />
                        )}
                      </IconButton>
                    </Stack>

                    {/* Expanded Rationale */}
                    <Collapse in={isExpanded}>
                      <Box
                        sx={{
                          mt: 1.5,
                          p: 1.5,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          borderColor: 'divider',
                        }}
                      >
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                              WHY THIS MATTERS
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                              {item.rationale}
                            </Typography>
                          </Box>
                          <Tooltip title={copiedId === item.id ? 'Copied!' : 'Copy action'}>
                            <IconButton
                              size="small"
                              onClick={() => handleCopy(item.action, item.id)}
                              sx={{ color: copiedId === item.id ? '#059669' : '#737373' }}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    </Collapse>
                  </Box>
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        {/* Empty State */}
        {actionItems.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              No action items generated yet.
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default ActionItemsPanel;
