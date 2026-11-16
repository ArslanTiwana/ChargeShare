describe('Wallet Low-Balance and Zero-Balance Banner Rules', () => {
  const getBannerState = (balancePaisa: number, warningThresholdPaisa = 50000) => {
    const isZeroOrNegative = balancePaisa <= 0;
    const isLowBalance = balancePaisa > 0 && balancePaisa < warningThresholdPaisa;
    const isHealthy = balancePaisa >= warningThresholdPaisa;

    return {
      showBlockingBanner: isZeroOrNegative,
      showWarningBanner: isLowBalance,
      isHealthy,
    };
  };

  it('triggers blocking banner at 0 paisa', () => {
    const state = getBannerState(0, 50000);
    expect(state.showBlockingBanner).toBe(true);
    expect(state.showWarningBanner).toBe(false);
    expect(state.isHealthy).toBe(false);
  });

  it('triggers blocking banner when negative (e.g. commission deducted past 0)', () => {
    const state = getBannerState(-1500, 50000);
    expect(state.showBlockingBanner).toBe(true);
    expect(state.showWarningBanner).toBe(false);
    expect(state.isHealthy).toBe(false);
  });

  it('triggers low-balance warning banner when positive but below warning threshold', () => {
    const state = getBannerState(25000, 50000); // Rs 250 (below Rs 500 threshold)
    expect(state.showBlockingBanner).toBe(false);
    expect(state.showWarningBanner).toBe(true);
    expect(state.isHealthy).toBe(false);
  });

  it('triggers neither banner when balance meets or exceeds warning threshold', () => {
    const stateExact = getBannerState(50000, 50000);
    expect(stateExact.showBlockingBanner).toBe(false);
    expect(stateExact.showWarningBanner).toBe(false);
    expect(stateExact.isHealthy).toBe(true);

    const stateHigh = getBannerState(150000, 50000);
    expect(stateHigh.showBlockingBanner).toBe(false);
    expect(stateHigh.showWarningBanner).toBe(false);
    expect(stateHigh.isHealthy).toBe(true);
  });
});
