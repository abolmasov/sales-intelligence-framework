import type { CalendarMeeting, MeetingAnalysisJob } from '../types/calendarMeeting';

export type WorkflowStage = 'transcript' | 'proposal' | 'ppt';

export type StageStatus =
  | 'idle'
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'skipped'
  | 'cancelled'
  | 'error';

export type WorkflowStatus = 'idle' | 'queued' | 'running' | 'partial' | 'completed' | 'cancelled' | 'error';

export type ChipColor = 'default' | 'info' | 'success' | 'warning' | 'error';

export const WORKFLOW_STAGES: WorkflowStage[] = ['transcript', 'proposal', 'ppt'];

const normalizeStatus = <T extends StageStatus | WorkflowStatus>(
  value?: string | null,
  fallback: T = 'pending' as T
): T => {
  if (!value) return fallback;
  const normalized = value.toString().toLowerCase();
  const allowed: Record<string, T> = {
    idle: 'idle' as T,
    pending: 'pending' as T,
    queued: 'queued' as T,
    running: 'running' as T,
    completed: 'completed' as T,
    skipped: 'skipped' as T,
    cancelled: 'cancelled' as T,
    error: 'error' as T,
  };
  return allowed[normalized] ?? fallback;
};

const stageColorMap: Record<StageStatus, ChipColor> = {
  idle: 'default',
  pending: 'default',
  queued: 'info',
  running: 'warning',
  completed: 'success',
  skipped: 'default',
  cancelled: 'warning',
  error: 'error',
};

const stageLabelMap: Record<StageStatus, string> = {
  idle: 'Not started',
  pending: 'Pending',
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
  error: 'Failed',
};

const workflowLabelMap: Record<WorkflowStatus, string> = {
  idle: 'Not started',
  queued: 'Queued',
  running: 'Analyzing',
  partial: 'Analyzed',
  completed: 'Analyzed',
  cancelled: 'Cancelled',
  error: 'Failed',
};

const workflowColorMap: Record<WorkflowStatus, ChipColor> = {
  idle: 'default',
  queued: 'info',
  running: 'warning',
  partial: 'success',
  completed: 'success',
  cancelled: 'warning',
  error: 'error',
};

const hasCompletedSummary = (meeting: CalendarMeeting, stage: WorkflowStage): boolean => {
  if (stage === 'transcript') {
    return (meeting.analysisSummary?.postCall || []).some(
      (entry) => (entry.status || '').toLowerCase() === 'completed'
    );
  }
  if (stage === 'proposal') {
    return (meeting.analysisSummary?.proposals || []).some(
      (entry) => (entry.status || '').toLowerCase() === 'completed'
    );
  }
  if (stage === 'ppt') {
    return Boolean(
      meeting.analysisJob && (meeting.analysisJob.pptStatus || '').toLowerCase() === 'completed'
    );
  }
  return false;
};

const stageStatusFromJob = (
  job: MeetingAnalysisJob | null | undefined,
  stage: WorkflowStage
): StageStatus => {
  if (!job) return 'pending';
  const key = `${stage}Status` as const;
  const raw = job[key as keyof MeetingAnalysisJob] as string | undefined;
  return normalizeStatus(raw, job.status === 'error' ? 'error' : job.status === 'cancelled' ? 'cancelled' : 'pending');
};

export const getStageStatus = (meeting: CalendarMeeting, stage: WorkflowStage): StageStatus => {
  if (hasCompletedSummary(meeting, stage)) {
    return 'completed';
  }

  return stageStatusFromJob(meeting.analysisJob, stage);
};

export const getStageChipProps = (stageStatus: StageStatus): { label: string; color: ChipColor } => ({
  label: stageLabelMap[stageStatus],
  color: stageColorMap[stageStatus],
});

export const getWorkflowStatus = (meeting: CalendarMeeting): WorkflowStatus => {
  const stageStatuses = WORKFLOW_STAGES.map((stage) => getStageStatus(meeting, stage));

  const hasAnyQueuedOrRunning = stageStatuses.some((status) => status === 'queued' || status === 'running');
  if (hasAnyQueuedOrRunning) {
    return 'running';
  }

  const hasAnyError = stageStatuses.some((status) => status === 'error');
  if (hasAnyError) {
    return 'error';
  }
  const hasAnyCancelled = stageStatuses.some((status) => status === 'cancelled');
  if (hasAnyCancelled) {
    return 'cancelled';
  }

  const hasAnyCompleted = stageStatuses.some((status) => status === 'completed');
  const allDoneOrSkipped = stageStatuses.every((status) => status === 'completed' || status === 'skipped');
  if (hasAnyCompleted && allDoneOrSkipped) {
    return 'completed';
  }
  if (hasAnyCompleted) {
    return 'partial';
  }

  const jobStatus = (meeting.analysisJob?.status || '').toLowerCase();
  if (jobStatus === 'queued' || jobStatus === 'pending' || jobStatus === 'in_progress') {
    return 'queued';
  }
  if (jobStatus === 'cancelled') {
    return 'cancelled';
  }

  return 'idle';
};

export const getWorkflowChipProps = (meeting: CalendarMeeting) => {
  const status = getWorkflowStatus(meeting);
  return {
    status,
    label: workflowLabelMap[status],
    color: workflowColorMap[status],
  };
};

export const isStageComplete = (stageStatus: StageStatus) => stageStatus === 'completed';

export const getStageHelperText = (stageStatus: StageStatus) => {
  if (stageStatus === 'completed') return 'Finished';
  if (stageStatus === 'running') return 'In progress';
  if (stageStatus === 'queued') return 'Queued to run';
  if (stageStatus === 'error') return 'Needs attention';
  if (stageStatus === 'cancelled') return 'Cancelled';
  if (stageStatus === 'skipped') return 'Not requested';
  return 'Not started';
};
