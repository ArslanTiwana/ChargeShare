import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { getChargerDetail, getChargerReviews } from '../../src/api/chargers';
import { useAvailability } from '../../src/hooks/useAvailability';
import { createBooking } from '../../src/api/bookings';
import { getPublicConfig } from '../../src/api/config';
import { useAuthStore } from '../../src/store/auth-store';
import { SlotPicker } from '../../src/components/SlotPicker';
import { Button } from '../../src/components/Button';
import { formatPaisaToRupees } from '../../src/components/MoneyText';
import { Skeleton } from '../../src/components/Skeleton';
import { ErrorState } from '../../src/components/ErrorState';
import { mapBookingErrorCode } from '../../src/utils/booking-errors';
import { colors, radii, spacing } from '../../src/theme';
import { showToast, showConfirm } from '../../src/store/ui-store';

const TIMEZONE = 'Asia/Karachi';

export default function ChargerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const todayStr = useMemo(() => formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd'), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedStartsAt, setSelectedStartsAt] = useState<string | null>(null);
  const [selectedEndsAt, setSelectedEndsAt] = useState<string | null>(null);
  const [selectedDurationHours, setSelectedDurationHours] = useState(2);

  // Fetch Public Config
  const configQuery = useQuery({
    queryKey: ['public-config'],
    queryFn: getPublicConfig,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch Charger Details
  const chargerQuery = useQuery({
    queryKey: ['charger-detail', id],
    queryFn: () => getChargerDetail(id as string),
    enabled: Boolean(id),
  });

  // Fetch Availability
  const availabilityQuery = useAvailability(id as string, selectedDate);

  // Fetch Reviews
  const reviewsQuery = useQuery({
    queryKey: ['charger-reviews', id],
    queryFn: () => getChargerReviews(id as string, undefined, 5),
    enabled: Boolean(id),
  });

  // Calculate labeled estimate
  const estimate = useMemo(() => {
    if (!chargerQuery.data) return null;
    const power = Number(chargerQuery.data.powerKw);
    const estKwh = Number((power * selectedDurationHours).toFixed(2));
    const ratePaisa = chargerQuery.data.pricePerKwhPaisa;
    const estCostPaisa = Math.round(estKwh * ratePaisa);

    return {
      kwh: estKwh,
      costPaisa: estCostPaisa,
    };
  }, [chargerQuery.data, selectedDurationHours]);

  // Handle slot selection
  const handleSelectSlot = (startsAtISO: string, endsAtISO: string) => {
    setSelectedStartsAt(startsAtISO);
    setSelectedEndsAt(endsAtISO);
  };

  // Create Booking Mutation
  const bookingMutation = useMutation({
    mutationFn: () => {
      if (!id || !selectedStartsAt || !selectedEndsAt) {
        throw new Error('Please select a time slot first.');
      }
      return createBooking({
        chargerId: id,
        startsAt: selectedStartsAt,
        endsAt: selectedEndsAt,
        estimatedKwh: estimate?.kwh,
      });
    },
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['charger-availability', id] });
      showToast({
        title: 'Request Sent',
        message: 'Your booking request has been sent to the host.',
        type: 'success',
      });
      router.replace({ pathname: '/bookings/[id]', params: { id: booking.id } });
    },
    onError: (err: any) => {
      const { title, message, action } = mapBookingErrorCode(err?.code, err?.message);
      if (action === 'profile') {
        showConfirm({
          title,
          message,
          icon: '👤',
          confirmText: 'Go to Profile',
          onConfirm: () => router.push('/profile'),
        });
      } else if (action === 'refetch') {
        showToast({ title, message, type: 'error' });
        availabilityQuery.refetch();
      } else {
        showToast({ title, message, type: 'error' });
      }
    },
  });

  const handleRequestBooking = () => {
    if (!user?.phone) {
      showConfirm({
        title: 'Phone Number Required',
        message: 'Please add a phone number to your profile before requesting a booking so the host can contact you.',
        icon: '📱',
        confirmText: 'Add Phone in Profile',
        cancelText: 'Cancel',
        onConfirm: () => router.push('/profile'),
      });
      return;
    }

    if (!selectedStartsAt || !selectedEndsAt) {
      showToast({ message: 'Please tap an available start time slot below.', type: 'warning' });
      return;
    }

    bookingMutation.mutate();
  };

  if (chargerQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Skeleton width="100%" height={160} style={{ marginBottom: 16 }} />
        <Skeleton width="80%" height={24} style={{ marginBottom: 8 }} />
        <Skeleton width="50%" height={20} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={240} />
      </View>
    );
  }

  if (chargerQuery.isError || !chargerQuery.data) {
    return (
      <ErrorState
        message={(chargerQuery.error as Error)?.message || 'Failed to load charger details'}
        onRetry={chargerQuery.refetch}
      />
    );
  }

  const charger = chargerQuery.data;
  const hostFirstName = charger.hostName ? charger.hostName.split(' ')[0] : 'Host';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title & Host Header */}
      <View style={styles.headerBlock}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>⚡ {charger.powerKw} kW</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🔌 {charger.connectorType}</Text>
          </View>
          {charger.meterInstalled && (
            <View style={styles.badgeMeter}>
              <Text style={styles.badgeMeterText}>✓ Submetered</Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{charger.title}</Text>
        <Text style={styles.subtitle}>
          Hosted by {hostFirstName} • 📍 Sector {charger.areaLabel}
        </Text>

        {charger.hostRatingAverage != null && (
          <View style={styles.ratingRow}>
            <Text style={styles.starText}>⭐ {charger.hostRatingAverage.toFixed(1)}</Text>
            <Text style={styles.reviewCount}>
              ({charger.reviewCount} {charger.reviewCount === 1 ? 'review' : 'reviews'})
            </Text>
          </View>
        )}
      </View>

      {/* Rate Banner */}
      <View style={styles.rateCard}>
        <View>
          <Text style={styles.rateLabel}>Charging Rate</Text>
          <Text style={styles.rateAmount}>
            {formatPaisaToRupees(charger.pricePerKwhPaisa)}
            <Text style={styles.rateUnit}> / kWh</Text>
          </Text>
        </View>
        <Text style={styles.payDirectTag}>Direct Cash / Transfer to Host</Text>
      </View>

      {/* Host Notes */}
      {charger.notes ? (
        <View style={styles.notesBlock}>
          <Text style={styles.notesHeader}>Host Notes & Parking Access</Text>
          <Text style={styles.notesBody}>{charger.notes}</Text>
        </View>
      ) : null}

      {/* Slot Picker Component */}
      <SlotPicker
        selectedDate={selectedDate}
        onSelectDate={(d: string) => {
          setSelectedDate(d);
          setSelectedStartsAt(null);
          setSelectedEndsAt(null);
        }}
        selectedStartsAt={selectedStartsAt}
        selectedDurationHours={selectedDurationHours}
        onSelectDuration={(h: number) => {
          setSelectedDurationHours(h);
          setSelectedStartsAt(null);
          setSelectedEndsAt(null);
        }}
        onSelectSlot={handleSelectSlot}
        bookedSlots={availabilityQuery.data?.bookedSlots || []}
        minDurationHours={1}
        maxDurationHours={3}
        isLoading={availabilityQuery.isLoading}
      />

      {/* Labeled Estimate Card */}
      {estimate && (
        <View style={styles.estimateCard}>
          <Text style={styles.estimateTitle}>ESTIMATED SESSION COST</Text>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateKwh}>
              ~{estimate.kwh} kWh ({selectedDurationHours} hr @ {charger.powerKw} kW)
            </Text>
            <Text style={styles.estimateCost}>
              ~{formatPaisaToRupees(estimate.costPaisa)}
            </Text>
          </View>
          <Text style={styles.estimateDisclaimer}>
            💡 You pay the host directly based on the meter reading.
          </Text>
        </View>
      )}

      {/* Request Booking Primary Action */}
      <Button
        title={
          bookingMutation.isPending
            ? 'Submitting Request...'
            : selectedStartsAt
            ? 'Request Booking'
            : 'Select a Time Slot Above'
        }
        onPress={handleRequestBooking}
        disabled={!selectedStartsAt || bookingMutation.isPending}
        loading={bookingMutation.isPending}
        style={styles.requestButton}
      />

      {/* Recent Reviews Section */}
      <View style={styles.reviewsSection}>
        <Text style={styles.reviewsSectionTitle}>Host Reviews</Text>
        {reviewsQuery.isLoading ? (
          <ActivityIndicator size="small" color={colors.emerald} style={{ marginVertical: 12 }} />
        ) : !reviewsQuery.data?.reviews.length ? (
          <Text style={styles.noReviewsText}>No driver reviews for this host yet.</Text>
        ) : (
          reviewsQuery.data.reviews.map((rev: any) => (
            <View key={rev.id} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>{rev.reviewerName}</Text>
                <Text style={styles.reviewRating}>{'⭐'.repeat(rev.rating)}</Text>
              </View>
              {rev.comment ? <Text style={styles.reviewComment}>{rev.comment}</Text> : null}
            </View>
          ))
        )}
      </View>
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
  headerBlock: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  badge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  badgeMeter: {
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  badgeMeterText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedText,
    fontWeight: '500',
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  reviewCount: {
    fontSize: 13,
    color: colors.subtleText,
  },
  rateCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.emeraldDark,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.emeraldLight,
    marginBottom: 2,
  },
  rateAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.white,
  },
  rateUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.emeraldLight,
  },
  payDirectTag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.emeraldLight,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  notesBlock: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  notesHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  notesBody: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
  },
  estimateCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: spacing.lg,
  },
  estimateTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  estimateKwh: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78350F',
  },
  estimateCost: {
    fontSize: 18,
    fontWeight: '800',
    color: '#78350F',
  },
  estimateDisclaimer: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    marginTop: 4,
  },
  requestButton: {
    marginBottom: spacing.xl,
  },
  reviewsSection: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  reviewsSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  noReviewsText: {
    fontSize: 13,
    color: colors.subtleText,
    fontStyle: 'italic',
  },
  reviewItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingVertical: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  reviewRating: {
    fontSize: 11,
  },
  reviewComment: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 16,
  },
});
