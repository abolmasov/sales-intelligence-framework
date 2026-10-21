import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Stack,
  Chip,
  Alert,
} from '@mui/material';
import type { CalendarMeeting } from '../../types/calendarMeeting';

export type AnalysisStage = 'precall' | 'postcall' | 'proposal' | 'ppt';

interface MeetingAnalysisDialogProps {
  open: boolean;
  meeting: CalendarMeeting | null;
  onClose: () => void;
  onRunStages: (stages: AnalysisStage[]) => Promise<void>;
  isRunning?: boolean;
  error?: string | null;
}

const STAGE_META: Record<
  AnalysisStage,
  { title: string; description: string; dependsOn?: AnalysisStage }
> = {
  precall: {
    title: 'Pre-call Analysis',
    description: 'Run company research to prepare for the meeting.',
  },
  postcall: {
    title: 'Post-call Analysis',
    description: 'Analyze transcripts and generate recap insights.',
    dependsOn: 'precall',
  },
  proposal: {
    title: 'Generate Solution Proposal',
    description: 'Use post-call data to build a tailored proposal draft.',
    dependsOn: 'postcall',
  },
  ppt: {
    title: 'Generate Presentation Deck',
    description: 'Create an executive-ready deck from the solution proposal.',
    dependsOn: 'proposal',
  },
};

const MeetingAnalysisDialog: React.FC<MeetingAnalysisDialogProps> = ({
  open,
  meeting,
  onClose,
  onRunStages,
  isRunning = false,
  error = null,
}) => {
  const [selectedStages, setSelectedStages] = useState<Record<AnalysisStage, boolean>>({
    precall: false,
    postcall: false,
    proposal: false,
    ppt: false,
  });

  useEffect(() => {
    if (!meeting) return;
    const hasPreCall = (meeting.analysisSummary?.preCall?.length || 0) > 0;
    const hasPostCall = (meeting.analysisSummary?.postCall?.length || 0) > 0;
    const hasProposal = (meeting.analysisSummary?.proposals?.length || 0) > 0;

    setSelectedStages({
      precall: !hasPreCall,
      postcall: !hasPostCall,
      proposal: !hasProposal,
      ppt: false,
    });
  }, [meeting]);

  const toggleStage = (stage: AnalysisStage) => {
    setSelectedStages((prev) => ({
      ...prev,
      [stage]: !prev[stage],
    }));
  };

  const handleRun = async () => {
    const stages = (Object.keys(selectedStages) as AnalysisStage[]).filter((stage) => selectedStages[stage]);
    if (stages.length === 0) return;
    await onRunStages(stages);
  };

  if (!meeting) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Run Analyses for {meeting.title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Select the workflows you want to run. They will execute sequentially in the selected order.
          </Typography>

          <FormGroup>
            {(Object.keys(STAGE_META) as AnalysisStage[]).map((stage) => {
              const stageMeta = STAGE_META[stage];
              const disabled =
                (stage === 'postcall' && (meeting.analysisSummary?.preCall?.length || 0) === 0 && !selectedStages.precall) ||
                (stage === 'proposal' && (meeting.analysisSummary?.postCall?.length || 0) === 0 && !selectedStages.postcall) ||
                (stage === 'ppt' && !selectedStages.proposal && (meeting.analysisSummary?.proposals?.length || 0) === 0);

              const alreadyCompleted =
                (stage === 'precall' && (meeting.analysisSummary?.preCall?.length || 0) > 0) ||
                (stage === 'postcall' && (meeting.analysisSummary?.postCall?.length || 0) > 0) ||
                (stage === 'proposal' && (meeting.analysisSummary?.proposals?.length || 0) > 0);

              return (
                <Stack
                  key={stage}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{
                    border: 1,
                    borderColor: selectedStages[stage] ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    p: 1.5,
                    mb: 1,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedStages[stage]}
                        onChange={() => toggleStage(stage)}
                        disabled={disabled || alreadyCompleted}
                      />
                    }
                    label={
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">{stageMeta.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {stageMeta.description}
                        </Typography>
                      </Stack>
                    }
                  />
                  {alreadyCompleted ? (
                    <Chip color="success" label="Completed" size="small" />
                  ) : (
                    stageMeta.dependsOn && (
                      <Chip variant="outlined" size="small" label={`Depends on ${stageMeta.dependsOn}`} />
                    )
                  )}
                </Stack>
              );
            })}
          </FormGroup>

          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isRunning}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleRun}
          disabled={isRunning || !Object.values(selectedStages).some(Boolean)}
        >
          {isRunning ? 'Running…' : 'Run Selected'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MeetingAnalysisDialog;
