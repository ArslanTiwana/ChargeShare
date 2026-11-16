import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';

export async function GET() {
  try {
    const configs = await db.appConfig.findMany();
    const configMap = new Map(configs.map((c) => [c.key, c.value]));

    return apiSuccess({
      minBookingDurationHours: parseInt(configMap.get('minBookingDurationHours') || '1', 10),
      maxBookingDurationHours: parseInt(configMap.get('maxBookingDurationHours') || '8', 10),
      bookingExpiryMinutes: parseInt(configMap.get('bookingExpiryMinutes') || '30', 10),
      autoConfirmHours: parseInt(configMap.get('autoConfirmHours') || '24', 10),
      minTopupPaisa: parseInt(configMap.get('minTopupPaisa') || '50000', 10),
      maxTopupPaisa: parseInt(configMap.get('maxTopupPaisa') || '50000000', 10),
      maxSessionKwh: parseFloat(configMap.get('maxSessionKwh') || '150'),
      startWindowMinutes: parseInt(configMap.get('startWindowMinutes') || '30', 10),
      topupInstructions:
        configMap.get('topupInstructions') ||
        'Transfer funds to Easypaisa / JazzCash account: 0300-1234567 (Title: ChargeShare Admin). Save your transaction ID and upload a screenshot.',
      hostMinWalletWarningPaisa: parseInt(configMap.get('hostMinWalletWarningPaisa') || '50000', 10),
    });
  } catch (err) {
    return apiError(err);
  }
}
