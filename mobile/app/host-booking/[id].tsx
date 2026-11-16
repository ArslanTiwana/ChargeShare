import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import {
  getBookingDetail,
  acceptBooking,
  declineBooking,
  cancelBooking,
  startBooking,
  disputeBooking,
  createReview,
  getReadUrl,
} from '../../src/api/bookings';
import {
  HostStatusGate,
  StatusTracker,
  Button,
  StatusBadge,
  MoneyText,
  formatPaisaToRupees,
  RatingStars,
  Skeleton,
  ErrorState,
} from '../../src/components';
import { useCountdown } from '../../src/hooks/useCountdown';
import { colors, radii, spacing } from '../../src/theme';
import { showToast, showConfirm } from '../../src/store/ui-store';

const TIMEZONE = 'Asia/Karachi';

export default function HostBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  const {
    data: booking,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['host-booking-detail', id],
    queryFn: () => getBookingDetail(id as string),
    enabled: Boolean(id),
    refetchInterval: 15000,
  });

  const countdown = useCountdown(booking?.expiresAt, booking?.serverTime);

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: () => acceptBooking(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-booking-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['host-bookings-list'] });
      queryClient.invalidateQueries({ queryKey: ['host-dashboard-bookings'] });
      showToast({ message: 'Booking accepted! Driver notified with directions.', type: 'success' });
    },
    onError: (err: any) => showToast({ message: err?.message || 'Could not accept booking.', type: 'error' }),
  });

  const startMutation = useMutation({
    mutationFn: () => startBooking(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-booking-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['host-bookings-list'] });
      showToast({ message: 'Charging session started. Enter readings anytime.', type: 'success' });
    },
    onError: (err: any) => showToast({ message: err?.message || 'Could not start charging.', type: 'error' }),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelBooking(id as string, reason),
    onSuccess: () => {
      setCancelModalVisible(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['host-booking-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['host-bookings-list'] });
      showToast({ message: 'Booking has been cancelled.', type: 'info' });
    },
    onError: (err: any) => showToast({ message: err?.message || 'Could not cancel booking.', type: 'error' }),
  });

  const disputeMutation = useMutation({
    mutationFn: (reason: string) => disputeBooking(id as string, reason),
    onSuccess: () => {
      setDisputeModalVisible(false);
      setDisputeReason('');
      queryClient.invalidateQueries({ queryKey: ['host-booking-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['host-bookings-list'] });
      showToast({ message: 'Dispute opened. Administrator has been notified.', type: 'info' });
    },
    onError: (err: any) => showToast({ message: err?.message || 'Could not dispute reading.', type: 'error' }),
  });

  const reviewMutation = useMutation({
    mutationFn: () => createReview(id as string, { rating, comment: reviewComment.trim() }),
    onSuccess: () => {
      setReviewModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['host-booking-detail', id] });
      showToast({ message: 'Your rating for the driver has been submitted.', type: 'success' });
    },
    onError: (err: any) => showToast({ message: err?.message || 'Could not submit review.', type: 'error' }),
  });

  const handleOpenPhoto = async (key?: string | null) => {
    if (!key) return;
    setIsLoadingPhoto(true);
    try {
      const res = await getReadUrl(key);
      setZoomedPhotoUrl(res.readUrl);
    } catch {
      showToast({ message: 'Unable to load meter photo.', type: 'error' });
    } finally {
      setIsLoadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.emeraldDark} />
      </View>
    );
  }

  if (isError || !booking) {
    return (
      <View style={styles.container}>
        <ErrorState message="Could not load booking details." onRetry={refetch} />
      </View>
    );
  }

  const startFormatted = formatInTimeZone(
    new Date(booking.startsAt),
    TIMEZONE,
    'EEEE, MMMM d, yyyy • h:mm a'
  );
  const endFormatted = formatInTimeZone(new Date(booking.endsAt), TIMEZONE, 'h:mm a');

  return (
    <HostStatusGate>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Status Tracker */}
        <StatusTracker status={booking.status} />

        {/* Driver Contact Box (Only revealed after acceptance) */}
        {booking.driver ? (
          <View style={styles.driverBox}>
            <Text style={styles.boxTitle}>Driver Details</Text>
            <Text style={styles.driverName}>👤 {booking.driver.name || 'Verified Driver'}</Text>
            {booking.driver.phone ? (
              <TouchableOpacity
                style={styles.phoneRow}
                onPress={() => Linking.openURL(`tel:${booking.driver.phone}`)}
              >
                <Text style={styles.phoneText}>📞 {booking.driver.phone}</Text>
                <Text style={styles.phoneAction}>Tap to Call ›</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.phoneHidden}>
                Driver phone is available once you accept the booking request.
              </Text>
            )}
          </View>
        ) : null}

        {/* Schedule & Specs */}
        <View style={styles.card}>
          <Text style={styles.boxTitle}>Booking Details</Text>
          <Text style={styles.chargerTitle}>{booking.charger.title}</Text>
          <Text style={styles.timeSlotText}>
            {startFormatted} – {endFormatted}
          </Text>

          <View style={styles.specsRow}>
            <Text style={styles.specText}>⚡ {booking.charger.powerKw} kW</Text>
            <Text style={styles.specText}>🔌 {booking.charger.connectorType}</Text>
            <Text style={styles.specText}>
              💰 {formatPaisaToRupees(booking.rateSnapshotPaisa || 0)}/kWh
            </Text>
          </View>

          {booking.estimatedKwh ? (
            <Text style={styles.estimateText}>
              Estimated Energy: ~{booking.estimatedKwh} kWh
            </Text>
          ) : null}
        </View>

        {/* Meter & Session Card (If session entered) */}
        {booking.session ? (
          <View style={styles.sessionCard}>
            <Text style={styles.boxTitle}>Meter Reading & Payout</Text>

            <View style={styles.sessionMetricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Energy Delivered</Text>
                <Text style={styles.metricValue}>{booking.session.kwhDelivered} kWh</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Total Owed to You</Text>
                <Text style={styles.metricValue}>
                  {formatPaisaToRupees(booking.session.totalPaisa)}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Platform Commission</Text>
                <Text style={[styles.metricValue, { color: colors.dangerDark }]}>
                  -{formatPaisaToRupees(booking.session.commissionPaisa)}
                </Text>
              </View>
            </View>

            <Text style={styles.directPayReminder}>
              💵 Collect {formatPaisaToRupees(booking.session.totalPaisa)} directly from the driver in cash or transfer.
            </Text>

            {/* Meter Photo Verification */}
            <Text style={styles.photoHeader}>Sub-meter Photo</Text>
            {booking.session.meterEndPhotoKey ? (
              <TouchableOpacity
                style={styles.photoThumb}
                onPress={() => handleOpenPhoto(booking.session?.meterEndPhotoKey)}
                disabled={isLoadingPhoto}
              >
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={styles.photoLabel}>View Meter Photo</Text>
                <Text style={styles.photoSub}>Tap to zoom</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.noPhotoBox}>
                <Text style={styles.noPhotoText}>No photo provided</Text>
              </View>
            )}

            {booking.status === 'COMPLETED' && (
              <View style={styles.completedNoticeBox}>
                <Text style={styles.completedNoticeText}>
                  Waiting for driver to confirm reading. If driver does not confirm within 24 hours, the session confirms automatically.
                </Text>
                <TouchableOpacity
                  style={styles.reviseButton}
                  onPress={() => router.push({ pathname: '/host-booking/[id]/meter', params: { id } })}
                >
                  <Text style={styles.reviseButtonText}>✏️ Revise Meter Reading</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {/* Action Buttons based on status */}
        <View style={styles.actionsContainer}>
          {booking.status === 'REQUESTED' && (
            <View style={styles.actionCol}>
              <Text style={styles.expiryCountdown}>
                ⏱️ Request expires in: {countdown.formattedTime}
              </Text>
              <Button
                title="Accept Booking Request"
                onPress={() => acceptMutation.mutate()}
                loading={acceptMutation.isPending}
                style={styles.mainActionBtn}
              />
              <Button
                title="Decline"
                variant="outline"
                onPress={() => setCancelModalVisible(true)}
              />
            </View>
          )}

          {booking.status === 'ACCEPTED' && (
            <View style={styles.actionCol}>
              <Button
                title="Start Charging Session"
                onPress={() => startMutation.mutate()}
                loading={startMutation.isPending}
                style={styles.mainActionBtn}
              />
              <Button
                title="Cancel Booking"
                variant="outline"
                onPress={() => setCancelModalVisible(true)}
              />
            </View>
          )}

          {booking.status === 'CHARGING' && (
            <View style={styles.actionCol}>
              <Button
                title="Enter Meter Reading"
                onPress={() => router.push({ pathname: '/host-booking/[id]/meter', params: { id } })}
                style={styles.mainActionBtn}
              />
            </View>
          )}

          {booking.status === 'COMPLETED' && (
            <View style={styles.actionCol}>
              <TouchableOpacity
                style={styles.disputeBtn}
                onPress={() => setDisputeModalVisible(true)}
              >
                <Text style={styles.disputeBtnText}>Report a Problem / Dispute</Text>
              </TouchableOpacity>
            </View>
          )}

          {booking.status === 'CONFIRMED' && (
            <View style={styles.actionCol}>
              <Button
                title="Rate the Driver"
                variant="outline"
                onPress={() => setReviewModalVisible(true)}
              />
            </View>
          )}
        </View>

        {/* Cancel Modal */}
        <Modal
          visible={cancelModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCancelModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={[styles.modalIconBadge, { backgroundColor: colors.dangerLight }]}>
                <Text style={{ fontSize: 24 }}>🚫</Text>
              </View>
              <Text style={styles.modalTitle}>Cancel / Decline Booking</Text>
              <Text style={styles.modalSub}>Please provide a reason for cancellation:</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Reason for cancellation..."
                placeholderTextColor={colors.subtleText}
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={3}
              />
              <View style={styles.modalBtnRow}>
                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setCancelModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Confirm"
                  variant="danger"
                  onPress={() => cancelMutation.mutate(cancelReason.trim())}
                  loading={cancelMutation.isPending}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Dispute Modal */}
        <Modal
          visible={disputeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDisputeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={[styles.modalIconBadge, { backgroundColor: colors.warningLight }]}>
                <Text style={{ fontSize: 24 }}>⚠️</Text>
              </View>
              <Text style={styles.modalTitle}>Open Dispute</Text>
              <Text style={styles.modalSub}>
                Explain the issue with this charging session for administrative resolution:
              </Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Dispute details..."
                placeholderTextColor={colors.subtleText}
                value={disputeReason}
                onChangeText={setDisputeReason}
                multiline
                numberOfLines={3}
              />
              <View style={styles.modalBtnRow}>
                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setDisputeModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Submit Dispute"
                  variant="danger"
                  onPress={() => disputeMutation.mutate(disputeReason.trim())}
                  loading={disputeMutation.isPending}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Review Modal */}
        <Modal
          visible={reviewModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReviewModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={[styles.modalIconBadge, { backgroundColor: colors.emeraldLight }]}>
                <Text style={{ fontSize: 24 }}>⭐</Text>
              </View>
              <Text style={styles.modalTitle}>Rate Driver Experience</Text>
              <View style={{ marginVertical: 12 }}>
                <RatingStars
                  onSubmit={(r, c) => {
                    setRating(r);
                    if (c) setReviewComment(c);
                    reviewMutation.mutate();
                  }}
                  isSubmitting={reviewMutation.isPending}
                />
              </View>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setReviewModalVisible(false)}
              />
            </View>
          </View>
        </Modal>

        {/* Zoomed Photo Modal */}
        {zoomedPhotoUrl && (
          <Modal visible={Boolean(zoomedPhotoUrl)} transparent onRequestClose={() => setZoomedPhotoUrl(null)}>
            <View style={styles.zoomedOverlay}>
              <TouchableOpacity
                style={styles.zoomedCloseBtn}
                onPress={() => setZoomedPhotoUrl(null)}
              >
                <Text style={styles.zoomedCloseText}>✕ Close</Text>
              </TouchableOpacity>
              <Text style={styles.zoomedSub}>Sub-meter Verification Photo</Text>
            </View>
          </Modal>
        )}
      </ScrollView>
    </HostStatusGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: 50,
  },
  driverBox: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.md,
    marginTop: 4,
  },
  phoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  phoneAction: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
  phoneHidden: {
    fontSize: 12,
    color: colors.mutedText,
    fontStyle: 'italic',
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
  },
  chargerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  timeSlotText: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: spacing.xs,
  },
  specsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  specText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  estimateText: {
    fontSize: 12,
    color: colors.emeraldDark,
    fontWeight: '700',
    marginTop: 6,
  },
  sessionCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.emeraldLight,
    marginBottom: spacing.md,
  },
  sessionMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.mutedText,
    marginBottom: 2,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  directPayReminder: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
    marginVertical: spacing.xs,
  },
  photoHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedText,
    marginTop: spacing.xs,
    marginBottom: 6,
  },
  photoThumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  photoIcon: {
    fontSize: 20,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  photoSub: {
    fontSize: 11,
    color: colors.emeraldDark,
    marginLeft: 'auto',
    fontWeight: '600',
  },
  noPhotoBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 10,
    alignItems: 'center',
  },
  noPhotoText: {
    fontSize: 12,
    color: colors.subtleText,
    fontStyle: 'italic',
  },
  completedNoticeBox: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  completedNoticeText: {
    fontSize: 11,
    color: '#1e3a8a',
    lineHeight: 16,
    marginBottom: 8,
  },
  reviseButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  reviseButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  actionsContainer: {
    marginTop: spacing.sm,
  },
  actionCol: {
    gap: 10,
  },
  mainActionBtn: {
    marginBottom: 2,
  },
  expiryCountdown: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 4,
  },
  disputeBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  disputeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dangerDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 380,
    elevation: 10,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: spacing.md,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    fontSize: 13,
    color: colors.ink,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  zoomedOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  zoomedCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
  },
  zoomedCloseText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  zoomedSub: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
  },
});
