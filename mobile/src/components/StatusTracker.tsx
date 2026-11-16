import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookingStatus } from '../api/bookings';
import { colors, radii, spacing } from '../theme';

const PROGRESS_STEPS: BookingStatus[] = [
  'REQUESTED',
  'ACCEPTED',
  'CHARGING',
  'COMPLETED',
  'CONFIRMED',
];

const STEP_LABELS: Record<string, string> = {
  REQUESTED: 'Requested',
  ACCEPTED: 'Accepted',
  CHARGING: 'Charging',
  COMPLETED: 'Completed',
  CONFIRMED: 'Confirmed',
};

const STATUS_MESSAGES: Record<BookingStatus, { title: string; subtitle: string; color: string; bg: string }> = {
  REQUESTED: {
    title: 'Booking Requested',
    subtitle: 'Waiting for the host to accept your request.',
    color: colors.warningDark,
    bg: colors.warningLight,
  },
  ACCEPTED: {
    title: 'Booking Accepted',
    subtitle: 'Host accepted. Drive to the charger address at your booked time.',
    color: colors.emeraldDark,
    bg: colors.emeraldLight,
  },
  CHARGING: {
    title: 'Charging in Progress',
    subtitle: 'Session is active. The host will record the final meter reading when done.',
    color: colors.info,
    bg: colors.infoLight,
  },
  COMPLETED: {
    title: 'Charging Completed',
    subtitle: 'Host submitted meter reading. Please review the kWh and confirm reading.',
    color: colors.emeraldDark,
    bg: colors.emeraldLight,
  },
  CONFIRMED: {
    title: 'Booking Confirmed',
    subtitle: 'Session verified. Thank you for charging with ChargeShare!',
    color: colors.emeraldDark,
    bg: colors.emeraldLight,
  },
  DECLINED: {
    title: 'Request Declined',
    subtitle: 'The host was unable to accept this booking request.',
    color: colors.dangerDark,
    bg: colors.dangerLight,
  },
  CANCELLED: {
    title: 'Booking Cancelled',
    subtitle: 'This booking was cancelled.',
    color: colors.mutedText,
    bg: colors.surface,
  },
  EXPIRED: {
    title: 'Request Expired',
    subtitle: 'The host did not respond before the request timeout.',
    color: colors.mutedText,
    bg: colors.surface,
  },
  DISPUTED: {
    title: 'Reading Disputed',
    subtitle: 'You reported an issue with the reading. ChargeShare support is reviewing.',
    color: colors.warningDark,
    bg: colors.warningLight,
  },
};

export interface StatusTrackerProps {
  status: BookingStatus;
  cancelReason?: string | null;
}

export function StatusTracker({ status, cancelReason }: StatusTrackerProps) {
  const isTerminal = ['DECLINED', 'CANCELLED', 'EXPIRED', 'DISPUTED'].includes(status);
  const currentStepIndex = PROGRESS_STEPS.indexOf(status);
  const statusInfo = STATUS_MESSAGES[status] || {
    title: status,
    subtitle: '',
    color: colors.ink,
    bg: colors.surface,
  };

  return (
    <View style={styles.container}>
      {/* Banner */}
      <View style={[styles.statusBanner, { backgroundColor: statusInfo.bg }]}>
        <Text style={[styles.statusTitle, { color: statusInfo.color }]}>
          {statusInfo.title}
        </Text>
        <Text style={[styles.statusSubtitle, { color: statusInfo.color }]}>
          {cancelReason ? `Reason: ${cancelReason}` : statusInfo.subtitle}
        </Text>
      </View>

      {/* 5-step progress bar (if not terminal) */}
      {!isTerminal && (
        <View style={styles.trackerContainer}>
          <View style={styles.trackLine}>
            <View
              style={[
                styles.trackLineFill,
                {
                  width: `${(Math.max(0, currentStepIndex) / (PROGRESS_STEPS.length - 1)) * 100}%`,
                },
              ]}
            />
          </View>
          <View style={styles.stepsRow}>
            {PROGRESS_STEPS.map((step, idx) => {
              const isPastOrCurrent = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <View key={step} style={styles.stepNode}>
                  <View
                    style={[
                      styles.circle,
                      isPastOrCurrent && styles.circleActive,
                      isCurrent && styles.circleCurrent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.circleText,
                        isPastOrCurrent && styles.circleTextActive,
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      isPastOrCurrent && styles.stepLabelActive,
                      isCurrent && styles.stepLabelCurrent,
                    ]}
                    numberOfLines={1}
                  >
                    {STEP_LABELS[step]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  statusBanner: {
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    opacity: 0.9,
  },
  trackerContainer: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  trackLine: {
    position: 'absolute',
    top: 21,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: colors.border,
    zIndex: 0,
  },
  trackLineFill: {
    height: 3,
    backgroundColor: colors.emerald,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  stepNode: {
    alignItems: 'center',
    width: 60,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  circleActive: {
    borderColor: colors.emerald,
    backgroundColor: colors.emerald,
  },
  circleCurrent: {
    borderColor: colors.emeraldDark,
    transform: [{ scale: 1.2 }],
  },
  circleText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.mutedText,
  },
  circleTextActive: {
    color: colors.white,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.subtleText,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.ink,
  },
  stepLabelCurrent: {
    fontWeight: '800',
    color: colors.emeraldDark,
  },
});
