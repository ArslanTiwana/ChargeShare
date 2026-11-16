import { rupeeStringToPaisa } from '../src/utils/money';

describe('Rupee String to Paisa Conversion (String-based Exact Parsing)', () => {
  it('converts whole rupee amounts accurately', () => {
    expect(rupeeStringToPaisa('45')).toBe(4500);
    expect(rupeeStringToPaisa('100')).toBe(10000);
    expect(rupeeStringToPaisa('1')).toBe(100);
  });

  it('converts 1 decimal place rupee amounts (e.g. 45.5 -> 4550 paisa)', () => {
    expect(rupeeStringToPaisa('45.5')).toBe(4550);
    expect(rupeeStringToPaisa('0.1')).toBe(10);
    expect(rupeeStringToPaisa('10.9')).toBe(1090);
  });

  it('converts 2 decimal place rupee amounts (e.g. 45.05 -> 4505 paisa)', () => {
    expect(rupeeStringToPaisa('45.05')).toBe(4505);
    expect(rupeeStringToPaisa('0.01')).toBe(1);
    expect(rupeeStringToPaisa('99.99')).toBe(9999);
  });

  it('handles surrounding whitespace', () => {
    expect(rupeeStringToPaisa('  45.50  ')).toBe(4550);
  });

  it('rejects invalid, negative, or excessive precision inputs', () => {
    // Non-string or empty
    expect(() => rupeeStringToPaisa(null as any)).toThrow();
    expect(() => rupeeStringToPaisa('')).toThrow();
    expect(() => rupeeStringToPaisa('   ')).toThrow();

    // Negative
    expect(() => rupeeStringToPaisa('-45')).toThrow();
    expect(() => rupeeStringToPaisa('-0.5')).toThrow();

    // More than 2 decimals (fraction of a paisa)
    expect(() => rupeeStringToPaisa('45.555')).toThrow(/maximum 2 decimal places/i);
    expect(() => rupeeStringToPaisa('1.234')).toThrow(/maximum 2 decimal places/i);

    // Non-numeric
    expect(() => rupeeStringToPaisa('abc')).toThrow();
    expect(() => rupeeStringToPaisa('45.a')).toThrow();
    expect(() => rupeeStringToPaisa('45..5')).toThrow();
    expect(() => rupeeStringToPaisa('0')).toThrow(/positive integer/i);
  });
});
