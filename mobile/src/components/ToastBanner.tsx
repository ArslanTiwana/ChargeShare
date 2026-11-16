import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUIStore } from '../store/ui-store';
import { colors, radii, spacing } from '../theme';

export function ToastBanner() {
  const toast = useUIStore((s) => s.toast);
  const hideToast = useUIStore((s) => s.hideToast);

  if (!toast) return null;

  const getTheme = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: '✓',
          badgeBg: colors.emeraldLight,
          badgeColor: colors.emeraldDark,
          borderColor: colors.emerald,
          textColor: colors.ink,
        };
      case 'error':
        return {
          icon: '✕',
          badgeBg: colors.dangerLight,
          badgeColor: colors.dangerDark,
          borderColor: colors.danger,
          textColor: colors.ink,
        };
      case 'warning':
        return {
          icon: '⚠️',
          badgeBg: colors.warningLight,
          badgeColor: colors.warningDark,
          borderColor: colors.warning,
          textColor: colors.ink,
        };
      case 'info':
      default:
        return {
          icon: 'ℹ️',
          badgeBg: colors.infoLight,
          badgeColor: colors.info,
          borderColor: colors.info,
          textColor: colors.ink,
        };
    }
  };

  const theme = getTheme();

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={hideToast}
        style={[styles.toastCard, { borderLeftColor: theme.borderColor }]}
        accessibilityRole="alert"
        accessibilityLabel={toast.message}
      >
        <View style={[styles.iconBadge, { backgroundColor: theme.badgeBg }]}>
          <Text style={[styles.iconText, { color: theme.badgeColor }]}>{theme.icon}</Text>
        </View>
        <View style={styles.textContainer}>
          {toast.title ? <Text style={styles.titleText}>{toast.title}</Text> : null}
          <Text style={[styles.messageText, { color: theme.textColor }]}>{toast.message}</Text>
        </View>
        <Text style={styles.closeBtn}>✕</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 36 : 10,
    left: 0,
    right: 0,
    zIndex: 99999,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  toastCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...Platform.select({
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 15,
    fontWeight: '800',
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  closeBtn: {
    fontSize: 14,
    color: colors.subtleText,
    paddingLeft: spacing.sm,
    fontWeight: '600',
  },
});
