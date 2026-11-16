import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { colors, radii } from '../theme';

export interface PriceMarkerProps {
  id: string;
  lat: number;
  lng: number;
  pricePerKwhPaisa: number;
  isSelected?: boolean;
  onPress: () => void;
}

export const PriceMarker = memo(function PriceMarker({
  id,
  lat,
  lng,
  pricePerKwhPaisa,
  isSelected = false,
  onPress,
}: PriceMarkerProps) {
  const rs = Math.round(pricePerKwhPaisa / 100);

  return (
    <Marker
      identifier={id}
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={(e) => {
        e?.stopPropagation?.();
        onPress();
      }}
      tracksViewChanges={isSelected}
    >
      <View style={[styles.pill, isSelected && styles.pillSelected]}>
        <Text style={[styles.text, isSelected && styles.textSelected]}>
          Rs {rs}
        </Text>
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.emeraldDark,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.white,
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  pillSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.emerald,
    transform: [{ scale: 1.15 }],
  },
  text: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  textSelected: {
    color: colors.white,
  },
});
