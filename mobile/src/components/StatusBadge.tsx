import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme';

export interface StatusBadgeProps {
  status: string;
  style?: ViewStyle;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const normalized = status.toUpperCase();

  const getTheme = () => {
    switch (normalized) {
      case 'APPROVED':
      case 'CONFIRMED':
      case 'COMPLETED':
        return {
          bg: colors.emeraldLight,
          text: colors.emeraldDark,
          label: normalized === 'APPROVED' ? 'Approved Host' : normalized,
        };
      case 'PENDING':
      case 'REQUESTED':
        return {
          bg: colors.warningLight,
          text: colors.warningDark,
          label: normalized === 'PENDING' ? 'Pending Approval' : normalized,
        };
      case 'CHARGING':
        return {
          bg: colors.infoLight,
          text: colors.info,
          label: 'Charging',
        };
      case 'SUSPENDED':
      case 'REJECTED':
      case 'CANCELLED':
      case 'DECLINED':
      case 'DISPUTED':
        return {
          bg: colors.dangerLight,
          text: colors.dangerDark,
          label: normalized,
        };
      case 'NONE':
      default:
        return {
          bg: colors.surface,
          text: colors.mutedText,
          label: normalized === 'NONE' ? 'Driver Only' : normalized,
        };
    }
  };

  const theme = getTheme();

  return (
    <View style={[styles.badge, { backgroundColor: theme.bg }, style]}>
      <Text style={[styles.text, { color: theme.text }]}>{theme.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
