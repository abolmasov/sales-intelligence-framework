/**
 * Background Jobs Store
 *
 * Pollers live at module level — they survive React component unmount/navigation.
 * The Zustand store holds only display metadata (label, status, progress).
 *
 * Usage:
 *   registerJob(id, type, label, { onUpdate, onComplete })  — start polling (idempotent)
 *   connectToJob(id, { onUpdate, onComplete })              — reconnect callbacks on remount
 *   disconnectCallbacks(id)                                 — clear callbacks on unmount (poller keeps running)
 *   stopJob(id)                                             — fully cancel (user action)
 */

import { create } from 'zustand';
import { apiGet } from '../utils/api';
import { playWorkflowCompleteSound, playErrorSound } from '../utils/soundNotification';

export type BackgroundJobType = 'workflow' | 'bulk-workflow' | 'workspace' | 'pptx';
export type BackgroundJobStatus = 'queued' | 'running' | 'completed' | 'error' | 'cancelled';

export interface BackgroundJob {
  id: string;
  type: BackgroundJobType;
  label: string;
  status: BackgroundJobStatus;
  /** 0-100, populated for bulk-workflow jobs */
  progress?: number;
  startedAt: string;
  /** Latest raw payload from the status endpoint */
  data?: any;
  /** Arbitrary metadata the registering component can attach (e.g. calendarMeetingId) */
  meta?: Record<string, any>;
}

type JobCallbacks = {
  onUpdate?: (data: any) => void;
  onComplete?: (data: any) => void;
};

// ── Module-level — survive navigation ─────────────────────────────────────────
const activePollers = new Map<string, { stop: () => void }>();
const jobCallbacks = new Map<string, JobCallbacks>();

const TERMINAL = new Set(['completed', 'error', 'cancelled', 'idle']);
const isTerminal = (s: string) => TERMINAL.has((s || '').toLowerCase());

function getEndpoint(id: string, type: BackgroundJobType): string {
  switch (type) {
    case 'workflow':
      return `/api/analysis-workflow/jobs/${encodeURIComponent(id)}/status`;
    case 'bulk-workflow':
      return `/api/analysis-workflow/bulk-jobs/${encodeURIComponent(id)}/status`;
    case 'workspace':
      return `/api/workspaces/${encodeURIComponent(id)}`;
    case 'pptx':
      return `/api/pptx/jobs/${encodeURIComponent(id)}`;
  }
}

function extractStatusAndData(
  type: BackgroundJobType,
  response: any
): { status: string; progress?: number; data: any } {
  switch (type) {
    case 'workflow': {
      const job = response?.data?.job || {};
      return { status: job.status || 'queued', data: job };
    }
    case 'bulk-workflow': {
      const bj = response?.data?.bulkJob || {};
      return { status: bj.status || 'queued', progress: bj.progressPercentage, data: response?.data };
    }
    case 'workspace': {
      const ws = response?.data?.workspace || response?.data || {};
      return { status: ws.status || 'idle', data: ws };
    }
    case 'pptx': {
      const job = response?.data?.job || response?.data || {};
      return { status: job.status || 'queued', data: job };
    }
  }
}

function createPoller(
  id: string,
  type: BackgroundJobType,
  updateJob: (id: string, patch: Partial<BackgroundJob>) => void,
  removeJob: (id: string) => void,
  intervalMs = 5000
): { stop: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const poll = async () => {
    if (stopped) return;
    try {
      const response = await apiGet(getEndpoint(id, type));
      const { status, progress, data } = extractStatusAndData(type, response);

      updateJob(id, { status: status as BackgroundJobStatus, progress, data });
      jobCallbacks.get(id)?.onUpdate?.(data);

      if (isTerminal(status)) {
        stopped = true;
        if (timer) clearTimeout(timer);
        activePollers.delete(id);

        const norm = status.toLowerCase();
        if (norm === 'completed') playWorkflowCompleteSound();
        else if (norm === 'error') playErrorSound();

        jobCallbacks.get(id)?.onComplete?.(data);

        // Keep in store briefly so the badge can show a completion flash
        setTimeout(() => removeJob(id), 8000);
        return;
      }
    } catch (err) {
      console.error(`[BackgroundJobs] Poll failed for ${type}:${id}`, err);
    }
    if (!stopped) timer = setTimeout(poll, intervalMs);
  };

  poll();
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

// ── Zustand store ──────────────────────────────────────────────────────────────

interface BackgroundJobsState {
  jobs: Record<string, BackgroundJob>;

  /**
   * Start tracking a job. If a poller for this id already exists (e.g. the component
   * that started it navigated away and came back), the existing poller is kept and
   * only the callbacks are updated.
   */
  registerJob(
    id: string,
    type: BackgroundJobType,
    label: string,
    callbacks?: JobCallbacks,
    meta?: Record<string, any>
  ): void;

  /**
   * Reconnect component callbacks to an existing background job without restarting
   * the poller. Returns true if the job exists, false otherwise.
   */
  connectToJob(id: string, callbacks: JobCallbacks): boolean;

  /**
   * Remove component callbacks without stopping the poller.
   * Call this in useEffect cleanup so updates don't flow into unmounted components.
   */
  disconnectCallbacks(id: string): void;

  /** Fully stop and remove a job (use for explicit user cancellation). */
  stopJob(id: string): void;

  // Internal
  _updateJob(id: string, patch: Partial<BackgroundJob>): void;
  _removeJob(id: string): void;
}

export const useBackgroundJobsStore = create<BackgroundJobsState>((set, get) => ({
  jobs: {},

  registerJob(id, type, label, callbacks = {}, meta) {
    if (activePollers.has(id)) {
      // Poller already running — just refresh callbacks for the new component instance
      jobCallbacks.set(id, callbacks);
      return;
    }

    set((state) => ({
      jobs: {
        ...state.jobs,
        [id]: { id, type, label, status: 'queued', startedAt: new Date().toISOString(), meta },
      },
    }));

    jobCallbacks.set(id, callbacks);

    const poller = createPoller(
      id,
      type,
      (jid, patch) => get()._updateJob(jid, patch),
      (jid) => get()._removeJob(jid)
    );
    activePollers.set(id, poller);
  },

  connectToJob(id, callbacks) {
    if (!get().jobs[id]) return false;
    jobCallbacks.set(id, callbacks);
    return true;
  },

  disconnectCallbacks(id) {
    jobCallbacks.delete(id);
  },

  stopJob(id) {
    activePollers.get(id)?.stop();
    activePollers.delete(id);
    jobCallbacks.delete(id);
    set((state) => {
      const jobs = { ...state.jobs };
      delete jobs[id];
      return { jobs };
    });
  },

  _updateJob(id, patch) {
    set((state) => ({
      jobs: state.jobs[id]
        ? { ...state.jobs, [id]: { ...state.jobs[id], ...patch } }
        : state.jobs,
    }));
  },

  _removeJob(id) {
    jobCallbacks.delete(id);
    set((state) => {
      const jobs = { ...state.jobs };
      delete jobs[id];
      return { jobs };
    });
  },
}));
