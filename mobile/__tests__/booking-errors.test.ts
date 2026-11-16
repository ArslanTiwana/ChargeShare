import { mapBookingErrorCode } from '../src/utils/booking-errors';

describe('Booking Error Code Mapping', () => {
  it('maps PHONE_REQUIRED with profile redirect action', () => {
    const res = mapBookingErrorCode('PHONE_REQUIRED');
    expect(res.title).toBe('Phone Number Required');
    expect(res.message).toMatch(/phone number is required/i);
    expect(res.action).toBe('profile');
  });

  it('maps DUPLICATE_BOOKING with overlap explanation', () => {
    const res = mapBookingErrorCode('DUPLICATE_BOOKING');
    expect(res.title).toBe('Booking Overlap');
    expect(res.message).toMatch(/already have an active or requested booking/i);
    expect(res.action).toBeUndefined();
  });

  it('maps SLOT_OCCUPIED with refetch action', () => {
    const res = mapBookingErrorCode('SLOT_OCCUPIED');
    expect(res.title).toBe('Slot Unavailable');
    expect(res.message).toMatch(/just booked by another driver/i);
    expect(res.action).toBe('refetch');
  });

  it('maps CHARGER_UNAVAILABLE and HOST_UNAVAILABLE correctly', () => {
    const resCharger = mapBookingErrorCode('CHARGER_UNAVAILABLE');
    expect(resCharger.title).toBe('Unavailable');
    expect(resCharger.message).toMatch(/not accepting new bookings/i);

    const resHost = mapBookingErrorCode('HOST_UNAVAILABLE');
    expect(resHost.title).toBe('Unavailable');
    expect(resHost.message).toMatch(/not accepting new bookings/i);
  });

  it('maps HOST_ZERO_BALANCE with host limit explanation', () => {
    const res = mapBookingErrorCode('HOST_ZERO_BALANCE');
    expect(res.title).toBe('Host Limit Reached');
    expect(res.message).toMatch(/wallet balance limits/i);
  });

  it('maps NOT_FOUND and FORBIDDEN error codes', () => {
    const resNotFound = mapBookingErrorCode('NOT_FOUND');
    expect(resNotFound.title).toBe('Not Found');

    const resForbidden = mapBookingErrorCode('FORBIDDEN');
    expect(resForbidden.title).toBe('Unauthorized');
  });

  it('falls back to custom message or default message for unknown codes', () => {
    const resWithCustom = mapBookingErrorCode('UNKNOWN_CODE', 'Custom server error');
    expect(resWithCustom.title).toBe('Booking Failed');
    expect(resWithCustom.message).toBe('Custom server error');

    const resDefault = mapBookingErrorCode(undefined);
    expect(resDefault.title).toBe('Booking Failed');
    expect(resDefault.message).toBe('Could not submit booking request.');
  });
});
