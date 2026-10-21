/**
 * Store Synchronization System
 *
 * This module provides a centralized event bus for synchronizing state across
 * different stores and components. It solves the problem of stale data when
 * switching between tabs/views.
 *
 * Events:
 * - PRECALL_STARTED: Fired when pre-call research begins
 * - PRECALL_COMPLETED: Fired when pre-call research finishes
 * - POSTCALL_COMPLETED: Fired when post-call analysis finishes
 * - PROPOSAL_COMPLETED: Fired when proposal generation finishes
 * - PPTX_COMPLETED: Fired when PPTX generation finishes
 * - MEETING_UPDATED: Fired when any meeting data changes
 * - DEAL_LINKED: Fired when a deal is linked to a meeting
 * - ANALYSIS_WORKFLOW_UPDATED: Fired when workflow job status changes
 */

export type SyncEventType =
  | 'PRECALL_STARTED'
  | 'PRECALL_COMPLETED'
  | 'POSTCALL_COMPLETED'
  | 'PROPOSAL_COMPLETED'
  | 'PPTX_COMPLETED'
  | 'MEETING_UPDATED'
  | 'DEAL_LINKED'
  | 'DEAL_UNLINKED'
  | 'ANALYSIS_WORKFLOW_UPDATED'
  | 'TRANSCRIPT_UPLOADED'
  | 'CACHE_INVALIDATE';

export interface SyncEventPayload {
  meetingId?: string;
  dealId?: string;
  sessionId?: string;
  analysisId?: string;
  jobId?: string;
  status?: string;
  timestamp: number;
  source?: string; // Component/page that triggered the event
}

type EventCallback = (payload: SyncEventPayload) => void;

class StoreSyncEventBus {
  private listeners: Map<SyncEventType, Set<EventCallback>> = new Map();
  private globalListeners: Set<EventCallback> = new Set();
  private eventHistory: Array<{ type: SyncEventType; payload: SyncEventPayload }> = [];
  private maxHistorySize = 50;

  /**
   * Subscribe to a specific event type
   */
  on(eventType: SyncEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(callback: EventCallback): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  /**
   * Emit an event to all listeners
   */
  emit(eventType: SyncEventType, payload: Omit<SyncEventPayload, 'timestamp'>): void {
    const fullPayload: SyncEventPayload = {
      ...payload,
      timestamp: Date.now(),
    };

    // Add to history
    this.eventHistory.push({ type: eventType, payload: fullPayload });
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify specific listeners
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(fullPayload);
        } catch (error) {
          console.error(`[StoreSync] Error in ${eventType} listener:`, error);
        }
      });
    }

    // Notify global listeners
    this.globalListeners.forEach((callback) => {
      try {
        callback(fullPayload);
      } catch (error) {
        console.error(`[StoreSync] Error in global listener:`, error);
      }
    });

    // Log for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[StoreSync] Event: ${eventType}`, fullPayload);
    }
  }

  /**
   * Get recent events (useful for debugging)
   */
  getHistory(): Array<{ type: SyncEventType; payload: SyncEventPayload }> {
    return [...this.eventHistory];
  }

  /**
   * Check if an event was fired recently (within timeWindowMs)
   */
  wasEventFiredRecently(
    eventType: SyncEventType,
    matchPayload: Partial<SyncEventPayload>,
    timeWindowMs: number = 5000
  ): boolean {
    const now = Date.now();
    return this.eventHistory.some((event) => {
      if (event.type !== eventType) return false;
      if (now - event.payload.timestamp > timeWindowMs) return false;

      // Check if payload matches
      for (const key of Object.keys(matchPayload) as Array<keyof SyncEventPayload>) {
        if (matchPayload[key] !== undefined && event.payload[key] !== matchPayload[key]) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Clear all listeners (useful for testing)
   */
  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
    this.eventHistory = [];
  }
}

// Singleton instance
export const storeSync = new StoreSyncEventBus();

// Convenience functions for common events
export const syncEvents = {
  preCallStarted: (meetingId: string, sessionId: string, source?: string) => {
    storeSync.emit('PRECALL_STARTED', { meetingId, sessionId, source });
  },

  preCallCompleted: (meetingId: string, sessionId: string, source?: string) => {
    storeSync.emit('PRECALL_COMPLETED', { meetingId, sessionId, source });
  },

  postCallCompleted: (meetingId: string, analysisId: string, source?: string) => {
    storeSync.emit('POSTCALL_COMPLETED', { meetingId, analysisId, source });
  },

  proposalCompleted: (meetingId: string, jobId: string, source?: string) => {
    storeSync.emit('PROPOSAL_COMPLETED', { meetingId, jobId, source });
  },

  pptxCompleted: (meetingId: string, jobId: string, source?: string) => {
    storeSync.emit('PPTX_COMPLETED', { meetingId, jobId, source });
  },

  meetingUpdated: (meetingId: string, source?: string) => {
    storeSync.emit('MEETING_UPDATED', { meetingId, source });
  },

  dealLinked: (meetingId: string, dealId: string, source?: string) => {
    storeSync.emit('DEAL_LINKED', { meetingId, dealId, source });
  },

  dealUnlinked: (meetingId: string, dealId: string, source?: string) => {
    storeSync.emit('DEAL_UNLINKED', { meetingId, dealId, source });
  },

  workflowUpdated: (meetingId: string, jobId: string, status: string, source?: string) => {
    storeSync.emit('ANALYSIS_WORKFLOW_UPDATED', { meetingId, jobId, status, source });
  },

  transcriptUploaded: (meetingId: string, source?: string) => {
    storeSync.emit('TRANSCRIPT_UPLOADED', { meetingId, source });
  },

  invalidateCache: (source?: string) => {
    storeSync.emit('CACHE_INVALIDATE', { source });
  },
};

export default storeSync;
