/**
 * Multi-Agent Orchestration Framework — Core Types
 *
 * Provides the foundational abstractions for composing AI workflows
 * as agents that can be chained, parallelized, and orchestrated.
 */

// ---------------------------------------------------------------------------
// Agent Context — shared state bag passed through pipeline execution
// ---------------------------------------------------------------------------

export interface AgentContext {
  /** Deal associated with this pipeline run */
  dealId?: string;
  /** Account associated with this pipeline run */
  accountId?: string;
  /** Meeting being analyzed */
  meetingId?: string;
  /** User who triggered the pipeline */
  userId?: string;
  /** OAuth access token for downstream API calls (MS Graph, InternalKnowledge, etc.) */
  accessToken?: string | null;

  /**
   * Shared result store — agents write their output here so downstream
   * agents can read it via `context.results.get('someKey')`.
   */
  results: Map<string, any>;

  /** Pipeline start timestamp (Date.now()) */
  startTime: number;

  /** Check whether the pipeline has been cancelled */
  isCancelled: () => boolean;
  /** Throw if pipeline has been cancelled */
  assertNotCancelled: () => void;
}

// ---------------------------------------------------------------------------
// Agent Result — returned by every agent execution
// ---------------------------------------------------------------------------

export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Agent Progress — observable progress of a single agent
// ---------------------------------------------------------------------------

export type AgentStatus = 'pending' | 'running' | 'completed' | 'error' | 'cancelled';

export interface AgentProgress {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  /** 0–100 */
  percentage: number;
  currentStep?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// ---------------------------------------------------------------------------
// Base Agent — abstract class that all concrete agents extend
// ---------------------------------------------------------------------------

export abstract class BaseAgent<TInput = any, TOutput = any> {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;

  protected _progress: AgentProgress;

  constructor() {
    // Initialised in a deferred way since abstract fields aren't available in super()
    this._progress = {
      agentId: '',
      agentName: '',
      status: 'pending',
      percentage: 0,
    };
  }

  /** Ensure progress has the correct id/name (called once before execute) */
  private ensureProgressInit(): void {
    if (!this._progress.agentId) {
      this._progress.agentId = this.id;
      this._progress.agentName = this.name;
    }
  }

  /**
   * Execute the agent's work.
   * Concrete agents must implement this.
   */
  abstract execute(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>>;

  /** Request cancellation */
  cancel(): void {
    this._progress.status = 'cancelled';
  }

  /** Get a snapshot of current progress */
  getProgress(): AgentProgress {
    this.ensureProgressInit();
    return { ...this._progress };
  }

  // -- Protected helpers for concrete agents --

  protected updateProgress(percentage: number, currentStep?: string): void {
    this.ensureProgressInit();
    this._progress.percentage = Math.min(100, Math.max(0, percentage));
    this._progress.status = 'running';
    this._progress.startedAt = this._progress.startedAt ?? new Date();
    if (currentStep !== undefined) {
      this._progress.currentStep = currentStep;
    }
  }

  protected markComplete(): void {
    this.ensureProgressInit();
    this._progress.status = 'completed';
    this._progress.percentage = 100;
    this._progress.completedAt = new Date();
  }

  protected markError(error: string): void {
    this.ensureProgressInit();
    this._progress.status = 'error';
    this._progress.error = error;
    this._progress.completedAt = new Date();
  }
}

// ---------------------------------------------------------------------------
// Cancellation helpers — reusable across pipelines
// ---------------------------------------------------------------------------

export class AgentCancellationError extends Error {
  constructor(message = 'Agent execution was cancelled') {
    super(message);
    this.name = 'AgentCancellationError';
  }
}

/**
 * Creates a simple cancellation controller that agents/pipelines can share.
 */
export function createCancellationController() {
  let cancelled = false;
  return {
    cancel: () => {
      cancelled = true;
    },
    isCancelled: () => cancelled,
    assertNotCancelled: () => {
      if (cancelled) throw new AgentCancellationError();
    },
  };
}

/**
 * Factory helper to create an AgentContext with sensible defaults.
 */
export function createAgentContext(
  overrides: Partial<Omit<AgentContext, 'results' | 'startTime' | 'isCancelled' | 'assertNotCancelled'>> & {
    cancellation?: ReturnType<typeof createCancellationController>;
  } = {}
): AgentContext {
  const cancellation = overrides.cancellation ?? createCancellationController();
  return {
    dealId: overrides.dealId,
    accountId: overrides.accountId,
    meetingId: overrides.meetingId,
    userId: overrides.userId,
    accessToken: overrides.accessToken ?? null,
    results: new Map(),
    startTime: Date.now(),
    isCancelled: cancellation.isCancelled,
    assertNotCancelled: cancellation.assertNotCancelled,
  };
}
