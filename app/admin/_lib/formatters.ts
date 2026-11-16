/**
 * Money and Date formatting helpers for ChargeShare Admin UI
 */

/**
 * Formats integer paisa into Pakistani Rupees string: "Rs 1,234.50"
 */
export function formatPaisa(paisa: number | null | undefined): string {
  if (paisa === null || paisa === undefined || isNaN(paisa)) {
    return 'Rs 0.00';
  }

  const isNegative = paisa < 0;
  const absPaisa = Math.abs(paisa);
  const rupees = absPaisa / 100;

  const formatted = rupees.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? '-' : ''}Rs ${formatted}`;
}

/**
 * Formats a date into Asia/Karachi (PKT, UTC+5) display string
 */
export function formatKarachiDate(
  dateInput: string | Date | null | undefined,
  includeTime = true
): string {
  if (!dateInput) return '—';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '—';

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Karachi',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
  };

  return new Intl.DateTimeFormat('en-PK', options).format(date);
}

/**
 * Formats kWh quantity (e.g., 28.5 -> "28.50 kWh")
 */
export function formatKwh(kwh: number | string | null | undefined): string {
  if (kwh === null || kwh === undefined) return '0.00 kWh';
  const num = typeof kwh === 'string' ? parseFloat(kwh) : kwh;
  if (isNaN(num)) return '0.00 kWh';
  return `${num.toFixed(2)} kWh`;
}
