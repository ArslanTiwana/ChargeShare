import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BookingSession, getReadUrl } from '../api/bookings';
import { formatPaisaToRupees } from './MoneyText';
import { Button } from './Button';
import { colors, radii, spacing } from '../theme';

export interface MeterCardProps {
  session: BookingSession;
  canAct: boolean; // true if status === 'COMPLETED'
  onConfirm: () => void;
  onDispute: () => void;
  isConfirming?: boolean;
}

export function MeterCard({
  session,
  canAct,
  onConfirm,
  onDispute,
  isConfirming = false,
}: MeterCardProps) {
  const [zoomKey, setZoomKey] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  // Lazy / fresh fetch for photo zoom viewer
  const handleOpenPhoto = async (key?: string | null) => {
    if (!key) return;
    setZoomKey(key);
    setIsLoadingPhoto(true);
    try {
      const res = await getReadUrl(key);
      setZoomUrl(res.readUrl);
    } catch {
      Alert.alert('Error', 'Unable to load meter photo. Please try again.');
      setZoomKey(null);
    } finally {
      setIsLoadingPhoto(false);
    }
  };

  const handleCloseZoom = () => {
    setZoomKey(null);
    setZoomUrl(null);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Meter Reading & Total</Text>

      {/* Big Total */}
      <View style={styles.totalBlock}>
        <Text style={styles.totalLabel}>TOTAL TO PAY THE HOST</Text>
        <Text style={styles.totalAmount}>
          {formatPaisaToRupees(session.totalPaisa)}
        </Text>
        <Text style={styles.directPayNote}>
          💵 You pay the host directly based on the meter reading.
        </Text>
      </View>

      {/* Reading specs */}
      <View style={styles.specGrid}>
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>Energy Delivered</Text>
          <Text style={styles.specValue}>{session.kwhDelivered} kWh</Text>
        </View>
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>Agreed Rate</Text>
          <Text style={styles.specValue}>
            {formatPaisaToRupees(session.rateSnapshotPaisa)}/kWh
          </Text>
        </View>
      </View>

      {/* Meter Photos */}
      <Text style={styles.photosTitle}>Meter Photo</Text>
      <View style={styles.photosRow}>
        {session.meterEndPhotoKey ? (
          <TouchableOpacity
            style={styles.photoThumb}
            activeOpacity={0.8}
            onPress={() => handleOpenPhoto(session.meterEndPhotoKey)}
            accessibilityRole="button"
            accessibilityLabel="View end meter photo"
          >
            <Text style={styles.photoThumbIcon}>📷</Text>
            <Text style={styles.photoThumbLabel}>Meter Photo</Text>
            <Text style={styles.photoTapText}>Tap to zoom</Text>
          </TouchableOpacity>
        ) : session.meterStartPhotoKey ? (
          <TouchableOpacity
            style={styles.photoThumb}
            activeOpacity={0.8}
            onPress={() => handleOpenPhoto(session.meterStartPhotoKey)}
            accessibilityRole="button"
            accessibilityLabel="View start meter photo"
          >
            <Text style={styles.photoThumbIcon}>📷</Text>
            <Text style={styles.photoThumbLabel}>Start Photo</Text>
            <Text style={styles.photoTapText}>Tap to zoom</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.noPhotoBox}>
            <Text style={styles.noPhotoText}>No photo provided</Text>
          </View>
        )}
      </View>

      {/* Actions (only when COMPLETED) */}
      {canAct && (
        <View style={styles.actionContainer}>
          <Button
            title="Confirm Reading"
            onPress={onConfirm}
            loading={isConfirming}
            style={styles.confirmButton}
          />
          <TouchableOpacity
            onPress={onDispute}
            disabled={isConfirming}
            style={styles.disputeButton}
            accessibilityRole="button"
            accessibilityLabel="Report a problem with this meter reading"
          >
            <Text style={styles.disputeText}>Report a Problem</Text>
          </TouchableOpacity>
          <Text style={styles.commissionExplanation}>
            * Confirming charges the host's platform commission only. You pay the host in cash or bank transfer directly.
          </Text>
        </View>
      )}

      {/* Photo Zoom Modal */}
      <Modal
        visible={zoomKey != null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseZoom}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleCloseZoom}
              accessibilityRole="button"
              accessibilityLabel="Close photo viewer"
            >
              <Text style={styles.modalCloseText}>✕ Close</Text>
            </TouchableOpacity>

            {isLoadingPhoto ? (
              <ActivityIndicator size="large" color={colors.white} style={{ margin: 40 }} />
            ) : zoomUrl ? (
              <Image
                source={{ uri: zoomUrl }}
                style={styles.zoomedImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginVertical: spacing.md,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  totalBlock: {
    backgroundColor: colors.emeraldLight,
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.emeraldDark,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.emeraldDark,
    marginBottom: 6,
  },
  directPayNote: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.emeraldDark,
    textAlign: 'center',
  },
  specGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.md,
  },
  specItem: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  specLabel: {
    fontSize: 11,
    color: colors.mutedText,
    fontWeight: '600',
    marginBottom: 2,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  photosTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.md,
  },
  photoThumb: {
    flex: 1,
    height: 90,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  photoThumbIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  photoThumbLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  photoTapText: {
    fontSize: 10,
    color: colors.emeraldDark,
    fontWeight: '600',
    marginTop: 2,
  },
  noPhotoBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: {
    fontSize: 13,
    color: colors.subtleText,
    fontStyle: 'italic',
  },
  actionContainer: {
    marginTop: spacing.sm,
  },
  confirmButton: {
    marginBottom: spacing.sm,
  },
  disputeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  disputeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dangerDark,
  },
  commissionExplanation: {
    fontSize: 11,
    color: colors.subtleText,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 12,
    zIndex: 10,
  },
  modalCloseText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  zoomedImage: {
    width: '90%',
    height: '70%',
  },
});
