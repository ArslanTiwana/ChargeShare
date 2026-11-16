import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { formatInTimeZone } from 'date-fns-tz';
import { useHostDashboard } from '../../src/hooks/useHostDashboard';
import {
  HostStatusGate,
  RoleSwitcher,
  MoneyText,
  formatPaisaToRupees,
  Button,
  StatusBadge,
  Skeleton,
  ErrorState,
  EmptyState,
} from '../../src/components';
import { useCountdown } from '../../src/hooks/useCountdown';
import { colors, radii, spacing } from '../../src/theme';
import { BookingListItem } from '../../src/api/bookings';
import { showToast } from '../../src/store/ui-store';

const TIMEZONE = 'Asia/Karachi';

function RequestCard({
  booking,
  onAccept,
  onDecline,
  isAccepting,
  isDeclining,
}: {
  booking: BookingListItem;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  isAccepting: boolean;
  isDeclining: boolean;
}) {
  const router = useRouter();
  const { formattedTime, isExpired } = useCountdown(booking.expiresAt, booking.createdAt);

  const startFormatted = formatInTimeZone(
    new Date(booking.startsAt),
    TIMEZONE,
    'EEE, MMM d • h:mm a'
  );
  const endFormatted = formatInTimeZone(new Date(booking.endsAt), TIMEZONE, 'h:mm a');

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestBadge}>
          <Text style={styles.requestBadgeText}>Incoming Request</Text>
        </View>
        <Text style={[styles.countdownText, isExpired && styles.countdownExpired]}>
          ⏱️ {isExpired ? 'Expired' : formattedTime}
        </Text>
      </View>

      <Text style={styles.requestCharger}>{booking.charger.title}</Text>
      <Text style={styles.requestSlot}>
        {startFormatted} - {endFormatted}
      </Text>

      <View style={styles.requestMetaRow}>
        <Text style={styles.requestMetaItem}>⚡ {booking.charger.powerKw} kW</Text>
        <Text style={styles.requestMetaItem}>
          💰 {formatPaisaToRupees(booking.rateSnapshotPaisa || booking.charger.pricePerKwhPaisa)}/kWh
        </Text>
        {booking.estimatedKwh ? (
          <Text style={styles.requestMetaItem}>🔋 ~{booking.estimatedKwh} kWh</Text>
        ) : null}
      </View>

      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.declineBtn, isDeclining && styles.actionDisabled]}
          onPress={() => onDecline(booking.id)}
          disabled={isDeclining || isAccepting}
          accessibilityRole="button"
          accessibilityLabel="Decline booking request"
        >
          <Text style={styles.declineBtnText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptBtn, isAccepting && styles.actionDisabled]}
          onPress={() => onAccept(booking.id)}
          disabled={isAccepting || isDeclining}
          accessibilityRole="button"
          accessibilityLabel="Accept booking request"
        >
          <Text style={styles.acceptBtnText}>Accept Booking</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HostDashboardScreen() {
  const router = useRouter();
  const {
    wallet,
    config,
    incomingRequests,
    activeBookings,
    chargers,
    isLoading,
    isRefetching,
    isError,
    refetch,
    acceptBooking,
    declineBooking,
    isAccepting,
    isDeclining,
    toggleOnline,
    isTogglingOnline,
  } = useHostDashboard();

  const [declineModalId, setDeclineModalId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const balancePaisa = wallet?.balancePaisa ?? 0;
  const warningThresholdPaisa = config?.hostMinWalletWarningPaisa ?? 50000;
  const isZeroOrNegative = balancePaisa <= 0;
  const isLowBalance = balancePaisa > 0 && balancePaisa < warningThresholdPaisa;

  const handleAccept = async (id: string) => {
    try {
      await acceptBooking(id);
      showToast({
        title: 'Booking Accepted',
        message: 'Driver has been notified and sent arrival directions.',
        type: 'success',
      });
    } catch (err: any) {
      showToast({ message: err?.message || 'Could not accept booking.', type: 'error' });
    }
  };

  const handleConfirmDecline = async () => {
    if (!declineModalId) return;
    try {
      await declineBooking({ bookingId: declineModalId, reason: declineReason.trim() });
      setDeclineModalId(null);
      setDeclineReason('');
      showToast({
        title: 'Request Declined',
        message: 'The booking request has been declined.',
        type: 'info',
      });
    } catch (err: any) {
      showToast({ message: err?.message || 'Could not decline booking.', type: 'error' });
    }
  };

  return (
    <HostStatusGate>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />}
      >
        {/* Role Switcher */}
        <View style={styles.roleSwitcherContainer}>
          <RoleSwitcher />
        </View>

        {/* Loading Skeletons */}
        {isLoading && !wallet ? (
          <View style={styles.skeletonContainer}>
            <Skeleton width="100%" height={120} borderRadius={radii.xl} />
            <Skeleton width="100%" height={160} borderRadius={radii.xl} style={{ marginTop: 16 }} />
            <Skeleton width="100%" height={200} borderRadius={radii.xl} style={{ marginTop: 16 }} />
          </View>
        ) : isError && !wallet ? (
          <ErrorState message="Could not load host dashboard." onRetry={refetch} />
        ) : (
          <>
            {/* Zero/Negative Balance Blocking Banner */}
            {isZeroOrNegative && (
              <View style={styles.blockingBanner}>
                <Text style={styles.blockingBannerIcon}>🚨</Text>
                <View style={styles.blockingBannerContent}>
                  <Text style={styles.blockingBannerTitle}>Booking Requests Paused</Text>
                  <Text style={styles.blockingBannerText}>
                    You cannot receive new bookings until you top up your wallet balance.
                  </Text>
                  <TouchableOpacity
                    style={styles.bannerTopupBtn}
                    onPress={() => router.push('/host-wallet/topup')}
                  >
                    <Text style={styles.bannerTopupBtnText}>Top Up Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Low Balance Warning Banner */}
            {isLowBalance && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningBannerIcon}>⚠️</Text>
                <View style={styles.warningBannerContent}>
                  <Text style={styles.warningBannerTitle}>Low Wallet Balance Warning</Text>
                  <Text style={styles.warningBannerText}>
                    Your balance is below {formatPaisaToRupees(warningThresholdPaisa)}. Please top up soon to ensure uninterrupted bookings.
                  </Text>
                </View>
              </View>
            )}

            {/* Wallet Overview Card */}
            <View style={styles.walletCard}>
              <View style={styles.walletHeader}>
                <Text style={styles.walletLabel}>PREPAID WALLET BALANCE</Text>
                <TouchableOpacity
                  onPress={() => router.push('/host-wallet')}
                  accessibilityRole="button"
                  accessibilityLabel="View wallet transactions"
                >
                  <Text style={styles.walletLink}>View Ledger ›</Text>
                </TouchableOpacity>
              </View>

              <MoneyText
                paisa={balancePaisa}
                style={{
                  fontSize: 28,
                  color: isZeroOrNegative ? colors.dangerDark : colors.emeraldDark,
                }}
              />
              <Text style={styles.walletSub}>Platform commission is deducted here when sessions complete.</Text>

              <View style={styles.walletBtnRow}>
                <Button
                  title="Top Up Wallet"
                  onPress={() => router.push('/host-wallet/topup')}
                  style={styles.walletTopupBtn}
                />
              </View>
            </View>

            {/* Incoming Requests Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Incoming Booking Requests</Text>
              {incomingRequests.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{incomingRequests.length}</Text>
                </View>
              )}
            </View>

            {incomingRequests.length === 0 ? (
              <View style={styles.emptyRequestsBox}>
                <Text style={styles.emptyRequestsText}>No incoming booking requests right now.</Text>
                <Text style={styles.emptyRequestsSub}>Requests will appear here with a live acceptance timer.</Text>
              </View>
            ) : (
              incomingRequests.map((booking) => (
                <RequestCard
                  key={booking.id}
                  booking={booking}
                  onAccept={handleAccept}
                  onDecline={(id) => setDeclineModalId(id)}
                  isAccepting={isAccepting}
                  isDeclining={isDeclining}
                />
              ))
            )}

            {/* Today's Active / Upcoming Bookings */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active & Upcoming Today</Text>
              <TouchableOpacity onPress={() => router.push('/host-bookings')}>
                <Text style={styles.seeAllText}>See all ›</Text>
              </TouchableOpacity>
            </View>

            {activeBookings.length === 0 ? (
              <View style={styles.emptyRequestsBox}>
                <Text style={styles.emptyRequestsText}>No active charging sessions right now.</Text>
              </View>
            ) : (
              activeBookings.slice(0, 3).map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.activeBookingCard}
                  onPress={() => router.push({ pathname: '/host-booking/[id]', params: { id: b.id } })}
                  activeOpacity={0.7}
                >
                  <View style={styles.activeBookingTop}>
                    <Text style={styles.activeBookingTitle}>{b.charger.title}</Text>
                    <StatusBadge status={b.status} />
                  </View>
                  <Text style={styles.activeBookingSlot}>
                    {formatInTimeZone(new Date(b.startsAt), TIMEZONE, 'h:mm a')} -{' '}
                    {formatInTimeZone(new Date(b.endsAt), TIMEZONE, 'h:mm a')}
                  </Text>
                  {b.driver?.name ? (
                    <Text style={styles.activeBookingDriver}>Driver: {b.driver.name}</Text>
                  ) : null}
                </TouchableOpacity>
              ))
            )}

            {/* Chargers Quick Overview */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Chargers</Text>
              <TouchableOpacity onPress={() => router.push('/host-chargers')}>
                <Text style={styles.seeAllText}>Manage ›</Text>
              </TouchableOpacity>
            </View>

            {chargers.length === 0 ? (
              <EmptyState
                title="No Chargers Added"
                description="List your home EV charger to start accepting bookings and earning."
                actionTitle="Add Charger"
                onAction={() => router.push('/host-charger/new')}
              />
            ) : (
              chargers.map((c) => (
                <View key={c.id} style={styles.chargerRowCard}>
                  <View style={styles.chargerRowInfo}>
                    <Text style={styles.chargerRowTitle}>{c.title}</Text>
                    <Text style={styles.chargerRowMeta}>
                      {c.powerKw} kW • {formatPaisaToRupees(c.pricePerKwhPaisa)}/kWh • {c.areaLabel}
                    </Text>
                    <View style={styles.approvalBadge}>
                      <Text
                        style={[
                          styles.approvalBadgeText,
                          c.approvalStatus === 'APPROVED' && styles.approvalApproved,
                          c.approvalStatus === 'PENDING' && styles.approvalPending,
                          c.approvalStatus === 'REJECTED' && styles.approvalRejected,
                        ]}
                      >
                        {c.approvalStatus}
                      </Text>
                    </View>
                  </View>

                  {c.approvalStatus === 'APPROVED' && (
                    <View style={styles.onlineSwitchContainer}>
                      <Text style={styles.onlineSwitchLabel}>
                        {c.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </Text>
                      <Switch
                        value={c.isOnline}
                        onValueChange={() => {
                          toggleOnline({ chargerId: c.id, isOnline: c.isOnline });
                        }}
                        disabled={isTogglingOnline}
                        trackColor={{ false: colors.border, true: colors.emeraldDark }}
                        thumbColor={colors.white}
                      />
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {/* Decline Reason Modal */}
        <Modal
          visible={Boolean(declineModalId)}
          transparent
          animationType="fade"
          onRequestClose={() => setDeclineModalId(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={[styles.modalIconBadge, { backgroundColor: colors.warningLight }]}>
                <Text style={{ fontSize: 24 }}>🛑</Text>
              </View>
              <Text style={styles.modalTitle}>Decline Booking Request</Text>
              <Text style={styles.modalSub}>
                Provide an optional reason to let the driver know why you cannot host them at this time.
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Personal car is currently charging, out of town"
                placeholderTextColor={colors.subtleText}
                value={declineReason}
                onChangeText={setDeclineReason}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalBtnRow}>
                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setDeclineModalId(null)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Decline"
                  variant="danger"
                  onPress={handleConfirmDecline}
                  loading={isDeclining}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </HostStatusGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  roleSwitcherContainer: {
    marginBottom: spacing.md,
  },
  skeletonContainer: {
    gap: 16,
  },
  blockingBanner: {
    flexDirection: 'row',
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  blockingBannerIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  blockingBannerContent: {
    flex: 1,
  },
  blockingBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991b1b',
    marginBottom: 2,
  },
  blockingBannerText: {
    fontSize: 13,
    color: '#7f1d1d',
    lineHeight: 18,
    marginBottom: 8,
  },
  bannerTopupBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  bannerTopupBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningBannerIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  warningBannerContent: {
    flex: 1,
  },
  warningBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 2,
  },
  warningBannerText: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 16,
  },
  walletCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.lg,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  walletLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.mutedText,
    letterSpacing: 0.8,
  },
  walletLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
  walletSub: {
    fontSize: 12,
    color: colors.subtleText,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  walletBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  walletTopupBtn: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
  countBadge: {
    backgroundColor: colors.danger,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  emptyRequestsBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyRequestsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedText,
  },
  emptyRequestsSub: {
    fontSize: 12,
    color: colors.subtleText,
    marginTop: 4,
  },
  requestCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.emeraldLight,
    marginBottom: spacing.md,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  requestBadge: {
    backgroundColor: '#ecfdf5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  requestBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.emeraldDark,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  countdownExpired: {
    color: colors.danger,
  },
  requestCharger: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2,
  },
  requestSlot: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: spacing.xs,
  },
  requestMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.md,
  },
  requestMetaItem: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.mutedText,
  },
  acceptBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.emeraldDark,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  activeBookingCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.sm,
  },
  activeBookingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeBookingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  activeBookingSlot: {
    fontSize: 13,
    color: colors.mutedText,
  },
  activeBookingDriver: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.emeraldDark,
    marginTop: 4,
  },
  chargerRowCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chargerRowInfo: {
    flex: 1,
  },
  chargerRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  chargerRowMeta: {
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: 4,
  },
  approvalBadge: {
    alignSelf: 'flex-start',
  },
  approvalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  approvalApproved: {
    color: colors.emeraldDark,
  },
  approvalPending: {
    color: colors.warningDark,
  },
  approvalRejected: {
    color: colors.dangerDark,
  },
  onlineSwitchContainer: {
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  onlineSwitchLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.mutedText,
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalBox: {
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
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  modalSub: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.ink,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
