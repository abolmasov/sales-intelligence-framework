import React from 'react';
import { Chip } from '@mui/material';
import { Schedule } from '@mui/icons-material';

interface ExpiryBadgeProps {
  isSaved: boolean;
  createdAt: string;
}

const EXPIRY_HOURS = 48;

const ExpiryBadge: React.FC<ExpiryBadgeProps> = ({ isSaved, createdAt }) => {
  if (isSaved) return null;

  const expiresAt = new Date(new Date(createdAt).getTime() + EXPIRY_HOURS * 60 * 60 * 1000);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000)));

  if (hoursLeft <= 0) {
    return (
      <Chip
        icon={<Schedule sx={{ fontSize: 14 }} />}
        label="Expiring soon"
        size="small"
        sx={{
          height: 22,
          fontSize: '0.65rem',
          fontWeight: 600,
          bgcolor: 'rgba(239, 68, 68, 0.12)',
          color: 'error.main',
        }}
      />
    );
  }

  const isUrgent = hoursLeft <= 6;

  return (
    <Chip
      icon={<Schedule sx={{ fontSize: 14 }} />}
      label={`Expires in ${hoursLeft}h`}
      size="small"
      sx={{
        height: 22,
        fontSize: '0.65rem',
        fontWeight: 600,
        bgcolor: isUrgent ? 'rgba(239, 68, 68, 0.12)' : 'rgba(249, 115, 22, 0.1)',
        color: isUrgent ? '#ef4444' : '#f97316',
      }}
    />
  );
};

export default ExpiryBadge;
