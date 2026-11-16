import { z } from 'zod';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const signUploadSchema = z
  .object({
    purpose: z.enum(['METER_PHOTO', 'TOPUP_SCREENSHOT']),
    mimeType: z.enum(ALLOWED_MIME_TYPES, {
      errorMap: () => ({ message: 'Only JPEG, PNG, and WebP images are permitted' }),
    }),
    fileSizeBytes: z
      .number()
      .int()
      .positive()
      .max(MAX_UPLOAD_SIZE_BYTES, 'Maximum allowed file size is 5 MB')
      .optional(),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(MAX_UPLOAD_SIZE_BYTES, 'Maximum allowed file size is 5 MB')
      .optional(),
  })
  .refine((data) => data.fileSizeBytes != null || data.sizeBytes != null, {
    message: 'fileSizeBytes is required',
    path: ['fileSizeBytes'],
  })
  .transform((data) => ({
    purpose: data.purpose,
    mimeType: data.mimeType,
    fileSizeBytes: (data.fileSizeBytes ?? data.sizeBytes) as number,
  }));
export type SignUploadInput = z.infer<typeof signUploadSchema>;

export const readUrlQuerySchema = z.object({
  key: z.string().trim().min(1, 'Object key is required'),
});
export type ReadUrlQuery = z.infer<typeof readUrlQuerySchema>;
