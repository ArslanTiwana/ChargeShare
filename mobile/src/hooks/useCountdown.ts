import { useState, useEffect } from 'react';

export function calculateRemainingSeconds(
  expiresAtISO: string,
  serverTimeISO?: string,
  localTimestampMs?: number,
  clientOffsetAtReceipt?: number
): number {
  const expiresAtMs = new Date(expiresAtISO).getTime();
  if (isNaN(expiresAtMs)) return 0;

  const nowMs = localTimestampMs ?? Date.now();
  const offset = clientOffsetAtReceipt ?? (serverTimeISO ? new Date(serverTimeISO).getTime() - nowMs : 0);
  const currentServerTime = nowMs + offset;

  const diffMs = Math.max(0, expiresAtMs - currentServerTime);
  return Math.floor(diffMs / 1000);
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function useCountdown(expiresAtISO?: string | null, serverTimeISO?: string | null) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (!expiresAtISO) return 0;
    return calculateRemainingSeconds(expiresAtISO, serverTimeISO || undefined);
  });

  useEffect(() => {
    if (!expiresAtISO) {
      setSecondsRemaining(0);
      return;
    }

    const receiptLocalMs = Date.now();
    const serverMs = serverTimeISO ? new Date(serverTimeISO).getTime() : receiptLocalMs;
    const clientOffset = serverMs - receiptLocalMs;

    const update = () => {
      const remaining = calculateRemainingSeconds(
        expiresAtISO,
        serverTimeISO || undefined,
        Date.now(),
        clientOffset
      );
      setSecondsRemaining(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAtISO, serverTimeISO]);

  return {
    secondsRemaining,
    formattedTime: formatCountdown(secondsRemaining),
    isExpired: secondsRemaining <= 0,
  };
}
