/**
 * React hooks for store synchronization
 *
 * These hooks make it easy for components to:
 * 1. Listen for sync events and refresh their data
 * 2. Emit events when they make changes
 * 3. Auto-invalidate cache when navigating between views
 */

import { useEffect, useCallback, useRef } from 'react';
import { storeSync, syncEvents, SyncEventType, SyncEventPayload } from '../utils/storeSync';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';

/**
 * Hook to subscribe to specific sync events
 * Automatically cleans up on unmount
 */
export function useSyncEvent(
  eventType: SyncEventType | SyncEventType[],
  callback: (payload: SyncEventPayload) => void,
  deps: React.DependencyList = []
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const eventTypes = Array.isArray(eventType) ? eventType : [eventType];
    const unsubscribes: Array<() => void> = [];

    eventTypes.forEach((type) => {
      const unsub = storeSync.on(type, (payload) => {
        callbackRef.current(payload);
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, ...deps]);
}

/**
 * Hook to subscribe to all sync events
 */
export function useSyncEventAll(
  callback: (payload: SyncEventPayload & { type?: SyncEventType }) => void,
  deps: React.DependencyList = []
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsub = storeSync.onAll((payload) => {
      callbackRef.current(payload);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Hook that auto-refreshes calendar meetings when relevant events occur
 * Use this in components that display meeting data
 */
export function useAutoRefreshMeetings(
  options: {
    meetingId?: string; // Only refresh if this meeting is affected
    enabled?: boolean;
    debounceMs?: number;
  } = {}
): { refresh: () => void; isRefreshing: boolean } {
  const { meetingId, enabled = true, debounceMs = 500 } = options;
  const fetchMeetings = useCalendarMeetingsStore((state) => state.fetchMeetings);
  const isLoading = useCalendarMeetingsStore((state) => state.isLoading);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const refresh = useCallback(() => {
    // Debounce rapid refreshes
    const now = Date.now();
    if (now - lastRefreshRef.current < debounceMs) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        lastRefreshRef.current = Date.now();
        fetchMeetings({ force: true }); // Force refresh
      }, debounceMs);
      return;
    }

    lastRefreshRef.current = now;
    fetchMeetings({ force: true });
  }, [fetchMeetings, debounceMs]);

  // Subscribe to relevant events
  useSyncEvent(
    [
      'PRECALL_STARTED',
      'PRECALL_COMPLETED',
      'POSTCALL_COMPLETED',
      'PROPOSAL_COMPLETED',
      'PPTX_COMPLETED',
      'MEETING_UPDATED',
      'DEAL_LINKED',
      'DEAL_UNLINKED',
      'ANALYSIS_WORKFLOW_UPDATED',
      'TRANSCRIPT_UPLOADED',
      'CACHE_INVALIDATE',
    ],
    (payload) => {
      if (!enabled) return;

      // If meetingId is specified, only refresh for that meeting
      if (meetingId && payload.meetingId && payload.meetingId !== meetingId) {
        return;
      }

      refresh();
    },
    [meetingId, enabled, refresh]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { refresh, isRefreshing: isLoading };
}

/**
 * Hook that provides sync event emitters
 * Use this in components that make changes
 */
export function useSyncEmitters() {
  return {
    emitPreCallStarted: useCallback(
      (meetingId: string, sessionId: string, source?: string) => {
        syncEvents.preCallStarted(meetingId, sessionId, source);
      },
      []
    ),

    emitPreCallCompleted: useCallback(
      (meetingId: string, sessionId: string, source?: string) => {
        syncEvents.preCallCompleted(meetingId, sessionId, source);
      },
      []
    ),

    emitPostCallCompleted: useCallback(
      (meetingId: string, analysisId: string, source?: string) => {
        syncEvents.postCallCompleted(meetingId, analysisId, source);
      },
      []
    ),

    emitProposalCompleted: useCallback(
      (meetingId: string, jobId: string, source?: string) => {
        syncEvents.proposalCompleted(meetingId, jobId, source);
      },
      []
    ),

    emitPptxCompleted: useCallback(
      (meetingId: string, jobId: string, source?: string) => {
        syncEvents.pptxCompleted(meetingId, jobId, source);
      },
      []
    ),

    emitMeetingUpdated: useCallback((meetingId: string, source?: string) => {
      syncEvents.meetingUpdated(meetingId, source);
    }, []),

    emitDealLinked: useCallback(
      (meetingId: string, dealId: string, source?: string) => {
        syncEvents.dealLinked(meetingId, dealId, source);
      },
      []
    ),

    emitDealUnlinked: useCallback(
      (meetingId: string, dealId: string, source?: string) => {
        syncEvents.dealUnlinked(meetingId, dealId, source);
      },
      []
    ),

    emitWorkflowUpdated: useCallback(
      (meetingId: string, jobId: string, status: string, source?: string) => {
        syncEvents.workflowUpdated(meetingId, jobId, status, source);
      },
      []
    ),

    emitTranscriptUploaded: useCallback(
      (meetingId: string, source?: string) => {
        syncEvents.transcriptUploaded(meetingId, source);
      },
      []
    ),

    emitInvalidateCache: useCallback((source?: string) => {
      syncEvents.invalidateCache(source);
    }, []),
  };
}

/**
 * Hook that triggers a refresh when the component mounts
 * Useful for pages that need fresh data on navigation
 */
export function useRefreshOnMount(refreshFn: () => void, enabled: boolean = true): void {
  const hasRefreshedRef = useRef(false);

  useEffect(() => {
    if (enabled && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true;
      refreshFn();
    }
  }, [enabled, refreshFn]);
}

/**
 * Hook that tracks if data might be stale based on sync events
 * Returns true if an event was fired that might affect the data
 */
export function useDataFreshness(
  meetingId?: string,
  lastFetchedAt?: number
): { mightBeStale: boolean; timeSinceLastFetch: number } {
  const mightBeStale = useRef(false);

  useSyncEvent(
    ['PRECALL_COMPLETED', 'POSTCALL_COMPLETED', 'MEETING_UPDATED', 'DEAL_LINKED'],
    (payload) => {
      if (!meetingId || payload.meetingId === meetingId) {
        mightBeStale.current = true;
      }
    },
    [meetingId]
  );

  const timeSinceLastFetch = lastFetchedAt ? Date.now() - lastFetchedAt : Infinity;

  return {
    mightBeStale: mightBeStale.current || timeSinceLastFetch > 5 * 60 * 1000, // 5 minutes
    timeSinceLastFetch,
  };
}

export default {
  useSyncEvent,
  useSyncEventAll,
  useAutoRefreshMeetings,
  useSyncEmitters,
  useRefreshOnMount,
  useDataFreshness,
};
