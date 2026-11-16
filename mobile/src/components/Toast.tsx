import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  style?: ViewStyle;
}

export function Toast({ message, type = 'info', style }: ToastProps) {
  const getColors = () => {
    switch (type) {
      case 'success':
        return { bg: colors.emeraldLight, text: colors.emeraldDark, border: colors.emerald };
      case 'error':
        return { bg: colors.dangerLight, text: colors.dangerDark, border: colors.danger };
      case 'info':
      default:
        return { bg: colors.infoLight, text: colors.info, border: colors.info };
    }
  };

  const theme = getColors();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.bg, borderColor: theme.border },
        style,
      ]}
    >
      <Text style={[styles.text, { color: theme.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginVertical: spacing.sm,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
