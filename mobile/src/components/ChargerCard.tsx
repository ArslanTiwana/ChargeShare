import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from '@gorhom/bottom-sheet';
import { NearbyCharger } from '../api/chargers';
import { formatPaisaToRupees } from './MoneyText';
import { colors, radii, spacing } from '../theme';

export interface ChargerCardProps {
  charger: NearbyCharger;
  isSelected?: boolean;
  onPress: () => void;
}

export function ChargerCard({ charger, isSelected = false, onPress }: ChargerCardProps) {
  const formattedDistance =
    charger.distanceMeters != null
      ? charger.distanceMeters < 1000
        ? `${Math.round(charger.distanceMeters)} m`
        : `${(charger.distanceMeters / 1000).toFixed(1)} km`
      : null;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${charger.title}, ${charger.areaLabel}, ${charger.powerKw} kilowatts`}
      style={[styles.card, isSelected && styles.cardSelected]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {charger.title}
          </Text>
          <Text style={styles.areaLabel} numberOfLines={1}>
            📍 {charger.areaLabel}
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.priceAmount}>
            {formatPaisaToRupees(charger.pricePerKwhPaisa)}
          </Text>
          <Text style={styles.priceUnit}>/kWh</Text>
        </View>
      </View>

      <View style={styles.badgesRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>⚡ {charger.powerKw} kW</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🔌 {charger.connectorType}</Text>
        </View>
        {charger.hostRatingAverage != null && (
          <View style={styles.badgeRating}>
            <Text style={styles.badgeRatingText}>⭐ {charger.hostRatingAverage.toFixed(1)}</Text>
          </View>
        )}
        {formattedDistance && (
          <View style={styles.badgeDistance}>
            <Text style={styles.badgeDistanceText}>{formattedDistance}</Text>
          </View>
        )}
      </View>

      <View style={styles.actionRow}>
        <Text style={styles.actionText}>View details & book slots →</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    minHeight: 88,
  },
  cardSelected: {
    borderColor: colors.emerald,
    backgroundColor: colors.surfaceAlt,
    shadowColor: colors.emerald,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  areaLabel: {
    fontSize: 13,
    color: colors.mutedText,
    fontWeight: '500',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.emeraldDark,
  },
  priceUnit: {
    fontSize: 11,
    color: colors.subtleText,
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  actionRow: {
    marginTop: spacing.xs,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
  badge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  badgeRating: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  badgeRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  badgeDistance: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginLeft: 'auto',
  },
  badgeDistanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedText,
  },
});
