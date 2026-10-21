import { randomUUID } from 'crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type DeleteObjectCommandInput,
  type GetObjectCommandInput,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PPTX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const DEFAULT_PREFIX = 'pptx';
const DEFAULT_SIGNED_URL_TTL = 900; // seconds

let cachedClient: S3Client | null = null;

export interface UploadPptxOptions {
  buffer: Buffer;
  filename?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface UploadPptxResult {
  bucket: string;
  key: string;
  url: string;
}

export const isPptxStorageConfigured = (): boolean => {
  return Boolean(process.env.AWS_REGION && process.env.S3_PPTX_BUCKET);
};

export const assertPptxStorageConfigured = () => {
  if (!isPptxStorageConfigured()) {
    throw new Error(
      'PPTX storage is not configured. Please set AWS_REGION and S3_PPTX_BUCKET (plus AWS credentials).'
    );
  }
};

const getS3Client = () => {
  if (cachedClient) {
    return cachedClient;
  }

  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error('AWS_REGION is not configured.');
  }

  cachedClient = new S3Client({ region });
  return cachedClient;
};

const sanitizeFilename = (name: string) => {
  return name.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_');
};

const buildObjectKey = (filename?: string) => {
  const prefix = (process.env.S3_PPTX_PREFIX || DEFAULT_PREFIX).replace(/^\/+|\/+$/g, '');
  const dateSegment = new Date().toISOString().slice(0, 10);
  const safeName = sanitizeFilename(filename || 'presentation.pptx');
  const unique = randomUUID();
  const segments = [prefix, dateSegment, `${unique}-${safeName}`].filter(Boolean);
  return segments.join('/');
};

const normalizeMetadata = (
  metadata?: Record<string, string | number | boolean | null | undefined>
): PutObjectCommandInput['Metadata'] => {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [
      key
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, ''),
      String(value),
    ])
    .filter(([key]) => Boolean(key));

  return entries.length ? Object.fromEntries(entries) : undefined;
};

export const uploadPptxToS3 = async (options: UploadPptxOptions): Promise<UploadPptxResult> => {
  assertPptxStorageConfigured();
  const bucket = process.env.S3_PPTX_BUCKET as string;
  const key = buildObjectKey(options.filename);

  const commandInput: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: options.buffer,
    ContentType: PPTX_MIME_TYPE,
    Metadata: normalizeMetadata(options.metadata),
  };

  await getS3Client().send(new PutObjectCommand(commandInput));

  return {
    bucket,
    key,
    url: `s3://${bucket}/${key}`,
  };
};

const clampTtl = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_SIGNED_URL_TTL;
  }
  // AWS max TTL for presigned URLs is 7 days (604800 seconds)
  return Math.min(value, 604800);
};

/**
 * Download a PPTX file from S3 and return as Buffer
 * Used for email attachments
 */
export const downloadPptxFromS3 = async (
  key: string
): Promise<{ buffer: Buffer; filename: string } | null> => {
  if (!key) {
    return null;
  }
  assertPptxStorageConfigured();
  const bucket = process.env.S3_PPTX_BUCKET as string;

  const commandInput: GetObjectCommandInput = {
    Bucket: bucket,
    Key: key,
  };

  try {
    const response = await getS3Client().send(new GetObjectCommand(commandInput));

    if (!response.Body) {
      return null;
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Extract filename from key (last segment after /)
    const keyParts = key.split('/');
    const rawFilename = keyParts[keyParts.length - 1] || 'presentation.pptx';
    // Remove UUID prefix if present (format: uuid-filename.pptx)
    const filename = rawFilename.replace(/^[a-f0-9-]{36}-/, '');

    return { buffer, filename };
  } catch (error) {
    console.error('Error downloading PPTX from S3:', error);
    return null;
  }
};

export const deletePptxFromS3 = async (key: string | null | undefined): Promise<boolean> => {
  if (!key) return false;
  if (!isPptxStorageConfigured()) return false;

  const bucket = process.env.S3_PPTX_BUCKET as string;
  const commandInput: DeleteObjectCommandInput = {
    Bucket: bucket,
    Key: key,
  };

  try {
    await getS3Client().send(new DeleteObjectCommand(commandInput));
    return true;
  } catch (error) {
    console.error('Error deleting PPTX from S3:', error);
    return false;
  }
};

export const createPptxSignedUrl = async (
  key: string | null | undefined
): Promise<string | null> => {
  if (!key) {
    return null;
  }
  assertPptxStorageConfigured();
  const bucket = process.env.S3_PPTX_BUCKET as string;
  const ttl = clampTtl(Number(process.env.S3_PPTX_SIGNED_URL_TTL || DEFAULT_SIGNED_URL_TTL));

  const commandInput: GetObjectCommandInput = {
    Bucket: bucket,
    Key: key,
  };

  const command = new GetObjectCommand(commandInput);
  return getSignedUrl(getS3Client(), command, { expiresIn: ttl });
};
