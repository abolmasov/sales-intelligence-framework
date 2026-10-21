import { apiGet } from './api';
import { playWorkflowCompleteSound, playErrorSound } from './soundNotification';

export interface BulkJobProgress {
  bulkJobId: string;
  status: string;
  totalMeetings: number;
  completedMeetings: number;
  failedMeetings: number;
  skippedMeetings: number;
  progressPercentage: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface BulkMeetingJobStatus {
  jobId: string;
  meetingId: string;
  meetingTitle: string;
  status: string;
  transcriptStatus: string;
  proposalStatus: string;
  pptStatus: string;
  errorMessage: string | null;
}

export interface BulkJobStatusResponse {
  bulkJob: BulkJobProgress;
  meetingJobs: BulkMeetingJobStatus[];
}

export interface BulkPollingOptions {
  bulkJobId: string;
  intervalMs?: number;
  onUpdate: (data: BulkJobStatusResponse) => void;
  onComplete?: (data: BulkJobStatusResponse) => void;
}

const isTerminalStatus = (status: string | null | undefined) => {
  const normalized = (status || '').toLowerCase();
  return normalized === 'completed' || normalized === 'error' || normalized === 'cancelled';
};

export const startBulkJobPolling = ({
  bulkJobId,
  intervalMs = 5000,
  onUpdate,
  onComplete,
}: BulkPollingOptions) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const poll = async () => {
    if (stopped) return;

    try {
      const response = await apiGet(
        `/api/analysis-workflow/bulk-jobs/${encodeURIComponent(bulkJobId)}/status`
      );
      const data = response?.data as BulkJobStatusResponse;
      if (!data?.bulkJob) return;

      onUpdate(data);

      if (isTerminalStatus(data.bulkJob.status)) {
        stopped = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }

        const normalized = (data.bulkJob.status || '').toLowerCase();
        if (normalized === 'completed') {
          playWorkflowCompleteSound();
        } else if (normalized === 'error') {
          playErrorSound();
        }

        onComplete?.(data);
        return;
      }
    } catch (error) {
      console.error('Bulk job polling failed', error);
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
