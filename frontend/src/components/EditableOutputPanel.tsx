import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  TextField,
  Tooltip,
  Chip,
  Collapse,
  CircularProgress,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import RestoreIcon from '@mui/icons-material/Restore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import HistoryIcon from '@mui/icons-material/History';

export interface EditableOutputPanelProps {
  title: string;
  content: string;
  originalContent?: string;
  onSave: (newContent: string) => Promise<void>;
  onRevert?: () => Promise<void>;
  isEdited?: boolean;
  lastEditedAt?: string | Date;
  multiline?: boolean;
  rows?: number;
  maxRows?: number;
  disabled?: boolean;
  showCopyButton?: boolean;
  placeholder?: string;
  helperText?: string;
  variant?: 'outlined' | 'filled';
  size?: 'small' | 'medium';
}

export const EditableOutputPanel: React.FC<EditableOutputPanelProps> = ({
  title,
  content,
  originalContent,
  onSave,
  onRevert,
  isEdited = false,
  lastEditedAt,
  multiline = true,
  rows = 4,
  maxRows = 20,
  disabled = false,
  showCopyButton = true,
  placeholder = 'Enter content...',
  helperText,
  variant = 'outlined',
  size = 'medium',
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleEdit = useCallback(() => {
    setEditedContent(content);
    setIsEditMode(true);
    setError(null);
  }, [content]);

  const handleCancel = useCallback(() => {
    setEditedContent(content);
    setIsEditMode(false);
    setError(null);
  }, [content]);

  const handleSave = useCallback(async () => {
    if (editedContent === content) {
      setIsEditMode(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(editedContent);
      setIsEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [editedContent, content, onSave]);

  const handleRevert = useCallback(async () => {
    if (!onRevert || !originalContent) return;

    setIsReverting(true);
    setError(null);
    try {
      await onRevert();
      setEditedContent(originalContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert changes');
    } finally {
      setIsReverting(false);
    }
  }, [onRevert, originalContent]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [content]);

  const formatLastEdited = (date: string | Date | undefined) => {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        position: 'relative',
        borderColor: isEdited ? 'warning.main' : 'divider',
        borderWidth: isEdited ? 2 : 1,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
          {isEdited && (
            <Chip
              label="Edited"
              size="small"
              color="warning"
              variant="outlined"
              icon={<HistoryIcon sx={{ fontSize: 14 }} />}
              sx={{ height: 22, '& .MuiChip-label': { px: 1, fontSize: '0.75rem' } }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {showCopyButton && !isEditMode && (
            <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
              <IconButton size="small" onClick={handleCopy} disabled={disabled}>
                {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}

          {!isEditMode ? (
            <Tooltip title="Edit content">
              <IconButton size="small" onClick={handleEdit} disabled={disabled}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <>
              <Tooltip title="Save changes">
                <IconButton
                  size="small"
                  onClick={handleSave}
                  disabled={isSaving || editedContent === content}
                  color="primary"
                >
                  {isSaving ? <CircularProgress size={18} /> : <SaveIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel editing">
                <IconButton size="small" onClick={handleCancel} disabled={isSaving}>
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          {isEdited && onRevert && originalContent && !isEditMode && (
            <Tooltip title="Revert to original">
              <IconButton size="small" onClick={handleRevert} disabled={isReverting} color="warning">
                {isReverting ? <CircularProgress size={18} /> : <RestoreIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Last edited info */}
      {isEdited && lastEditedAt && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Last edited: {formatLastEdited(lastEditedAt)}
        </Typography>
      )}

      {/* Error alert */}
      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      </Collapse>

      {/* Content */}
      {isEditMode ? (
        <TextField
          fullWidth
          multiline={multiline}
          rows={rows}
          maxRows={maxRows}
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          placeholder={placeholder}
          variant={variant}
          size={size}
          disabled={isSaving}
          helperText={helperText}
          sx={{
            '& .MuiInputBase-root': {
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            },
          }}
        />
      ) : (
        <Box
          sx={{
            p: 1.5,
            bgcolor: 'grey.50',
            borderRadius: 1,
            maxHeight: 400,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: 1.6,
          }}
        >
          {content || <Typography color="text.secondary" fontStyle="italic">No content</Typography>}
        </Box>
      )}

      {/* Revert button for edit mode when content is edited */}
      {isEditMode && isEdited && originalContent && (
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            startIcon={<RestoreIcon />}
            onClick={() => setEditedContent(originalContent)}
            disabled={isSaving}
          >
            Reset to Original
          </Button>
        </Box>
      )}
    </Paper>
  );
};

// Simpler inline edit variant for single fields
export interface InlineEditFieldProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  label?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}

export const InlineEditField: React.FC<InlineEditFieldProps> = ({
  value,
  onSave,
  label,
  multiline = false,
  rows = 1,
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        <TextField
          size="small"
          fullWidth
          multiline={multiline}
          rows={rows}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          label={label}
          disabled={isSaving}
          autoFocus
        />
        <IconButton size="small" onClick={handleSave} disabled={isSaving} color="primary">
          {isSaving ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={handleCancel} disabled={isSaving}>
          <CancelIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {value || <span style={{ color: '#999', fontStyle: 'italic' }}>Not set</span>}
      </Typography>
      <IconButton size="small" onClick={() => setIsEditing(true)} disabled={disabled}>
        <EditIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default EditableOutputPanel;
