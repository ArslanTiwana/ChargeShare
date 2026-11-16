import React from 'react';
import { Text, TextStyle } from 'react-native';
import { colors } from '../theme';

export function formatPaisaToRupees(paisa: number): string {
  if (typeof paisa !== 'number' || isNaN(paisa)) return 'Rs 0.00';
  const isNegative = paisa < 0;
  const absPaisa = Math.abs(paisa);
  const rupees = absPaisa / 100;

  const formatted = rupees.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? '-Rs ' : 'Rs '}${formatted}`;
}

export interface MoneyTextProps {
  paisa: number;
  style?: TextStyle;
}

export function MoneyText({ paisa, style }: MoneyTextProps) {
  return (
    <Text style={[{ color: colors.ink, fontWeight: '700' }, style]}>
      {formatPaisaToRupees(paisa)}
    </Text>
  );
}
