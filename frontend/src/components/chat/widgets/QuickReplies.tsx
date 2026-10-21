/**
 * QuickReplies Widget
 * Row of clickable suggestion chips rendered inline in chat messages
 */

import React from 'react';
import { Box, Chip } from '@mui/material';

interface QuickRepliesProps {
  replies: string[];
  onReplyClick: (reply: string) => void;
}

const QuickReplies: React.FC<QuickRepliesProps> = ({ replies, onReplyClick }) => {
  if (!replies || replies.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.75,
        mt: 1,
      }}
    >
      {replies.map((reply, idx) => (
        <Chip
          key={idx}
          label={reply}
          variant="outlined"
          size="small"
          onClick={() => onReplyClick(reply)}
          sx={{
            color: 'text.primary',
            borderColor: 'divider',
            fontSize: '0.75rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            '&:hover': {
              bgcolor: 'action.hover',
              borderColor: 'divider',
            },
          }}
        />
      ))}
    </Box>
  );
};

export default QuickReplies;
