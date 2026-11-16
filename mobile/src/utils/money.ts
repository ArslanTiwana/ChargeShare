/**
 * Exact string-based Rupee to Paisa conversion without floating-point inaccuracies.
 * 1 Rupee = 100 Paisa.
 * E.g.:
 *  "45"    -> 4500
 *  "45.5"  -> 4550
 *  "45.05" -> 4505
 *  "0.1"   -> 10
 *  "0.01"  -> 1
 */
export function rupeeStringToPaisa(rupeeStr: string): number {
  if (typeof rupeeStr !== 'string') {
    throw new Error('Input must be a string');
  }

  const trimmed = rupeeStr.trim();
  if (!trimmed) {
    throw new Error('Price is required');
  }

  // Regex strictly matching non-negative integers or decimals up to 2 decimal places
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error('Invalid rupee amount. Maximum 2 decimal places allowed.');
  }

  const [rupeesPart, decimalPart = ''] = trimmed.split('.');
  const paddedDecimal = decimalPart.padEnd(2, '0');

  const rupees = parseInt(rupeesPart, 10);
  const paisaFromDecimal = parseInt(paddedDecimal, 10);

  if (isNaN(rupees) || isNaN(paisaFromDecimal) || rupees < 0) {
    throw new Error('Invalid numeric value');
  }

  const totalPaisa = rupees * 100 + paisaFromDecimal;
  if (!Number.isSafeInteger(totalPaisa) || totalPaisa <= 0) {
    throw new Error('Amount must be a positive integer in paisa');
  }

  return totalPaisa;
}

/**
 * Computes session gross total, commission deduction, and net host earnings.
 * All intermediate and final numbers use strict integer paisa rounding matching backend rules.
 */
export function computeSessionPreview(
  kwh: number,
  rateSnapshotPaisa: number,
  commissionPercent: number
): {
  totalPaisa: number;
  commissionPaisa: number;
  hostNetPaisa: number;
} {
  if (kwh <= 0 || isNaN(kwh) || rateSnapshotPaisa <= 0 || commissionPercent < 0) {
    return {
      totalPaisa: 0,
      commissionPaisa: 0,
      hostNetPaisa: 0,
    };
  }

  const totalPaisa = Math.round(kwh * rateSnapshotPaisa);
  const commissionPaisa = Math.round((totalPaisa * commissionPercent) / 100);
  const hostNetPaisa = Math.max(0, totalPaisa - commissionPaisa);

  return {
    totalPaisa,
    commissionPaisa,
    hostNetPaisa,
  };
}
