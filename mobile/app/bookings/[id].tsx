import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { formatInTimeZone } from 'date-fns-tz';
import * as Clipboard from 'expo-clipboard';
import { useBookingDetail } from '../../src/hooks/useBookingDetail';
import {
  StatusTracker,
  MeterCard,
  RatingStars,
  Button,
  MoneyText,
  formatPaisaToRupees,
  Skeleton,
  ErrorState,
} from '../../src/components';
import { colors, radii, spacing } from '../../src/theme';

const TIMEZONE = 'Asia/Karachi';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isFocused, setIsFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const {
    booking,
    isLoading,
    isError,
    error,
    refetch,
    countdownSeconds,
    cancelMutation,
    confirmMutation,
    disputeMutation,
    reviewMutation,
  } = useBookingDetail(id as string, isFocused);

  // Cancel Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Dispute Modal State
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const handleOpenDirections = () => {
    if (!booking?.charger?.lat || !booking?.charger?.lng) {
      Alert.alert('Directions', 'Exact coordinates are not available yet.');
      return;
    }
    const { lat, lng } = booking.charger;
    const label = encodeURIComponent(booking.charger.title);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url as string).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  };

  const handleCallHost = () => {
    if (!booking?.host?.phone) return;
    Linking.openURL(`tel:${booking.host.phone}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call.');
    });
  };

  const handleCopyAddress = async () => {
    if (!booking?.charger?.addressLine) return;
    try {
      // In web or testing, Clipboard might be stubbed
      if (Clipboard?.setStringAsync) {
        await Clipboard.setStringAsync(booking.charger.addressLine);
        Alert.alert('Copied', 'Host address copied to clipboard.');
      }
    } catch {
      // Ignore copy error
    }
  };

  const handleConfirmCancel = () => {
    if (cancelReason.trim().length < 3) {
      Alert.alert('Reason Required', 'Please provide a reason with at least 3 characters.');
      return;
    }
    cancelMutation.mutate(cancelReason.trim(), {
      onSuccess: () => {
        setShowCancelModal(false);
        setCancelReason('');
        Alert.alert('Booking Cancelled', 'Your booking request has been cancelled.');
      },
      onError: (err: any) => {
        Alert.alert('Cancellation Failed', err?.message || 'Could not cancel booking.');
      },
    });
  };

  const handleConfirmReading = () => {
    Alert.alert(
      'Confirm Meter Reading',
      'Have you reviewed the meter reading photos and paid the host directly?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Complete',
          onPress: () => {
            confirmMutation.mutate(undefined, {
              onSuccess: () => {
                Alert.alert('Confirmed', 'Session confirmed. Thank you!');
              },
              onError: (err: any) => {
                Alert.alert('Error', err?.message || 'Could not confirm reading.');
              },
            });
          },
        },
      ]
    );
  };

  const handleConfirmDispute = () => {
    if (disputeReason.trim().length < 5) {
      Alert.alert('Reason Required', 'Please explain the issue with at least 5 characters.');
      return;
    }
    disputeMutation.mutate(disputeReason.trim(), {
      onSuccess: () => {
        setShowDisputeModal(false);
        setDisputeReason('');
        Alert.alert('Problem Reported', 'ChargeShare support has been notified and will review the reading.');
      },
      onError: (err: any) => {
        Alert.alert('Dispute Failed', err?.message || 'Could not submit dispute report.');
      },
    });
  };

  const handleSubmitReview = (rating: number, comment?: string) => {
    reviewMutation.mutate(
      { rating, comment },
      {
        onSuccess: () => {
          Alert.alert('Thank You', 'Your review has been submitted.');
        },
        onError: (err: any) => {
          Alert.alert('Review Failed', err?.message || 'Could not submit review.');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Skeleton width="100%" height={100} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={140} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={200} />
      </View>
    );
  }

  if (isError || !booking) {
    return (
      <ErrorState
        message={(error as Error)?.message || 'Failed to load booking details'}
        onRetry={refetch}
      />
    );
  }

  const datePart = formatInTimeZone(new Date(booking.startsAt), TIMEZONE, 'EEE, d MMM yyyy');
  const timePart = formatInTimeZone(new Date(booking.startsAt), TIMEZONE, 'HH:mm');
  const startStr = `${datePart} • ${timePart}`;
  const endStr = formatInTimeZone(new Date(booking.endsAt), TIMEZONE, 'HH:mm');

  const isPrivileged = ['ACCEPTED', 'CHARGING', 'COMPLETED', 'CONFIRMED'].includes(booking.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status Tracker */}
      <StatusTracker status={booking.status} cancelReason={booking.cancelReason} />

      {/* Countdown while REQUESTED */}
      {booking.status === 'REQUESTED' && (
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>AWAITING HOST ACCEPTANCE</Text>
          <Text style={styles.countdownValue}>
            {countdownSeconds != null
              ? `${Math.floor(countdownSeconds / 60)}m ${countdownSeconds % 60}s`
              : 'Calculating...'}
          </Text>
          <Text style={styles.countdownDesc}>
            If the host does not accept within the countdown, your request automatically expires.
          </Text>
          <Button
            title="Cancel Request"
            variant="outline"
            onPress={() => setShowCancelModal(true)}
            style={styles.cancelBtn}
          />
        </View>
      )}

      {/* Charger & Location Card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardHeader}>Charger Details</Text>
        <Text style={styles.chargerTitle}>{booking.charger.title}</Text>
        <Text style={styles.chargerSubtitle}>
          ⚡ {booking.charger.powerKw} kW • 🔌 {booking.charger.connectorType}
        </Text>

        {/* Revealed Address after ACCEPTED */}
        {isPrivileged && booking.charger.addressLine ? (
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>EXACT CHARGER ADDRESS</Text>
            <Text style={styles.addressText}>{booking.charger.addressLine}</Text>
            <View style={styles.addressActionRow}>
              <TouchableOpacity
                style={styles.actionBtnSmall}
                onPress={handleOpenDirections}
                accessibilityRole="button"
                accessibilityLabel="Open GPS directions"
              >
                <Text style={styles.actionBtnSmallText}>🧭 Open Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSmall}
                onPress={handleCopyAddress}
                accessibilityRole="button"
                accessibilityLabel="Copy address text"
              >
                <Text style={styles.actionBtnSmallText}>📋 Copy Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.approxLocationBlock}>
            <Text style={styles.approxLocationText}>
              📍 Sector {booking.charger.areaLabel} (Exact street address revealed once host accepts)
            </Text>
          </View>
        )}
      </View>

      {/* Host Contact Card (Revealed after ACCEPTED) */}
      {isPrivileged && booking.host.phone && (
        <View style={styles.infoCard}>
          <Text style={styles.cardHeader}>Host Contact</Text>
          <Text style={styles.hostName}>{booking.host.name}</Text>
          <View style={styles.phoneRow}>
            <Text style={styles.phoneText}>📞 {booking.host.phone}</Text>
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCallHost}
              accessibilityRole="button"
              accessibilityLabel="Call host now"
            >
              <Text style={styles.callButtonText}>Call Host</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Time Slot Details */}
      <View style={styles.infoCard}>
        <Text style={styles.cardHeader}>Scheduled Booking Time</Text>
        <Text style={styles.timeScheduleText}>
          📅 {startStr} - {endStr}
        </Text>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Rate agreed</Text>
          <Text style={styles.rateVal}>
            {formatPaisaToRupees(booking.rateSnapshotPaisa || booking.charger.pricePerKwhPaisa)}/kWh
          </Text>
        </View>
      </View>

      {/* Meter Card (When COMPLETED or CONFIRMED) */}
      {booking.session && (
        <MeterCard
          session={booking.session}
          canAct={booking.status === 'COMPLETED'}
          onConfirm={handleConfirmReading}
          onDispute={() => setShowDisputeModal(true)}
          isConfirming={confirmMutation.isPending}
        />
      )}

      {/* Review Form (When CONFIRMED) */}
      {booking.status === 'CONFIRMED' && (
        <RatingStars
          onSubmit={handleSubmitReview}
          isSubmitting={reviewMutation.isPending}
        />
      )}

      {/* Cancel Request Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel Booking Request</Text>
            <Text style={styles.modalSubtitle}>
              Please tell the host why you are cancelling this request:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Schedule changed, found alternative..."
              placeholderTextColor={colors.subtleText}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
            <Button
              title="Confirm Cancellation"
              variant="danger"
              onPress={handleConfirmCancel}
              loading={cancelMutation.isPending}
              style={{ marginBottom: spacing.xs, width: '100%' }}
            />
            <TouchableOpacity
              onPress={() => setShowCancelModal(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dispute Modal */}
      <Modal
        visible={showDisputeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisputeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Report Reading Problem</Text>
            <Text style={styles.modalSubtitle}>
              Describe the discrepancy between the meter photos and reported kWh:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. The end photo shows 12.4 kWh, but 25.0 kWh was entered..."
              placeholderTextColor={colors.subtleText}
              value={disputeReason}
              onChangeText={setDisputeReason}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
            <Button
              title="Submit Dispute"
              variant="danger"
              onPress={handleConfirmDispute}
              loading={disputeMutation.isPending}
              style={{ marginBottom: spacing.xs, width: '100%' }}
            />
            <TouchableOpacity
              onPress={() => setShowDisputeModal(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: colors.white,
  },
  countdownCard: {
    backgroundColor: colors.warningLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.warning,
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.warningDark,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  countdownValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.warningDark,
    marginBottom: 4,
  },
  countdownDesc: {
    fontSize: 12,
    color: colors.warningDark,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  cancelBtn: {
    width: '100%',
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.mutedText,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  chargerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2,
  },
  chargerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
    marginBottom: spacing.sm,
  },
  addressBlock: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.emeraldDark,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  addressActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnSmall: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  approxLocationBlock: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  approxLocationText: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 18,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  callButton: {
    backgroundColor: colors.emeraldDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  callButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  timeScheduleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  rateLabel: {
    fontSize: 12,
    color: colors.mutedText,
  },
  rateVal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.ink,
    minHeight: 80,
    width: '100%',
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  modalCancelBtn: {
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedText,
  },
});
