import { computeSessionPreview } from '../src/utils/money';

describe('Session Total & Commission Preview Math', () => {
  it('matches backend integer paisa rounding exactly (Case 1: 28.5 kWh @ 6500 paisa, 15% commission)', () => {
    // 28.5 * 6500 = 185,250 paisa (Rs 1,852.50)
    // 185,250 * 0.15 = 27,787.5 -> rounded to 27,788 paisa (Rs 277.88)
    // Net: 185,250 - 27,788 = 157,462 paisa (Rs 1,574.62)
    const result = computeSessionPreview(28.5, 6500, 15);

    expect(result.totalPaisa).toBe(185250);
    expect(result.commissionPaisa).toBe(27788);
    expect(result.hostNetPaisa).toBe(157462);
    expect(Number.isInteger(result.totalPaisa)).toBe(true);
    expect(Number.isInteger(result.commissionPaisa)).toBe(true);
    expect(Number.isInteger(result.hostNetPaisa)).toBe(true);
  });

  it('matches backend integer paisa rounding (Case 2: 12.333 kWh @ 7200 paisa, 15% commission)', () => {
    // 12.333 * 7200 = 88,797.6 -> rounded to 88,798 paisa
    // 88,798 * 0.15 = 13,319.7 -> rounded to 13,320 paisa
    // Net: 88,798 - 13,320 = 75,478 paisa
    const result = computeSessionPreview(12.333, 7200, 15);

    expect(result.totalPaisa).toBe(88798);
    expect(result.commissionPaisa).toBe(13320);
    expect(result.hostNetPaisa).toBe(75478);
  });

  it('safely handles zero or negative inputs', () => {
    expect(computeSessionPreview(0, 6500, 15)).toEqual({
      totalPaisa: 0,
      commissionPaisa: 0,
      hostNetPaisa: 0,
    });

    expect(computeSessionPreview(-5, 6500, 15)).toEqual({
      totalPaisa: 0,
      commissionPaisa: 0,
      hostNetPaisa: 0,
    });

    expect(computeSessionPreview(10, -5000, 15)).toEqual({
      totalPaisa: 0,
      commissionPaisa: 0,
      hostNetPaisa: 0,
    });
  });
});
