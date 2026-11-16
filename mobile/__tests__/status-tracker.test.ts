import { BookingStatus } from '../src/api/bookings';

export function getStatusStepIndex(status: BookingStatus): { stepIndex: number; isTerminal: boolean } {
  const steps: BookingStatus[] = [
    'REQUESTED',
    'ACCEPTED',
    'CHARGING',
    'COMPLETED',
    'CONFIRMED',
  ];
  const terminal: BookingStatus[] = ['DECLINED', 'CANCELLED', 'EXPIRED', 'DISPUTED'];

  if (terminal.includes(status)) {
    return { stepIndex: -1, isTerminal: true };
  }
  return { stepIndex: steps.indexOf(status), isTerminal: false };
}

describe('Phase 5b: Status Tracker State Mapping', () => {
  it('maps sequential active steps (0 to 4)', () => {
    expect(getStatusStepIndex('REQUESTED')).toEqual({ stepIndex: 0, isTerminal: false });
    expect(getStatusStepIndex('ACCEPTED')).toEqual({ stepIndex: 1, isTerminal: false });
    expect(getStatusStepIndex('CHARGING')).toEqual({ stepIndex: 2, isTerminal: false });
    expect(getStatusStepIndex('COMPLETED')).toEqual({ stepIndex: 3, isTerminal: false });
    expect(getStatusStepIndex('CONFIRMED')).toEqual({ stepIndex: 4, isTerminal: false });
  });

  it('marks terminal states with isTerminal: true and stepIndex: -1', () => {
    expect(getStatusStepIndex('DECLINED')).toEqual({ stepIndex: -1, isTerminal: true });
    expect(getStatusStepIndex('CANCELLED')).toEqual({ stepIndex: -1, isTerminal: true });
    expect(getStatusStepIndex('EXPIRED')).toEqual({ stepIndex: -1, isTerminal: true });
    expect(getStatusStepIndex('DISPUTED')).toEqual({ stepIndex: -1, isTerminal: true });
  });
});
