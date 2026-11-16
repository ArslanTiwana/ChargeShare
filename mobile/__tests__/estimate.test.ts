import { formatPaisaToRupees } from '../src/components/MoneyText';

export function calculateEstimate(powerKw: number, durationHours: number, ratePaisa: number) {
  const kwh = Number((powerKw * durationHours).toFixed(2));
  const costPaisa = Math.round(kwh * ratePaisa);
  return { kwh, costPaisa };
}

describe('Phase 5b: Charging Session Estimate Calculation', () => {
  it('correctly calculates kWh delivered from power and hours', () => {
    // 22 kW charger for 2 hours = 44 kWh
    const est = calculateEstimate(22.0, 2, 6500);
    expect(est.kwh).toBe(44.0);
    expect(est.costPaisa).toBe(44.0 * 6500); // 286,000 paisa = Rs 2,860.00
    expect(formatPaisaToRupees(est.costPaisa)).toBe('Rs 2,860.00');
  });

  it('handles fractional power and non-integer durations accurately', () => {
    // 7.4 kW charger for 3 hours at 7200 paisa/kWh
    const est = calculateEstimate(7.4, 3, 7200);
    expect(est.kwh).toBe(22.2);
    expect(est.costPaisa).toBe(Math.round(22.2 * 7200)); // 159,840 paisa = Rs 1,598.40
    expect(formatPaisaToRupees(est.costPaisa)).toBe('Rs 1,598.40');
  });

  it('never returns negative values or NaN for valid inputs', () => {
    const est = calculateEstimate(11.0, 1, 5000);
    expect(est.kwh).toBe(11.0);
    expect(est.costPaisa).toBe(55000); // Rs 550.00
    expect(formatPaisaToRupees(est.costPaisa)).toBe('Rs 550.00');
  });
});
