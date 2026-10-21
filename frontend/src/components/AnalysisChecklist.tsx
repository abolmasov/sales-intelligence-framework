import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import type { CalendarMeeting } from '../types/calendarMeeting';
import { apiPostForm } from '../utils/api';
import { getStageStatus } from '../utils/analysisStatus';
import type { WorkflowStage } from '../utils/analysisStatus';

export interface AnalysisStageSelection {
  transcript: boolean;
  proposal: boolean;
  ppt: boolean;
}

interface AnalysisChecklistProps {
  meeting: CalendarMeeting;
  onRun: (params: { stages: AnalysisStageSelection; transcriptText?: string }) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
  availableStages?: Partial<Record<WorkflowStage, boolean>>;
  initialSelection?: Partial<AnalysisStageSelection>;
  completedStages?: Partial<Record<WorkflowStage, boolean>>;
  disabledReason?: string | null;
  disableRun?: boolean;
}

const defaultSelection: AnalysisStageSelection = {
  transcript: false,
  proposal: false,
  ppt: false,
};

const AnalysisChecklist: React.FC<AnalysisChecklistProps> = ({
  meeting,
  onRun,
  loading = false,
  error = null,
  compact = false,
  availableStages,
  initialSelection,
  completedStages,
  disabledReason = null,
  disableRun = false,
}) => {
  const transcriptStatus = getStageStatus(meeting, 'transcript');
  const proposalStatus = getStageStatus(meeting, 'proposal');
  const pptStatus = getStageStatus(meeting, 'ppt');

  const transcriptComplete = completedStages?.transcript ?? (transcriptStatus === 'completed');
  const proposalComplete = completedStages?.proposal ?? (proposalStatus === 'completed');
  const pptComplete = completedStages?.ppt ?? (pptStatus === 'completed');

  const stageAvailability = useMemo(
    () => ({
      transcript: transcriptComplete ? false : availableStages?.transcript !== false,
      proposal: proposalComplete ? false : availableStages?.proposal !== false,
      ppt: pptComplete ? false : availableStages?.ppt !== false,
    }),
    [
      availableStages?.transcript,
      availableStages?.proposal,
      availableStages?.ppt,
      transcriptComplete,
      proposalComplete,
      pptComplete,
    ]
  );

  const computedInitialSelection = useMemo(() => {
    const base: AnalysisStageSelection = {
      ...defaultSelection,
      ...(initialSelection || {}),
    };
    (Object.keys(stageAvailability) as Array<keyof AnalysisStageSelection>).forEach((stage) => {
      if (!stageAvailability[stage]) {
        base[stage] = false;
      }
    });
    return base;
  }, [
    initialSelection?.transcript,
    initialSelection?.proposal,
    initialSelection?.ppt,
    stageAvailability.transcript,
    stageAvailability.proposal,
    stageAvailability.ppt,
  ]);

  const [selection, setSelection] = useState<AnalysisStageSelection>(computedInitialSelection);
  const [localError, setLocalError] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(null);
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const isMeetingLinked = Boolean(
    meeting.accountId ||
      meeting.deal_id ||
      meeting.deal?.deal_id
  );

  useEffect(() => {
    setSelection(computedInitialSelection);
    setTranscriptText('');
  }, [meeting.id, computedInitialSelection]);

  const hasExistingTranscript = transcriptComplete || Boolean(meeting.transcriptAvailable);

  const handleToggle = (stage: keyof AnalysisStageSelection) => {
    if (!stageAvailability[stage]) {
      return;
    }
    setSelection((prev) => {
      const next = { ...prev };
      next[stage] = !prev[stage];

      if (stage === 'transcript' && !next.transcript) {
        next.proposal = false;
        next.ppt = false;
      }

      if (stage === 'proposal') {
        if (next.proposal) {
          if (!transcriptComplete) {
            next.transcript = true;
          }
        } else {
          next.ppt = false;
        }
      }

      if (stage === 'ppt' && next.ppt) {
        if (!proposalComplete) {
          next.proposal = true;
        }
        if (!transcriptComplete) {
          next.transcript = true;
        }
      }

      return next;
    });
  };

  const stagesToRun = useMemo(() => {
    return {
      transcript:
        stageAvailability.transcript && selection.transcript && !transcriptComplete,
      proposal: stageAvailability.proposal && selection.proposal && !proposalComplete,
      ppt: stageAvailability.ppt && selection.ppt,
    };
  }, [selection, transcriptComplete, proposalComplete, stageAvailability]);

  const needsTranscriptInput = stagesToRun.transcript && !hasExistingTranscript && transcriptText.trim().length === 0;

  const handleRunClick = async () => {
    setLocalError(null);

    if (!stagesToRun.transcript && !stagesToRun.proposal && !stagesToRun.ppt) {
      setLocalError('Select at least one analysis stage to run.');
      return;
    }

    if (needsTranscriptInput) {
      setTranscriptDialogOpen(true);
      setDialogError(null);
      setTranscriptDraft(transcriptText);
      return;
    }

    if (disableRun) {
      return;
    }

    try {
      await onRun({
        stages: stagesToRun,
        transcriptText: stagesToRun.transcript ? transcriptText : undefined,
      });
      setSelection(computedInitialSelection);
    } catch (runError: any) {
      setLocalError(runError?.message || 'Failed to start analysis.');
    }
  };

  const renderStage = (
    stage: keyof AnalysisStageSelection,
    label: string,
    completed: boolean
  ) => (
    <FormControlLabel
      control={
        <Checkbox
          size="small"
          checked={completed || selection[stage]}
          onChange={() => handleToggle(stage)}
          disabled={loading || completed || !stageAvailability[stage]}
        />
      }
      label={
        <Stack spacing={0}>
          <Typography
            variant={compact ? 'body2' : 'body1'}
            fontWeight={500}
            sx={{
              textDecoration: completed ? 'line-through' : 'none',
              color: completed ? 'success.main' : undefined,
            }}
          >
            {label}
          </Typography>
        </Stack>
      }
    />
  );

  return (
    <>
      <Stack spacing={1} sx={{ p: compact ? 0 : 1 }}>
        <Typography variant="subtitle2">Analysis</Typography>
        <FormGroup>
          {renderStage(
            'transcript',
            'Transcript Analysis',
            transcriptComplete
          )}
          {renderStage(
            'proposal',
            'Generate Solution Proposal',
            proposalComplete
          )}
          {renderStage(
            'ppt',
            'Generate Presentation Deck',
            pptComplete
          )}
        </FormGroup>

        {(error || localError) && (
          <Alert severity="error">{error || localError}</Alert>
        )}
        {disabledReason && (
          <Alert severity="info">{disabledReason}</Alert>
        )}

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={handleRunClick}
            disabled={loading || disableRun}
          >
            {loading ? 'Running…' : 'Run Analysis'}
          </Button>
          {!hasExistingTranscript && stageAvailability.transcript && (
            <Button
              variant="text"
              size="small"
              onClick={() => setTranscriptDialogOpen(true)}
              disabled={loading || disableRun}
            >
              Provide transcript
            </Button>
          )}
        </Stack>
      </Stack>

      <Dialog
        open={transcriptDialogOpen}
        onClose={() => {
          setTranscriptDialogOpen(false);
          setTranscriptDraft(transcriptText);
          setDialogError(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Provide Transcript</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Paste the meeting transcript. This will be used for transcript analysis.
          </Typography>
          {!isMeetingLinked && (
            <Alert severity="info" sx={{ mb: 2 }}>
              It&apos;s optional, but linking this meeting to an account or deal helps keep the transcript and follow-up actions organized with the right pursuit.
            </Alert>
          )}
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              component="label"
              size="small"
              disabled={uploadingTranscript}
            >
              {uploadingTranscript ? 'Extracting…' : 'Upload PDF / DOCX / TXT'}
              <input
                type="file"
                hidden
                accept=".pdf,.docx,.txt"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setDialogError(null);
                  setUploadingTranscript(true);
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const response = await apiPostForm('/api/transcripts/extract-text', formData);
                    if (!response?.success) {
                      throw new Error(response?.error || 'Failed to extract transcript text.');
                    }
                    const text = response?.data?.text || '';
                    if (!text.trim()) {
                      throw new Error('Could not extract text from the uploaded file.');
                    }
                    setTranscriptDraft(text.trim());
                    setTranscriptFileName(file.name);
                  } catch (uploadError: any) {
                    setDialogError(uploadError?.message || 'Failed to extract text from file.');
                  } finally {
                    setUploadingTranscript(false);
                  }
                }}
              />
            </Button>
            {transcriptFileName && (
              <Typography variant="caption" color="text.secondary">
                Loaded from: {transcriptFileName}
              </Typography>
            )}
          </Stack>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {dialogError}
            </Alert>
          )}
          <textarea
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.6)',
              resize: 'vertical',
            }}
            value={transcriptDraft}
            onChange={(event) => setTranscriptDraft(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setTranscriptDialogOpen(false);
              setTranscriptDraft(transcriptText);
              setDialogError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setTranscriptText(transcriptDraft.trim());
              setTranscriptDialogOpen(false);
            }}
            disabled={transcriptDraft.trim().length === 0}
          >
            Save Transcript
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AnalysisChecklist;
