import { describe, it, expect } from 'vitest';
import { formatPaisa, formatKarachiDate, formatKwh } from '../app/admin/_lib/formatters';

describe('Admin Formatters (Money & Date)', () => {
  describe('formatPaisa', () => {
    it('formats positive paisa to Rs string with thousands separator', () => {
      expect(formatPaisa(123450)).toBe('Rs 1,234.50');
      expect(formatPaisa(500000)).toBe('Rs 5,000.00');
      expect(formatPaisa(100)).toBe('Rs 1.00');
      expect(formatPaisa(25)).toBe('Rs 0.25');
    });

    it('formats 0 or falsy inputs properly', () => {
      expect(formatPaisa(0)).toBe('Rs 0.00');
      expect(formatPaisa(null)).toBe('Rs 0.00');
      expect(formatPaisa(undefined)).toBe('Rs 0.00');
    });

    it('formats negative paisa (deductions / adjustments) accurately', () => {
      expect(formatPaisa(-27788)).toBe('-Rs 277.88');
      expect(formatPaisa(-500000)).toBe('-Rs 5,000.00');
    });
  });

  describe('formatKarachiDate', () => {
    it('formats UTC ISO timestamp in Asia/Karachi (UTC+5) timezone', () => {
      // 2026-11-15 07:00:00 UTC is 2026-11-15 12:00:00 PM PKT
      const dateStr = '2026-11-15T07:00:00.000Z';
      const formatted = formatKarachiDate(dateStr);
      expect(formatted).toContain('15 Nov 2026');
      expect(formatted).toContain('12:00');
    });

    it('handles null, undefined or invalid dates safely', () => {
      expect(formatKarachiDate(null)).toBe('—');
      expect(formatKarachiDate(undefined)).toBe('—');
      expect(formatKarachiDate('invalid-date')).toBe('—');
    });
  });

  describe('formatKwh', () => {
    it('formats kWh values with two decimals', () => {
      expect(formatKwh(28.5)).toBe('28.50 kWh');
      expect(formatKwh('12.333')).toBe('12.33 kWh');
      expect(formatKwh(0)).toBe('0.00 kWh');
      expect(formatKwh(null)).toBe('0.00 kWh');
    });
  });
});
