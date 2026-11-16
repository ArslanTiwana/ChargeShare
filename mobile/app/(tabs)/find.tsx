import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useNearbyChargers } from '../../src/hooks/useNearbyChargers';
import { NearbyCharger, ConnectorType } from '../../src/api/chargers';
import { calculateRadiusFromRegion } from '../../src/utils/nearby-request';
import {
  PriceMarker,
  ChargerCard,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
} from '../../src/components';
import { colors, radii, spacing } from '../../src/theme';

const ISLAMABAD_FALLBACK = {
  latitude: 33.6844,
  longitude: 73.0479,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const MUTED_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e8e5' }] },
];

export default function FindScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  // User location & map region
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchParams, setSearchParams] = useState<{ lat: number; lng: number; radiusKm: number }>({
    lat: ISLAMABAD_FALLBACK.latitude,
    lng: ISLAMABAD_FALLBACK.longitude,
    radiusKm: 15,
  });
  const [mapRegion, setMapRegion] = useState<Region>(ISLAMABAD_FALLBACK);
  const [showSearchAreaBtn, setShowSearchAreaBtn] = useState(false);
  const isSelectingMarkerRef = useRef(false);

  // Location Permission Modal Rationale
  const [showPermissionRationale, setShowPermissionRationale] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);

  // Selected Charger & Filters
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null);
  const [fastOnly, setFastOnly] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<ConnectorType | null>(null);

  // Query nearby chargers based on active search parameters
  const { chargers, totalFound, isLoading, isError, error, refetch } = useNearbyChargers({
    lat: searchParams.lat,
    lng: searchParams.lng,
    radiusKm: searchParams.radiusKm,
    fastOnly,
    connectorType: selectedConnector,
  });

  // Sort selected charger to the top when selected
  const displayedChargers = useMemo(() => {
    if (!selectedChargerId) return chargers;
    const selected = chargers.find((c) => c.id === selectedChargerId);
    if (!selected) return chargers;
    return [selected, ...chargers.filter((c) => c.id !== selectedChargerId)];
  }, [chargers, selectedChargerId]);

  // Check initial location permission
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        fetchUserLocation();
      } else {
        setShowPermissionRationale(true);
      }
    })();
  }, []);

  const fetchUserLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLocation(coords);
      setSearchParams({
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: 15,
      });
      mapRef.current?.animateToRegion(
        {
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        },
        600
      );
    } catch {
      // Fallback silently to Islamabad
    }
  };

  const handleRequestPermission = async () => {
    setShowPermissionRationale(false);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationPermissionGranted(true);
      fetchUserLocation();
    }
  };

  const handleDismissPermission = () => {
    setShowPermissionRationale(false);
  };

  // Region change handler for "Search this area" button
  const handleRegionChangeComplete = useCallback((region: Region) => {
    setMapRegion(region);
    if (isSelectingMarkerRef.current) {
      isSelectingMarkerRef.current = false;
      return;
    }
    // Rough distance calculation from previous search center
    const latDiff = Math.abs(region.latitude - searchParams.lat);
    const lngDiff = Math.abs(region.longitude - searchParams.lng);
    // If moved > ~2 km
    if (latDiff > 0.02 || lngDiff > 0.02) {
      setShowSearchAreaBtn(true);
    }
  }, [searchParams]);

  const handleSearchThisArea = () => {
    const dynamicRadius = calculateRadiusFromRegion(mapRegion);
    setSearchParams({
      lat: mapRegion.latitude,
      lng: mapRegion.longitude,
      radiusKm: dynamicRadius,
    });
    setShowSearchAreaBtn(false);
  };

  const handleRecenter = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion(
        {
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        },
        500
      );
      setSearchParams({
        lat: userLocation.lat,
        lng: userLocation.lng,
        radiusKm: 15,
      });
      setShowSearchAreaBtn(false);
    } else {
      fetchUserLocation();
    }
  };

  const handleSelectMarker = (charger: NearbyCharger) => {
    if (selectedChargerId === charger.id) {
      handleOpenDetail(charger.id);
      return;
    }
    isSelectingMarkerRef.current = true;
    setSelectedChargerId(charger.id);
    mapRef.current?.animateToRegion(
      {
        latitude: charger.publicLat,
        longitude: charger.publicLng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      },
      400
    );
    bottomSheetRef.current?.snapToIndex(1); // expand to 50%
  };

  const handleOpenDetail = (chargerId: string) => {
    router.push({
      pathname: '/charger/[id]',
      params: { id: chargerId },
    });
  };

  const snapPoints = useMemo(() => ['18%', '50%', '85%'], []);

  return (
    <View style={styles.container}>
      {/* Full-screen Google Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MUTED_MAP_STYLE}
        style={StyleSheet.absoluteFill}
        initialRegion={ISLAMABAD_FALLBACK}
        showsUserLocation={locationPermissionGranted}
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {chargers.map((c) => (
          <PriceMarker
            key={c.id}
            id={c.id}
            lat={c.publicLat}
            lng={c.publicLng}
            pricePerKwhPaisa={c.pricePerKwhPaisa}
            isSelected={c.id === selectedChargerId}
            onPress={() => handleSelectMarker(c)}
          />
        ))}
      </MapView>

      {/* Top Floating Filter Bar */}
      <View style={styles.topBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              !fastOnly && !selectedConnector && styles.filterChipActive,
            ]}
            onPress={() => {
              setFastOnly(false);
              setSelectedConnector(null);
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                !fastOnly && !selectedConnector && styles.filterChipTextActive,
              ]}
            >
              All ({totalFound})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, fastOnly && styles.filterChipActive]}
            onPress={() => setFastOnly((prev) => !prev)}
          >
            <Text
              style={[
                styles.filterChipText,
                fastOnly && styles.filterChipTextActive,
              ]}
            >
              ⚡ 7 kW+ Fast
            </Text>
          </TouchableOpacity>

          {(['TYPE2', 'CCS2', 'GBT', 'SOCKET_3PIN'] as ConnectorType[]).map((type) => {
            const isSelected = selectedConnector === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setSelectedConnector(isSelected ? null : type)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Floating "Search This Area" Button */}
      {showSearchAreaBtn && (
        <View style={styles.searchAreaBtnWrapper}>
          <TouchableOpacity
            style={styles.searchAreaBtn}
            activeOpacity={0.85}
            onPress={handleSearchThisArea}
            accessibilityRole="button"
            accessibilityLabel="Search chargers in this area"
          >
            <Text style={styles.searchAreaBtnText}>🔍 Search this area</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recenter Button */}
      <TouchableOpacity
        style={styles.recenterBtn}
        activeOpacity={0.8}
        onPress={handleRecenter}
        accessibilityRole="button"
        accessibilityLabel="Recenter map to my location"
      >
        <Text style={styles.recenterIcon}>📍</Text>
      </TouchableOpacity>

      {/* Bottom Sheet Synced Charger List */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={styles.bottomSheetBg}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>
            {isLoading
              ? 'Searching chargers...'
              : selectedChargerId
              ? `1 Selected • ${chargers.length} Nearby`
              : `${chargers.length} Chargers Nearby`}
          </Text>
          <Text style={styles.sheetSubtitle}>
            Tap a charger to view details & book slots
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.skeletonContainer}>
            <Skeleton width="100%" height={90} style={{ marginBottom: 12, borderRadius: 14 }} />
            <Skeleton width="100%" height={90} style={{ marginBottom: 12, borderRadius: 14 }} />
          </View>
        ) : isError ? (
          <ErrorState
            message={(error as Error)?.message || 'Failed to load chargers nearby'}
            onRetry={refetch}
          />
        ) : chargers.length === 0 ? (
          <EmptyState
            title="No Chargers Found"
            description="Try panning the map or tapping 'Search this area' to find chargers in neighboring sectors."
          />
        ) : (
          <BottomSheetFlatList
            data={displayedChargers}
            keyExtractor={(item: NearbyCharger) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }: { item: NearbyCharger }) => (
              <ChargerCard
                charger={item}
                isSelected={item.id === selectedChargerId}
                onPress={() => handleOpenDetail(item.id)}
              />
            )}
          />
        )}
      </BottomSheet>

      {/* Location Permission Friendly Rationale Modal */}
      <Modal
        visible={showPermissionRationale}
        transparent
        animationType="fade"
        onRequestClose={handleDismissPermission}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rationaleCard}>
            <View style={styles.rationaleIconBadge}>
              <Text style={styles.rationaleIcon}>🗺️</Text>
            </View>
            <Text style={styles.rationaleTitle}>Find nearby EV chargers</Text>
            <Text style={styles.rationaleText}>
              ChargeShare uses your approximate location to show residential EV chargers in your sector and estimate driving distances.
            </Text>
            <Button
              title="Allow Location Access"
              onPress={handleRequestPermission}
              style={{ marginBottom: spacing.sm, width: '100%' }}
            />
            <TouchableOpacity
              onPress={handleDismissPermission}
              style={styles.rationaleDismissBtn}
              accessibilityRole="button"
            >
              <Text style={styles.rationaleDismissText}>Not Now (Use Islamabad Center)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },
  topBar: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  filterChip: {
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  filterChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  searchAreaBtnWrapper: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  searchAreaBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.emerald,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  searchAreaBtnText: {
    color: colors.emeraldDark,
    fontSize: 13,
    fontWeight: '800',
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: '22%',
    backgroundColor: colors.white,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    zIndex: 5,
  },
  recenterIcon: {
    fontSize: 22,
  },
  bottomSheetBg: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    elevation: 10,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.border,
    width: 40,
  },
  sheetHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  skeletonContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  rationaleCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    width: '100%',
    alignItems: 'center',
    elevation: 6,
  },
  rationaleIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.emeraldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  rationaleIcon: {
    fontSize: 28,
  },
  rationaleTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  rationaleText: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  rationaleDismissBtn: {
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  rationaleDismissText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
  },
});
