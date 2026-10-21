import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getLoggerService } from './logger.service';

const logger = getLoggerService();

const queueUrl = process.env.PROPOSAL_JOB_QUEUE_URL || process.env.JOB_QUEUE_URL || null;
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

let sqsClient: SQSClient | null = null;

if (queueUrl) {
  sqsClient = new SQSClient({ region });
}

export const isProposalQueueEnabled = () => Boolean(queueUrl);

export type ProposalQueueMessage = {
  type: 'proposal';
  jobId: string;
  accessToken?: string | null;
};

export type TranscriptQueueMessage = {
  type: 'transcript';
  analysisId: string;
  accessToken?: string | null;
};

export type AnalysisWorkflowQueueMessage = {
  type: 'analysis-workflow';
  workflowJobId: string;
  accessToken?: string | null;
};

export type BulkAnalysisWorkflowQueueMessage = {
  type: 'bulk-analysis-workflow';
  bulkJobId: string;
  accessToken?: string | null;
};

export type JobQueueMessage =
  | ProposalQueueMessage
  | TranscriptQueueMessage
  | AnalysisWorkflowQueueMessage
  | BulkAnalysisWorkflowQueueMessage;

export async function enqueueProposalJob(message: ProposalQueueMessage): Promise<void> {
  return enqueueJob(message);
}

export async function enqueueTranscriptJob(message: TranscriptQueueMessage): Promise<void> {
  return enqueueJob(message);
}

export async function enqueueAnalysisWorkflowJob(message: AnalysisWorkflowQueueMessage): Promise<void> {
  return enqueueJob(message);
}

export async function enqueueBulkAnalysisWorkflowJob(message: BulkAnalysisWorkflowQueueMessage): Promise<void> {
  return enqueueJob(message);
}

async function enqueueJob(message: JobQueueMessage): Promise<void> {
  if (!queueUrl || !sqsClient) {
    throw new Error('Proposal job queue is not configured');
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
    })
  );

  logger.info('Job enqueued', { type: message.type, queueUrl, jobId: (message as any).jobId, analysisId: (message as any).analysisId });
}
