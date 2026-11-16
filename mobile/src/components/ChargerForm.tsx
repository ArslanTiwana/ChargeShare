import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { ConnectorType } from '../api/chargers';
import { TextField } from './TextField';
import { Button } from './Button';
import { rupeeStringToPaisa } from '../utils/money';
import { colors, radii, spacing } from '../theme';

const CONNECTOR_OPTIONS: Array<{ label: string; value: ConnectorType }> = [
  { label: 'Type 2 (IEC 62196)', value: 'TYPE2' },
  { label: 'CCS 2 (Combined)', value: 'CCS2' },
  { label: 'GB/T (China Standard)', value: 'GBT' },
  { label: 'CHAdeMO (Fast DC)', value: 'CHADEMO' },
  { label: '3-Pin Wall Socket (16A)', value: 'SOCKET_3PIN' },
];

const ISLAMABAD_COORDS = {
  latitude: 33.6844,
  longitude: 73.0479,
};

export interface ChargerFormData {
  title: string;
  powerKw: number;
  connectorType: ConnectorType;
  pricePerKwhPaisa: number;
  areaLabel: string;
  addressLine: string;
  notes?: string | null;
  meterInstalled: boolean;
  lat: number;
  lng: number;
}

export interface ChargerFormProps {
  initialValues?: Partial<ChargerFormData>;
  isEditing?: boolean;
  onSubmit: (data: ChargerFormData) => Promise<void>;
  isSubmitting?: boolean;
  submitButtonText?: string;
}

