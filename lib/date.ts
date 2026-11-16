export const KARACHI_TIMEZONE = 'Asia/Karachi';

/**
 * Returns UTC Date objects for the start and end of a given YYYY-MM-DD day
 * in the Asia/Karachi (UTC+5) timezone.
 */
export function getKarachiDayRange(dateStr: string): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date(`${dateStr}T00:00:00.000+05:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999+05:00`);

  if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
    throw new Error('Invalid date string provided for Karachi day range');
  }

  return { startOfDay, endOfDay };
}
