import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const bucket = process.env.STORAGE_BUCKET || 'chargeshare-media';
const rawEndpoint = process.env.STORAGE_ENDPOINT;
const endpoint = rawEndpoint && !rawEndpoint.includes('<') && !rawEndpoint.includes('>') ? rawEndpoint : undefined;
const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID || 'dummy-access-key';
const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY || 'dummy-secret-key';
const region = process.env.STORAGE_REGION || 'auto';

export const s3 = new S3Client({
  endpoint: endpoint || undefined,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
});

/**
 * Generates a presigned PUT URL for uploading an image directly to storage.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900 // 15 minutes
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Generates a short-lived presigned GET URL for viewing private photos.
 */
export async function getPresignedReadUrl(
  key: string,
  expiresInSeconds = 900 // 15 minutes
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

export async function checkObjectExists(key: string): Promise<boolean> {
  if (
    !process.env.STORAGE_ENDPOINT ||
    process.env.STORAGE_ENDPOINT.includes('<account-id>') ||
    process.env.NODE_ENV === 'test'
  ) {
    return true;
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await s3.send(command);
    return true;
  } catch {
    return false;
  }
}

