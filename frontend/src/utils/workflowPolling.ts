import { apiGet } from './api';
import type { MeetingAnalysisJob } from '../types/calendarMeeting';
import { playWorkflowCompleteSound, playErrorSound } from './soundNotification';

export interface WorkflowJobStatus extends MeetingAnalysisJob {
  meetingId: string;
  runTranscript: boolean;
  runProposal: boolean;
  runPpt: boolean;
}

export interface WorkflowPollingOptions {
  jobId: string;
  intervalMs?: number;
  onUpdate: (job: WorkflowJobStatus, payload?: any) => void;
  onComplete?: (job: WorkflowJobStatus, payload?: any) => void;
}

const normalizeBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return ['true', '1', 'yes'].includes(value.toLowerCase());
  }
  return false;
};

const normalizeJobPayload = (job: any): WorkflowJobStatus => {
  const transcriptStatus = job?.transcriptStatus || job?.transcript_status || 'pending';
  const proposalStatus = job?.proposalStatus || job?.proposal_status || 'pending';
  const pptStatus = job?.pptStatus || job?.ppt_status || 'pending';

  return {
    jobId: job?.jobId || job?.job_id,
    meetingId: job?.meetingId || job?.meeting_id,
    status: job?.status || 'queued',
    runTranscript: normalizeBoolean(job?.runTranscript ?? job?.run_transcript),
    runProposal: normalizeBoolean(job?.runProposal ?? job?.run_proposal),
    runPpt: normalizeBoolean(job?.runPpt ?? job?.run_ppt),
    transcriptStatus,
    transcriptAnalysisId: job?.transcriptAnalysisId || job?.transcript_analysis_id || null,
    proposalStatus,
    proposalJobId: job?.proposalJobId || job?.proposal_job_id || null,
    pptStatus,
    pptJobId: job?.pptJobId || job?.ppt_job_id || null,
    pptDownloadUrl: job?.pptDownloadUrl || job?.ppt_download_url || null,
    pptFileName: job?.pptFileName || job?.ppt_file_name || null,
    pptSlideCount:
      typeof job?.pptSlideCount === 'number'
        ? job.pptSlideCount
        : typeof job?.ppt_slide_count === 'number'
        ? job.ppt_slide_count
        : null,
    errorMessage: job?.errorMessage || job?.error_message || null,
    updatedAt: job?.updatedAt || job?.updated_at || null,
    completedAt: job?.completedAt || job?.completed_at || null,
  };
};

const isTerminalStatus = (status: string | null | undefined) => {
  const normalized = (status || '').toLowerCase();
  return normalized === 'completed' || normalized === 'error' || normalized === 'cancelled';
};

export const startWorkflowJobPolling = ({
  jobId,
  intervalMs = 5000,
  onUpdate,
  onComplete,
}: WorkflowPollingOptions) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const poll = async () => {
    if (stopped) {
      return;
    }

    try {
      const response = await apiGet(`/api/analysis-workflow/jobs/${encodeURIComponent(jobId)}/status`);
      const jobPayload = normalizeJobPayload(response?.data?.job || {});
      onUpdate(jobPayload, response?.data);

      if (isTerminalStatus(jobPayload.status)) {
        stopped = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        // Play sound notification based on completion status
        const normalized = (jobPayload.status || '').toLowerCase();
        if (normalized === 'completed') {
          playWorkflowCompleteSound();
        } else if (normalized === 'error') {
          playErrorSound();
        }
        onComplete?.(jobPayload, response?.data);
        return;
      }
    } catch (error) {
      console.error('Workflow job polling failed', error);
    }

    if (!stopped) {
      timer = setTimeout(poll, intervalMs);
    }
  };

  poll();

  return {
    stop: () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
};
