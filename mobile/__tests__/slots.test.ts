import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { BookedSlot } from '../src/api/chargers';

const TIMEZONE = 'Asia/Karachi';

export function isSlotAvailable(
  dateStr: string,
  timeHHMM: string,
  durationHours: number,
  bookedSlots: BookedSlot[],
  referenceNowTimeMs: number
): { isAvailable: boolean; reason?: string } {
  const slotStart = fromZonedTime(`${dateStr} ${timeHHMM}:00`, TIMEZONE);
  const slotEnd = new Date(slotStart.getTime() + durationHours * 3600 * 1000);

  // Buffer: must be at least 15 min in the future
  if (slotStart.getTime() <= referenceNowTimeMs + 15 * 60 * 1000) {
    return { isAvailable: false, reason: 'Past' };
  }

  // Check overlap with active bookedSlots
  const hasOverlap = bookedSlots.some((b) => {
    const bStart = new Date(b.startsAt).getTime();
    const bEnd = new Date(b.endsAt).getTime();
    return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
  });

  if (hasOverlap) {
    return { isAvailable: false, reason: 'Occupied' };
  }

  return { isAvailable: true };
}

describe('Phase 5b: Slot Generation and Availability in Asia/Karachi (UTC+5)', () => {
  const testDate = '2026-11-20';
  // Suppose reference now is 2026-11-20 08:00:00 Asia/Karachi (03:00 UTC)
  const nowInKarachiMs = fromZonedTime('2026-11-20 08:00:00', TIMEZONE).getTime();

  it('correctly maps Asia/Karachi local time to UTC', () => {
    // Karachi 14:00 is 09:00 UTC
    const d = fromZonedTime('2026-11-20 14:00:00', TIMEZONE);
    expect(d.toISOString()).toBe('2026-11-20T09:00:00.000Z');
    expect(formatInTimeZone(d, TIMEZONE, 'HH:mm')).toBe('14:00');
  });

  it('disables slots that are in the past or within 15 min buffer', () => {
    // 06:00 and 07:00 are in the past relative to 08:00
    expect(isSlotAvailable(testDate, '06:00', 2, [], nowInKarachiMs)).toEqual({
      isAvailable: false,
      reason: 'Past',
    });
    expect(isSlotAvailable(testDate, '07:00', 2, [], nowInKarachiMs)).toEqual({
      isAvailable: false,
      reason: 'Past',
    });
    // 08:00 is within 15 min buffer (0 minutes in future)
    expect(isSlotAvailable(testDate, '08:00', 2, [], nowInKarachiMs)).toEqual({
      isAvailable: false,
      reason: 'Past',
    });
  });

  it('enables slots in the future when no overlapping bookedSlots exist', () => {
    // 10:00 is in the future and free
    expect(isSlotAvailable(testDate, '10:00', 2, [], nowInKarachiMs)).toEqual({
      isAvailable: true,
    });
  });

  it('correctly detects overlap and disables booked slots', () => {
    // Existing booking from 14:00 to 16:00 Asia/Karachi
    const bookedSlot: BookedSlot = {
      bookingId: 'b_123',
      startsAt: fromZonedTime('2026-11-20 14:00:00', TIMEZONE).toISOString(),
      endsAt: fromZonedTime('2026-11-20 16:00:00', TIMEZONE).toISOString(),
      status: 'ACCEPTED',
    };

    // Slot 13:00 with 2h duration ends at 15:00 -> overlaps (14:00 to 15:00)
    expect(isSlotAvailable(testDate, '13:00', 2, [bookedSlot], nowInKarachiMs)).toEqual({
      isAvailable: false,
      reason: 'Occupied',
    });

    // Slot 14:00 with 2h duration -> overlaps completely
    expect(isSlotAvailable(testDate, '14:00', 2, [bookedSlot], nowInKarachiMs)).toEqual({
      isAvailable: false,
      reason: 'Occupied',
    });

    // Slot 15:00 with 2h duration starts at 15:00 (< 16:00) -> overlaps
    expect(isSlotAvailable(testDate, '15:00', 2, [bookedSlot], nowInKarachiMs)).toEqual({
      isAvailable: false,
      reason: 'Occupied',
    });

    // Slot 16:00 with 2h duration starts at 16:00 (exact boundary when previous ends) -> free
    expect(isSlotAvailable(testDate, '16:00', 2, [bookedSlot], nowInKarachiMs)).toEqual({
      isAvailable: true,
    });

    // Slot 12:00 with 2h duration ends at 14:00 (exact boundary when next begins) -> free
    expect(isSlotAvailable(testDate, '12:00', 2, [bookedSlot], nowInKarachiMs)).toEqual({
      isAvailable: true,
    });
  });

  it('handles midnight and day boundary in Asia/Karachi (UTC-5 offset boundary)', () => {
    // 23:00 Karachi time on 2026-11-20 is 18:00 UTC on 2026-11-20
    const slot23 = fromZonedTime('2026-11-20 23:00:00', TIMEZONE);
    expect(slot23.toISOString()).toBe('2026-11-20T18:00:00.000Z');

    // Slot 23:00 with 2h duration ends at 01:00 on 2026-11-21 in Karachi (20:00 UTC on 2026-11-20)
    const slotEnd = new Date(slot23.getTime() + 2 * 3600 * 1000);
    expect(formatInTimeZone(slotEnd, TIMEZONE, 'yyyy-MM-dd HH:mm')).toBe('2026-11-21 01:00');
  });

  it('formats booking card dates with bullet separator safely without throwing unescaped latin character RangeError', () => {
    const date = new Date('2026-11-20T10:00:00.000Z');
    const datePart = formatInTimeZone(date, TIMEZONE, 'EEE, d MMM yyyy');
    const timePart = formatInTimeZone(date, TIMEZONE, 'HH:mm');
    const combined = `${datePart} • ${timePart}`;

    expect(combined).toMatch(/Fri, 20 Nov 2026 • 15:00/);
    expect(() => {
      formatInTimeZone(date, TIMEZONE, 'EEE, d MMM yyyy');
    }).not.toThrow();
  });
});
