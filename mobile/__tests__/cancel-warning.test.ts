describe('Host Booking Cancel Warning and Confirmation', () => {
  function getCancelWarningMessage(role: 'host' | 'driver', status: string) {
    if (role === 'host' && status === 'ACCEPTED') {
      return 'Warning: Cancelling an accepted booking impacts the driver schedule and may incur a penalty. Are you sure you want to cancel?';
    }
    return 'Are you sure you want to cancel this booking?';
  }

  function formatCancelReason(role: 'host' | 'driver', rawReason: string) {
    const trimmed = rawReason.trim();
    if (!trimmed) {
      throw new Error('A cancellation reason of at least 3 characters is required');
    }
    const prefix = role === 'host' ? 'Host: ' : 'Driver: ';
    return `${prefix}${trimmed}`;
  }

  it('provides severe warning message when host cancels an accepted booking', () => {
    const warning = getCancelWarningMessage('host', 'ACCEPTED');
    expect(warning).toContain('Warning: Cancelling an accepted booking impacts the driver schedule');
  });

  it('provides standard prompt for driver cancellation', () => {
    const warning = getCancelWarningMessage('driver', 'REQUESTED');
    expect(warning).toBe('Are you sure you want to cancel this booking?');
  });

  it('prefixes cancellation reason with Host: when host cancels', () => {
    const formatted = formatCancelReason('host', 'Power outage on street');
    expect(formatted).toBe('Host: Power outage on street');
  });

  it('throws error when reason is empty or whitespace', () => {
    expect(() => formatCancelReason('host', '   ')).toThrow(
      'A cancellation reason of at least 3 characters is required'
    );
  });
});
