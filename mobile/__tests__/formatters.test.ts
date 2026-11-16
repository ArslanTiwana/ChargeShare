import { formatPaisaToRupees } from '../src/components/MoneyText';

describe('Mobile Formatters: formatPaisaToRupees', () => {
  it('formats positive paisa to localized Pakistani Rupee string', () => {
    expect(formatPaisaToRupees(123450)).toBe('Rs 1,234.50');
    expect(formatPaisaToRupees(50000)).toBe('Rs 500.00');
    expect(formatPaisaToRupees(99)).toBe('Rs 0.99');
  });

  it('formats zero or invalid amounts safely', () => {
    expect(formatPaisaToRupees(0)).toBe('Rs 0.00');
    // @ts-expect-error test non-number
    expect(formatPaisaToRupees(null)).toBe('Rs 0.00');
    // @ts-expect-error test undefined
    expect(formatPaisaToRupees(undefined)).toBe('Rs 0.00');
    expect(formatPaisaToRupees(NaN)).toBe('Rs 0.00');
  });

  it('formats negative paisa accurately with minus sign', () => {
    expect(formatPaisaToRupees(-15000)).toBe('-Rs 150.00');
    expect(formatPaisaToRupees(-27788)).toBe('-Rs 277.88');
  });
});
