/**
 * Pipeline Runner — composes agents into sequential or parallel workflows.
 *
 * SequentialPipeline: runs agents in order, passing output → input
 * ParallelPipeline:   runs agents concurrently with a configurable concurrency limit
 */

import type { BaseAgent, AgentContext, AgentResult, AgentProgress } from './types';
import { Semaphore } from './concurrency';

// ---------------------------------------------------------------------------
// Pipeline Step — single node in a pipeline
// ---------------------------------------------------------------------------

export interface PipelineStep {
  /** The agent to execute */
  agent: BaseAgent;
  /** If provided, skip this step when condition returns false */
  condition?: (context: AgentContext) => boolean;
  /** Transform context into the agent's input. Defaults to previous step's output. */
  inputMapper?: (context: AgentContext) => any;
  /** Key under which to store the agent's result in context.results */
  outputKey?: string;
}

// ---------------------------------------------------------------------------
// Pipeline Progress — aggregate progress across all steps
// ---------------------------------------------------------------------------

export interface PipelineProgress {
  pipelineId: string;
  pipelineName: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  currentStep?: string;
  /** Per-agent progress snapshots */
  stepProgresses: AgentProgress[];
}

// ---------------------------------------------------------------------------
// Sequential Pipeline
// ---------------------------------------------------------------------------

export class SequentialPipeline {
  readonly id: string;
  readonly name: string;
  private steps: PipelineStep[];

  constructor(id: string, name: string, steps: PipelineStep[]) {
    this.id = id;
    this.name = name;
    this.steps = steps;
  }

  /**
   * Execute all steps in order.
   * @param initialInput Input to the first step (subsequent steps receive previous output or mapped input)
   * @param context Shared agent context
   * @param onProgress Optional callback invoked after each step completes
   */
  async execute(
    initialInput: any,
    context: AgentContext,
    onProgress?: (progress: PipelineProgress) => void
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    let currentInput = initialInput;
    let completedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];

      // Check cancellation before each step
      context.assertNotCancelled();

      // Evaluate condition — skip if false
      if (step.condition && !step.condition(context)) {
        skippedCount++;
        results.push({ success: true, data: null, durationMs: 0 });
        this.reportProgress(onProgress, completedCount, failedCount, skippedCount);
        continue;
      }

      // Determine input for this step
      const input = step.inputMapper ? step.inputMapper(context) : currentInput;

      // Execute agent
      const result = await step.agent.execute(input, context);
      results.push(result);

      if (result.success) {
        completedCount++;
        // Store in shared context
        if (step.outputKey) {
          context.results.set(step.outputKey, result.data);
        }
        // Forward output as next step's default input
        currentInput = result.data;
      } else {
        failedCount++;
        // Stop pipeline on first error
        this.reportProgress(onProgress, completedCount, failedCount, skippedCount, step.agent.name);
        break;
      }

      this.reportProgress(onProgress, completedCount, failedCount, skippedCount);
    }

    return results;
  }

  getProgress(): PipelineProgress {
    const stepProgresses = this.steps.map((s) => s.agent.getProgress());
    return {
      pipelineId: this.id,
      pipelineName: this.name,
      totalSteps: this.steps.length,
      completedSteps: stepProgresses.filter((p) => p.status === 'completed').length,
      failedSteps: stepProgresses.filter((p) => p.status === 'error').length,
      skippedSteps: 0,
      stepProgresses,
    };
  }

  private reportProgress(
    onProgress: ((p: PipelineProgress) => void) | undefined,
    completed: number,
    failed: number,
    skipped: number,
    currentStep?: string
  ): void {
    if (!onProgress) return;
    onProgress({
      pipelineId: this.id,
      pipelineName: this.name,
      totalSteps: this.steps.length,
      completedSteps: completed,
      failedSteps: failed,
      skippedSteps: skipped,
      currentStep,
      stepProgresses: this.steps.map((s) => s.agent.getProgress()),
    });
  }
}

// ---------------------------------------------------------------------------
// Parallel Pipeline
// ---------------------------------------------------------------------------

export class ParallelPipeline {
  readonly id: string;
  readonly name: string;
  private steps: PipelineStep[];
  private concurrencyLimit: number;

  constructor(id: string, name: string, steps: PipelineStep[], concurrency: number = 3) {
    this.id = id;
    this.name = name;
    this.steps = steps;
    this.concurrencyLimit = concurrency;
  }

  /**
   * Execute all steps concurrently (up to concurrency limit).
   */
  async execute(
    context: AgentContext,
    onProgress?: (progress: PipelineProgress) => void
  ): Promise<AgentResult[]> {
    const semaphore = new Semaphore(this.concurrencyLimit);

    const resultPromises = this.steps.map(async (step, _index) => {
      // Check condition
      if (step.condition && !step.condition(context)) {
        return { success: true, data: null, durationMs: 0 } as AgentResult;
      }

      await semaphore.acquire();
      try {
        context.assertNotCancelled();
        const input = step.inputMapper ? step.inputMapper(context) : undefined;
        const result = await step.agent.execute(input, context);

        if (step.outputKey && result.success) {
          context.results.set(step.outputKey, result.data);
        }

        onProgress?.(this.getProgress());
        return result;
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          durationMs: 0,
        } as AgentResult;
      } finally {
        semaphore.release();
      }
    });

    return Promise.all(resultPromises);
  }

  getProgress(): PipelineProgress {
    const stepProgresses = this.steps.map((s) => s.agent.getProgress());
    return {
      pipelineId: this.id,
      pipelineName: this.name,
      totalSteps: this.steps.length,
      completedSteps: stepProgresses.filter((p) => p.status === 'completed').length,
      failedSteps: stepProgresses.filter((p) => p.status === 'error').length,
      skippedSteps: 0,
      stepProgresses,
    };
  }
}
