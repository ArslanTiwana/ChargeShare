export interface BookingErrorMapping {
  title: string;
  message: string;
  action?: 'profile' | 'refetch';
}

export function mapBookingErrorCode(
  code?: string,
  fallbackMessage?: string
): BookingErrorMapping {
  switch (code) {
    case 'PHONE_REQUIRED':
      return {
        title: 'Phone Number Required',
        message: 'A phone number is required before requesting a charger booking so hosts can coordinate arrival.',
        action: 'profile',
      };
    case 'DUPLICATE_BOOKING':
      return {
        title: 'Booking Overlap',
        message: 'You already have an active or requested booking for this charger during this time slot.',
      };
    case 'SLOT_OCCUPIED':
      return {
        title: 'Slot Unavailable',
        message: 'This time slot was just booked by another driver. Please choose a different time.',
        action: 'refetch',
      };
    case 'CHARGER_UNAVAILABLE':
    case 'HOST_UNAVAILABLE':
      return {
        title: 'Unavailable',
        message: 'This charger or host account is currently not accepting new bookings.',
      };
    case 'HOST_ZERO_BALANCE':
      return {
        title: 'Host Limit Reached',
        message: 'This host cannot accept bookings right now due to wallet balance limits.',
      };
    case 'NOT_FOUND':
      return {
        title: 'Not Found',
        message: 'The requested charger or slot could not be found.',
      };
    case 'FORBIDDEN':
      return {
        title: 'Unauthorized',
        message: 'You do not have permission to book this charger.',
      };
    default:
      return {
        title: 'Booking Failed',
        message: fallbackMessage || 'Could not submit booking request.',
      };
  }
}
