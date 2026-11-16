import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme';
import { Button } from './Button';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({ message, onRetry, style }: ErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button
          title="Try Again"
          onPress={onRetry}
          variant="outline"
          size="sm"
          style={styles.retryButton}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    backgroundColor: colors.dangerLight,
    borderRadius: radii.md,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dangerDark,
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 13,
    color: colors.dangerDark,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: colors.white,
    borderColor: colors.dangerDark,
  },
});
