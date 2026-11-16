import { describe, it, expect } from 'vitest';
import { signUploadSchema } from '@/shared/src';
import { getPresignedUploadUrl, getPresignedReadUrl } from '../lib/storage';

describe('Part 3.4: S3 Storage & Presigned URLs', () => {
  it('validates upload payloads and enforces 5 MB limit and image mimes', () => {
    // Valid JPEG under 5 MB
    const valid = signUploadSchema.safeParse({
      purpose: 'METER_PHOTO',
      mimeType: 'image/jpeg',
      fileSizeBytes: 2 * 1024 * 1024,
    });
    expect(valid.success).toBe(true);

    // Invalid file size > 5 MB
    const tooLarge = signUploadSchema.safeParse({
      purpose: 'METER_PHOTO',
      mimeType: 'image/jpeg',
      fileSizeBytes: 6 * 1024 * 1024,
    });
    expect(tooLarge.success).toBe(false);

    // Invalid mime type
    const invalidMime = signUploadSchema.safeParse({
      purpose: 'TOPUP_SCREENSHOT',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024 * 1024,
    });
    expect(invalidMime.success).toBe(false);
  });

  it('generates presigned PUT and GET URLs', async () => {
    const key = 'METER_PHOTO/user_test_123/sample_photo.jpg';

    const putUrl = await getPresignedUploadUrl(key, 'image/jpeg', 900);
    expect(typeof putUrl).toBe('string');
    expect(putUrl.includes('X-Amz-Signature')).toBe(true);
    expect(putUrl.includes(encodeURIComponent(key)) || putUrl.includes(key)).toBe(true);

    const getUrl = await getPresignedReadUrl(key, 900);
    expect(typeof getUrl).toBe('string');
    expect(getUrl.includes('X-Amz-Signature')).toBe(true);
  });
});
