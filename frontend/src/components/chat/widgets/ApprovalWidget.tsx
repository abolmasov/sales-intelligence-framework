/**
 * ApprovalWidget
 * Inline approve / reject decision card rendered in chat messages
 */

import React, { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { ApprovalWidgetData } from '../../../types/aiChat';

interface ApprovalWidgetProps {
  data: ApprovalWidgetData;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
}

const ApprovalWidget: React.FC<ApprovalWidgetProps> = ({ data, onApprove, onReject }) => {
  const { approvalId, title, summary, approveLabel = 'Approve', rejectLabel = 'Reject' } = data;
  const [submitted, setSubmitted] = useState(false);

  const handleApprove = () => {
    setSubmitted(true);
    onApprove(approvalId);
  };

  const handleReject = () => {
    setSubmitted(true);
    onReject(approvalId);
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
      <Typography variant="body2" fontWeight={600} color="#171717" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="#737373" fontSize="0.8125rem" sx={{ mb: 1.5 }}>
        {summary}
      </Typography>

      {submitted ? (
        <Stack direction="row" spacing={0.75} alignItems="center">
          <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
          <Typography variant="body2" color="#737373" fontSize="0.8125rem">
            Decision submitted
          </Typography>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            onClick={handleApprove}
            sx={{
              textTransform: 'none',
              bgcolor: 'success.main',
              fontSize: '0.8125rem',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#15803d', boxShadow: 'none' },
            }}
          >
            {approveLabel}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={handleReject}
            sx={{
              textTransform: 'none',
              borderColor: '#ef4444',
              color: 'error.main',
              fontSize: '0.8125rem',
              '&:hover': { bgcolor: 'error.light', borderColor: '#dc2626' },
            }}
          >
            {rejectLabel}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default ApprovalWidget;
