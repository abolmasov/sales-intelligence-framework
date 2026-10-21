import 'dotenv/config';
import { ReceiveMessageCommand, DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { processProposalJob } from './services/proposalJob.service';
import { processTranscriptJob } from './services/transcriptJob.service';
import { processAnalysisWorkflowJob } from './services/analysisWorkflowJob.service';
import { processBulkAnalysisJob } from './services/bulkAnalysisJob.service';
import { getLoggerService } from './services/logger.service';

const logger = getLoggerService();
const queueUrl = process.env.PROPOSAL_JOB_QUEUE_URL || process.env.JOB_QUEUE_URL;
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

if (!queueUrl) {
  throw new Error('Missing PROPOSAL_JOB_QUEUE_URL (or JOB_QUEUE_URL) environment variable.');
}

const sqs = new SQSClient({ region });

const visibilityTimeout = Number(process.env.PROPOSAL_JOB_VISIBILITY || 1800);
const waitTimeSeconds = Number(process.env.PROPOSAL_JOB_WAIT || 20);

async function pollQueue() {
  logger.info('Worker started. Listening for jobs...', { queueUrl });

  while (true) {
    const response = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: waitTimeSeconds,
        VisibilityTimeout: visibilityTimeout,
      })
    );

    const messages = response.Messages;
    if (!messages || messages.length === 0) {
      continue;
    }

    for (const message of messages) {
      if (!message.Body) {
        logger.warn('Received empty SQS message body', { messageId: message.MessageId });
        await deleteMessage(message.ReceiptHandle);
        continue;
      }

      try {
        const payload = JSON.parse(message.Body);
        if (payload.type === 'proposal' && payload.jobId) {
          logger.info('Processing proposal job from queue', { jobId: payload.jobId });
          await processProposalJob(payload.jobId, payload.accessToken || null);
          await deleteMessage(message.ReceiptHandle);
        } else if (payload.type === 'transcript' && payload.analysisId) {
          logger.info('Processing transcript job from queue', { analysisId: payload.analysisId });
          await processTranscriptJob(payload.analysisId, payload.accessToken || null);
          await deleteMessage(message.ReceiptHandle);
        } else if (payload.type === 'analysis-workflow' && payload.workflowJobId) {
          logger.info('Processing analysis workflow job from queue', { workflowJobId: payload.workflowJobId });
          await processAnalysisWorkflowJob(payload.workflowJobId, payload.accessToken || null);
          await deleteMessage(message.ReceiptHandle);
        } else if (payload.type === 'bulk-analysis-workflow' && payload.bulkJobId) {
          logger.info('Processing bulk analysis workflow job from queue', { bulkJobId: payload.bulkJobId });
          await processBulkAnalysisJob(payload.bulkJobId, payload.accessToken || null);
          await deleteMessage(message.ReceiptHandle);
        } else {
          logger.warn('Unknown message type in queue', { payload });
          await deleteMessage(message.ReceiptHandle);
        }
      } catch (error) {
        logger.error('Failed to process queued job', error, {
          messageId: message.MessageId,
        });
        // Let SQS retry by NOT deleting the message
      }
    }
  }
}

async function deleteMessage(receiptHandle?: string) {
  if (!receiptHandle) return;
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl!,
      ReceiptHandle: receiptHandle,
    })
  );
}

pollQueue().catch((error) => {
  logger.error('Worker encountered fatal error', error);
  process.exit(1);
});
