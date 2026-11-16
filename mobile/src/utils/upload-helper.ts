import * as ImageManipulator from 'expo-image-manipulator';
import { apiFetch } from '../api/client';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_DIMENSION_PX = 1600;

export interface SignedUrlResponse {
  uploadUrl: string;
  key: string;
  expiresInSeconds: number;
}

/**
 * Resizes and compresses image to max 1600px JPEG.
 * Re-encoding strips EXIF metadata (including location).
 */
export async function compressAndStripExif(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION_PX } }],
    {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return result.uri;
}

/**
 * Uploads a local file URI to storage using presigned URL with retry and re-signing support.
 */
export async function uploadImageWithSignedUrl(
  localUri: string,
  purpose: 'METER_PHOTO' | 'TOPUP_SCREENSHOT',
  onProgress?: (progress: number) => void
): Promise<string> {
  // 1. Compress & strip EXIF
  const processedUri = await compressAndStripExif(localUri);

  // 2. Read as blob
  const response = await fetch(processedUri);
  const blob = await response.blob();

  if (blob.size > MAX_PHOTO_BYTES) {
    throw new Error('Image exceeds 5 MB limit after compression.');
  }

  // 3. Request signed URL and upload with retry
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      if (onProgress) onProgress(0.2);

      const signRes = await apiFetch<SignedUrlResponse>('/uploads/sign', {
        method: 'POST',
        body: JSON.stringify({
          purpose,
          mimeType: 'image/jpeg',
          fileSizeBytes: blob.size,
          sizeBytes: blob.size,
        }),
      });

      if (onProgress) onProgress(0.5);

      const putRes = await fetch(signRes.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: blob,
      });

      if (!putRes.ok) {
        throw new Error(`Upload failed with status ${putRes.status}`);
      }

      if (onProgress) onProgress(1.0);
      return signRes.key;
    } catch (err: any) {
      if (__DEV__) {
        console.warn(`[UploadHelper] Attempt ${attempts} failed:`, err?.message || err);
      }
      if (attempts >= maxAttempts) {
        throw new Error(err?.message || 'Failed to upload image. Please check your connection and try again.');
      }
    }
  }

  throw new Error('Upload failed.');
}