export function ChargerForm({
  initialValues,
  isEditing = false,
  onSubmit,
  isSubmitting = false,
  submitButtonText = 'Save Charger',
}: ChargerFormProps) {
  const mapRef = useRef<MapView>(null);

  const [title, setTitle] = useState(initialValues?.title || '');
  const [powerKw, setPowerKw] = useState(initialValues?.powerKw ? initialValues.powerKw.toString() : '7.4');
  const [connectorType, setConnectorType] = useState<ConnectorType>(initialValues?.connectorType || 'TYPE2');
  const [priceRupees, setPriceRupees] = useState(
    initialValues?.pricePerKwhPaisa ? (initialValues.pricePerKwhPaisa / 100).toString() : '65'
  );
  const [areaLabel, setAreaLabel] = useState(initialValues?.areaLabel || '');
  const [addressLine, setAddressLine] = useState(initialValues?.addressLine || '');
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [meterInstalled, setMeterInstalled] = useState(initialValues?.meterInstalled ?? true);

  // Exact location coordinate
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: initialValues?.lat || ISLAMABAD_COORDS.latitude,
    longitude: initialValues?.lng || ISLAMABAD_COORDS.longitude,
  });

  const [isLocating, setIsLocating] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch current GPS position if adding new charger
  useEffect(() => {
    if (!isEditing && !initialValues?.lat) {
      handleUseCurrentLocation();
    }
  }, []);

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocationCoords(coords);
        mapRef.current?.animateToRegion(
          {
            ...coords,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          600
        );
      }
    } catch {
      // Keep existing location
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async () => {
    setFormError('');

    if (!title.trim() || title.trim().length < 3) {
      setFormError('Charger title must be at least 3 characters.');
      return;
    }

    const powerNum = parseFloat(powerKw);
    if (isNaN(powerNum) || powerNum <= 0 || powerNum > 350) {
      setFormError('Power rating must be a valid number between 0.1 and 350 kW.');
      return;
    }

    let pricePaisa: number;
    try {
      pricePaisa = rupeeStringToPaisa(priceRupees);
    } catch (err: any) {
      setFormError(err?.message || 'Invalid rate per kWh.');
      return;
    }

    if (!areaLabel.trim() || areaLabel.trim().length < 2) {
      setFormError('Area label (e.g. "F-10", "DHA Phase 5") is required for discovery.');
      return;
    }

    if (!addressLine.trim() || addressLine.trim().length < 5) {
      setFormError('Exact street address must be at least 5 characters.');
      return;
    }

    if (!meterInstalled) {
      Alert.alert(
        'Sub-meter Required',
        'ChargeShare requires a dedicated plug-in kWh sub-meter (rated 16A or higher) to accurately measure charging energy.'
      );
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        powerKw: powerNum,
        connectorType,
        pricePerKwhPaisa: pricePaisa,
        areaLabel: areaLabel.trim(),
        addressLine: addressLine.trim(),
        notes: notes.trim() ? notes.trim() : null,
        meterInstalled,
        lat: Number(locationCoords.latitude.toFixed(6)),
        lng: Number(locationCoords.longitude.toFixed(6)),
      });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save charger.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {formError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {formError}</Text>
        </View>
      ) : null}

      {isEditing && (
        <View style={styles.priceWarningBox}>
          <Text style={styles.priceWarningTitle}>ℹ️ Editing Existing Charger</Text>
          <Text style={styles.priceWarningText}>
            Updating the price or specifications will apply to new bookings only. Already accepted or requested bookings keep their snapshot rate.
          </Text>
        </View>
      )}

      {/* Basic Specs */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Charger Specifications</Text>

        <TextField
          label="Charger Title"
          placeholder="e.g. F-10 Home Fast EV Point"
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Power Rating (kW)"
              placeholder="7.4"
              value={powerKw}
              onChangeText={setPowerKw}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Price (Rs / kWh)"
              placeholder="65"
              value={priceRupees}
              onChangeText={setPriceRupees}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Connector Type Selector */}
        <Text style={styles.fieldLabel}>Connector Type</Text>
        <View style={styles.connectorGrid}>
          {CONNECTOR_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.connectorChip,
                connectorType === opt.value && styles.connectorChipActive,
              ]}
              onPress={() => setConnectorType(opt.value)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.connectorChipText,
                  connectorType === opt.value && styles.connectorChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Meter Hardware Guidance */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Metering Hardware</Text>
        <Text style={styles.meterDesc}>
          ChargeShare v1 uses manual sub-meter verification. You must install a dedicated plug-in or inline kWh sub-meter rated at 16A or higher.
        </Text>

        <View style={styles.switchRow}>
          <Switch
            value={meterInstalled}
            onValueChange={setMeterInstalled}
            trackColor={{ false: colors.border, true: colors.emeraldDark }}
            thumbColor={colors.white}
          />
          <Text style={styles.switchText}>
            I confirm a 16A+ plug-in kWh meter is installed for this charger
          </Text>
        </View>
      </View>

      {/* Location & Map Pin */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Charger Location</Text>
        <Text style={styles.privacyNote}>
          🛡️ <Text style={{ fontWeight: '700' }}>Privacy Guarantee:</Text> Drivers only see an approximate pin (~150-300m offset) and your Area Label during search. Your exact address and pin are revealed only after you accept a booking.
        </Text>

        <TextField
          label="Area Label (Public)"
          placeholder="e.g. F-10, Islamabad or DHA Phase 5"
          value={areaLabel}
          onChangeText={setAreaLabel}
        />

        <TextField
          label="Exact Address Line (Private)"
          placeholder="e.g. House 42, Street 18, Sector F-10/2"
          value={addressLine}
          onChangeText={setAddressLine}
        />

        <TextField
          label="Access & Parking Notes (Optional)"
          placeholder="e.g. Driveway on the left, gate code or buzzer instructions"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />

        {/* Map Pin Dropper */}
        <View style={styles.mapHeaderRow}>
          <Text style={styles.fieldLabel}>Drop Exact Location Pin</Text>
          <TouchableOpacity
            onPress={handleUseCurrentLocation}
            disabled={isLocating}
            style={styles.recenterBtn}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={colors.emeraldDark} />
            ) : (
              <Text style={styles.recenterBtnText}>📍 Use My Location</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.mapHelp}>
          Drag the pin on the map to place it at your exact parking spot.
        </Text>

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: locationCoords.latitude,
              longitude: locationCoords.longitude,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            }}
          >
            <Marker
              coordinate={locationCoords}
              draggable
              onDragEnd={(e) => setLocationCoords(e.nativeEvent.coordinate)}
              title="Charger Location"
              description="Drag to exact spot"
              pinColor={colors.emeraldDark}
            />
          </MapView>
        </View>
      </View>

      <Button
        title={submitButtonText}
        onPress={handleSubmit}
        loading={isSubmitting}
        style={styles.submitBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 50,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  priceWarningBox: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  priceWarningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e40af',
  },
  priceWarningText: {
    fontSize: 12,
    color: '#1e3a8a',
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  connectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  connectorChip: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  connectorChipActive: {
    backgroundColor: colors.emeraldDark,
    borderColor: colors.emeraldDark,
  },
  connectorChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  connectorChipTextActive: {
    color: colors.white,
  },
  meterDesc: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  switchText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
    flex: 1,
  },
  privacyNote: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    fontSize: 12,
    color: '#14532d',
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  recenterBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  recenterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
  mapHelp: {
    fontSize: 11,
    color: colors.subtleText,
    marginBottom: 6,
  },
  mapContainer: {
    height: 180,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: 4,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
});
