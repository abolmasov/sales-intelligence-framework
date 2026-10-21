import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Divider,
  Paper,
  Chip,
  Stack,
  Box,
  CircularProgress,
  Button,
  SxProps,
  Theme,
} from '@mui/material';
import { CloudDownload } from '@mui/icons-material';

export interface RecentArtifact {
  id: string;
  type: string;
  meetingTitle: string;
  meetingId?: string | null;
  meetingDate?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  statusColor?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  updatedAt?: string | null;
  transcriptAnalysisId?: string | null;
  proposalJobId?: string | null;
  pptDownloadUrl?: string | null;
  pptFileName?: string | null;
}

interface RecentArtifactsProps {
  artifacts: RecentArtifact[];
  loading?: boolean;
  title?: string;
  emptyMessage?: string;
  cardSx?: SxProps<Theme>;
  onArtifactClick?: (artifact: RecentArtifact) => void;
  onArtifactDownload?: (artifact: RecentArtifact) => void;
  downloadingArtifactId?: string | null;
}

const defaultCardStyles: SxProps<Theme> = {
  bgcolor: '#FFFFFF',
  border: '1px solid rgba(0, 35, 72, 0.08)',
  borderRadius: 3,
  boxShadow: '0 18px 35px rgba(0, 35, 72, 0.08)',
};

const RecentArtifacts: React.FC<RecentArtifactsProps> = ({
  artifacts,
  loading = false,
  title = 'Recent Artifacts',
  emptyMessage = 'No artifacts generated yet.',
  cardSx,
  onArtifactClick,
  onArtifactDownload,
  downloadingArtifactId,
}) => {
  return (
    <Card elevation={0} sx={cardSx || defaultCardStyles}>
      <CardContent>
        <Typography variant="h6" sx={{ color: 'text.primary' }}>
          {title}
        </Typography>
        <Divider sx={{ mb: 2, borderColor: 'rgba(0, 35, 72, 0.12)' }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : artifacts.length === 0 ? (
          <Typography color="text.secondary">{emptyMessage}</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {artifacts.map((artifact) => (
              <Paper
                key={artifact.id}
                variant="outlined"
                sx={{
                  p: 2,
                  height: '100%',
                  borderRadius: 2,
                  borderColor: 'rgba(0, 35, 72, 0.12)',
                  cursor: onArtifactClick ? 'pointer' : 'default',
                  transition: 'box-shadow 0.2s ease, transform 0.15s ease',
                  '&:hover': onArtifactClick
                    ? {
                        boxShadow: '0 18px 35px rgba(0, 35, 72, 0.15)',
                        transform: 'translateY(-2px)',
                      }
                    : undefined,
                }}
                role={onArtifactClick ? 'button' : undefined}
                tabIndex={onArtifactClick ? 0 : undefined}
                onClick={onArtifactClick ? () => onArtifactClick(artifact) : undefined}
                onKeyDown={
                  onArtifactClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onArtifactClick(artifact);
                        }
                      }
                    : undefined
                }
              >
                <Stack spacing={1.2}>
                  <Chip label={artifact.type} size="small" color="primary" variant="outlined" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {artifact.meetingTitle}
                  </Typography>
                  <Chip
                    size="small"
                    label={artifact.statusLabel || artifact.status || 'Not started'}
                    color={artifact.statusColor || 'default'}
                  />
                  {artifact.updatedAt && (
                    <Typography variant="caption" color="text.secondary">
                      Updated {new Date(artifact.updatedAt).toLocaleString()}
                    </Typography>
                  )}
                  {artifact.meetingDate && (
                    <Typography variant="caption" color="text.secondary">
                      Meeting on {new Date(artifact.meetingDate).toLocaleString()}
                    </Typography>
                  )}
                  {onArtifactDownload && (
                    <Box>
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        startIcon={
                          downloadingArtifactId === artifact.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <CloudDownload fontSize="small" />
                          )
                        }
                        disabled={
                          downloadingArtifactId === artifact.id || !onArtifactDownload
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          onArtifactDownload?.(artifact);
                        }}
                      >
                        {downloadingArtifactId === artifact.id ? 'Downloading...' : 'Download'}
                      </Button>
                    </Box>
                  )}
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentArtifacts;
