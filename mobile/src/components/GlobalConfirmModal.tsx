import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useUIStore } from '../store/ui-store';
import { colors, radii, spacing } from '../theme';

export function GlobalConfirmModal() {
  const confirmModal = useUIStore((s) => s.confirmModal);
  const hideConfirm = useUIStore((s) => s.hideConfirm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!confirmModal) return null;

  const isDanger = confirmModal.variant === 'danger';

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await confirmModal.onConfirm();
    } finally {
      setIsSubmitting(false);
      hideConfirm();
    }
  };

  const handleCancel = () => {
    if (confirmModal.onCancel) {
      confirmModal.onCancel();
    }
    hideConfirm();
  };

  return (
    <Modal
      visible={Boolean(confirmModal)}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Icon Badge */}
          <View style={[styles.iconBadge, isDanger ? styles.iconBadgeDanger : styles.iconBadgePrimary]}>
            <Text style={styles.iconText}>{confirmModal.icon || (isDanger ? '⚠️' : '⚡')}</Text>
          </View>

          {/* Title & Message */}
          <Text style={styles.title}>{confirmModal.title}</Text>
          <Text style={styles.message}>{confirmModal.message}</Text>

          {/* Actions */}
          <View style={styles.buttonCol}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleConfirm}
              disabled={isSubmitting}
              style={[
                styles.confirmButton,
                isDanger ? styles.confirmButtonDanger : styles.confirmButtonPrimary,
              ]}
              accessibilityRole="button"
              accessibilityLabel={confirmModal.confirmText || 'Confirm'}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {confirmModal.confirmText || 'Confirm'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCancel}
              disabled={isSubmitting}
              style={styles.cancelButton}
              accessibilityRole="button"
              accessibilityLabel={confirmModal.cancelText || 'Cancel'}
            >
              <Text style={styles.cancelButtonText}>
                {confirmModal.cancelText || 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    elevation: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconBadgePrimary: {
    backgroundColor: colors.emeraldLight,
  },
  iconBadgeDanger: {
    backgroundColor: colors.dangerLight,
  },
  iconText: {
    fontSize: 26,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  buttonCol: {
    width: '100%',
    gap: spacing.sm,
  },
  confirmButton: {
    width: '100%',
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonPrimary: {
    backgroundColor: colors.emeraldDark,
  },
  confirmButtonDanger: {
    backgroundColor: colors.danger,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    width: '100%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: '600',
  },
});
