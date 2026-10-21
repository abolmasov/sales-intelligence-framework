import React from 'react';
import { Box, Stack, Tooltip } from '@mui/material';
import {
  Article as ProposalIcon,
  Assignment as PreCallIcon,
  Description as TranscriptIcon,
  Link as LinkedIcon,
  Slideshow as PptIcon,
} from '@mui/icons-material';

type StageBadgeLegendProps = {
  size?: number;
};

const StageBadgeLegend: React.FC<StageBadgeLegendProps> = ({ size = 18 }) => {
  const iconSize = Math.max(10, Math.round(size * 0.55));

  const items: Array<{ icon: React.ReactNode; label: string; color: string }> = [
    { icon: <LinkedIcon sx={{ fontSize: iconSize }} />, label: 'Linked deal', color: 'secondary.main' },
    { icon: <PreCallIcon sx={{ fontSize: iconSize }} />, label: 'Pre-call ready', color: '#0891b2' },
    { icon: <TranscriptIcon sx={{ fontSize: iconSize }} />, label: 'Transcript analysis ready', color: 'success.main' },
    { icon: <ProposalIcon sx={{ fontSize: iconSize }} />, label: 'Proposal ready', color: '#7c3aed' },
    { icon: <PptIcon sx={{ fontSize: iconSize }} />, label: 'Presentation deck ready', color: '#ea580c' },
  ];

  return (
    <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {items.map((item) => (
        <Tooltip key={item.label} title={item.label} arrow>
          <Box
            sx={{
              width: size,
              height: size,
              borderRadius: 0.75,
              bgcolor: `${item.color}25`,
              color: item.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.icon}
          </Box>
        </Tooltip>
      ))}
    </Stack>
  );
};

export default StageBadgeLegend;

