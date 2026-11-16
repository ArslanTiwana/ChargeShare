import { apiSuccess, apiError } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { signUploadSchema } from '@/shared/src';
import { getPresignedUploadUrl } from '@/lib/storage';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const data = signUploadSchema.parse(body);

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extMap[data.mimeType] || 'jpg';
    const randomId = crypto.randomBytes(16).toString('hex');
    const objectKey = `${data.purpose}/${user.id}/${randomId}.${extension}`;

    const uploadUrl = await getPresignedUploadUrl(objectKey, data.mimeType, 900);

    return apiSuccess({
      uploadUrl,
      key: objectKey,
      expiresInSeconds: 900,
    });
  } catch (err) {
    return apiError(err);
  }
}
