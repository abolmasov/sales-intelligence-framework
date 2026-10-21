import React, { useState } from 'react';
import { IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Bookmark, BookmarkBorder } from '@mui/icons-material';
import { apiPatch } from '../utils/api';

interface SaveBookmarkButtonProps {
  modelType: 'transcriptAnalysis' | 'workspace' | 'atlassianAssessment' | 'rfpResearch' | 'proposalEvaluation' | 'discoverySession';
  id: string;
  isSaved: boolean;
  onToggle?: (newValue: boolean) => void;
  size?: 'small' | 'medium';
}

const SaveBookmarkButton: React.FC<SaveBookmarkButtonProps> = ({
  modelType,
  id,
  isSaved,
  onToggle,
  size = 'small',
}) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(isSaved);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await apiPatch(`/api/saved-items/${modelType}/${id}`, { isSaved: !saved });
      const newValue = !saved;
      setSaved(newValue);
      onToggle?.(newValue);
    } catch (err) {
      console.error('Failed to toggle save status', err);
    } finally {
      setSaving(false);
    }
  };

  if (saving) {
    return <CircularProgress size={16} sx={{ mx: 0.5 }} />;
  }

  return (
    <Tooltip title={saved ? 'Saved permanently — click to unsave' : 'Save to prevent auto-deletion'}>
      <IconButton
        size={size}
        onClick={handleToggle}
        sx={{ color: saved ? '#F59E0B' : '#94a3b8' }}
      >
        {saved ? <Bookmark /> : <BookmarkBorder />}
      </IconButton>
    </Tooltip>
  );
};

export default SaveBookmarkButton;
