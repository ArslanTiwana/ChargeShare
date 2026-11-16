import React from 'react';
import { formatPaisa } from '../_lib/formatters';

interface MoneyTextProps {
  paisa: number | null | undefined;
  className?: string;
  colored?: boolean;
}

export function MoneyText({ paisa, className = '', colored = false }: MoneyTextProps) {
  const formatted = formatPaisa(paisa);

  let colorClass = '';
  if (colored && paisa !== null && paisa !== undefined) {
    if (paisa > 0) {
      colorClass = 'text-emerald-700 font-semibold';
    } else if (paisa < 0) {
      colorClass = 'text-rose-700 font-semibold';
    } else {
      colorClass = 'text-slate-600';
    }
  }

  return <span className={`font-mono ${colorClass} ${className}`}>{formatted}</span>;
}
