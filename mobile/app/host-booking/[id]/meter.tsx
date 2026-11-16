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
import * as ImagePicker from 'expo-image-picker';
import { getBookingDetail, submitMeterReading } from '../../../src/api/bookings';
import { getPublicConfig } from '../../../src/api/config';
import { useAuthStore } from '../../../src/store/auth-store';
import { HostStatusGate } from '../../../src/components/HostStatusGate';
import { TextField } from '../../../src/components/TextField';
import { Button } from '../../../src/components/Button';
import { formatPaisaToRupees } from '../../../src/components/MoneyText';
import { computeSessionPreview } from '../../../src/utils/money';
import { uploadImageWithSignedUrl } from '../../../src/utils/upload-helper';
import { colors, radii, spacing } from '../../../src/theme';

export default function EnterMeterReadingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [kwhInput, setKwhInput] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [meterPhotoKey, setMeterPhotoKey] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Queries
  const { data: config } = useQuery({
    queryKey: ['public-config'],
    queryFn: getPublicConfig,
  });

  const { data: booking, isLoading } = useQuery({
    queryKey: ['host-booking-detail', id],
    queryFn: () => getBookingDetail(id as string),
    enabled: Boolean(id),
  });

  // Prepopulate if revising existing session
  React.useEffect(() => {
    if (booking?.session) {
      setKwhInput(booking.session.kwhDelivered.toString());
      if (booking.session.meterEndPhotoKey) {
        setMeterPhotoKey(booking.session.meterEndPhotoKey);
      }
    }
  }, [booking?.session]);

  const { user } = useAuthStore();
  const maxSessionKwh = config?.maxSessionKwh ?? 150;
  const commissionPercent = user?.commissionPercent ?? config?.commissionPercent ?? 15;
  const rateSnapshotPaisa = booking?.rateSnapshotPaisa ?? booking?.charger.pricePerKwhPaisa ?? 6000;

  // Live preview
  const preview = useMemo(() => {
    const kwhNum = parseFloat(kwhInput);
    if (isNaN(kwhNum) || kwhNum <= 0) {
      return { totalPaisa: 0, commissionPaisa: 0, hostNetPaisa: 0 };
    }
    return computeSessionPreview(kwhNum, rateSnapshotPaisa, commissionPercent);
  }, [kwhInput, rateSnapshotPaisa, commissionPercent]);

  // Camera capture only (launchCameraAsync) with permission rationale
  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera Permission Required',
        'Camera access is required to take an optional verification photo of your plug-in kWh meter.'
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const localUri = result.assets[0].uri;
        setIsUploadingPhoto(true);
        setUploadProgress(0.1);

        const key = await uploadImageWithSignedUrl(
          localUri,
          'METER_PHOTO',
          (p) => setUploadProgress(p)
        );

        setMeterPhotoKey(key);
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Could not upload meter photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Submit Mutation
  const submitMutation = useMutation({
    mutationFn: () => {
      const kwhNum = parseFloat(kwhInput);
      if (isNaN(kwhNum) || kwhNum <= 0) {
        throw new Error('Please enter a valid energy reading greater than 0 kWh.');
      }
      if (kwhNum > maxSessionKwh) {
        throw new Error(`Energy reading cannot exceed safety maximum of ${maxSessionKwh} kWh.`);
      }

      return submitMeterReading(id as string, {
        kwhDelivered: kwhNum,
        meterEndPhotoKey: meterPhotoKey,
        reason: revisionReason.trim() ? revisionReason.trim() : undefined,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['host-booking-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['host-bookings-list'] });
      queryClient.invalidateQueries({ queryKey: ['host-dashboard-bookings'] });
      Alert.alert(
        res.revised ? 'Reading Revised' : 'Reading Submitted',
        'Your reading has been recorded. The driver has 24 hours to review and confirm.',
        [{ text: 'OK', onPress: () => router.replace({ pathname: '/host-booking/[id]', params: { id } }) }]
      );
    },
    onError: (err: any) => {
      Alert.alert('Submission Failed', err?.message || 'Could not record meter reading.');
    },
  });

  if (isLoading || !booking) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.emeraldDark} />
      </View>
    );
  }

  const isRevising = booking.status === 'COMPLETED';

  return (
    <HostStatusGate>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerBox}>
          <Text style={styles.pageTitle}>
            {isRevising ? 'Revise Meter Reading' : 'Enter Meter Reading'}
          </Text>
          <Text style={styles.pageSub}>
            Read the kWh delivered from your plug-in sub-meter. Photos are optional.
          </Text>
        </View>

        {/* Input Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivered Energy (kWh)</Text>

          <TextField
            label="Total kWh Recorded"
            placeholder="e.g. 18.5"
            value={kwhInput}
            onChangeText={setKwhInput}
            keyboardType="decimal-pad"
            helperText={`Agreed rate: ${formatPaisaToRupees(rateSnapshotPaisa)}/kWh (Safety limit: ${maxSessionKwh} kWh)`}
          />

          {isRevising && (
            <TextField
              label="Reason for Revision"
              placeholder="e.g. Corrected decimal point error"
              value={revisionReason}
              onChangeText={setRevisionReason}
            />
          )}

          {/* Optional Photo Button */}
          <Text style={styles.photoFieldLabel}>Meter Verification Photo (Optional)</Text>
          <TouchableOpacity
            style={styles.photoActionBtn}
            onPress={handleTakePhoto}
            disabled={isUploadingPhoto}
            activeOpacity={0.8}
          >
            {isUploadingPhoto ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color={colors.emeraldDark} />
                <Text style={styles.uploadingText}>
                  Compressing & uploading... {Math.round(uploadProgress * 100)}%
                </Text>
              </View>
            ) : meterPhotoKey ? (
              <View style={styles.photoAttachedRow}>
                <Text style={styles.photoAttachedIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.photoAttachedTitle}>Meter Photo Attached</Text>
                  <Text style={styles.photoAttachedSub}>Tap to retake photo</Text>
                </View>
              </View>
            ) : (
              <View style={styles.takePhotoRow}>
                <Text style={styles.cameraIcon}>📸</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.takePhotoTitle}>Add photo of meter (recommended)</Text>
                  <Text style={styles.takePhotoSub}>Camera capture • Strips location metadata</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Live Calculation Preview Card */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Estimated Payment Summary</Text>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Driver Pays You Directly:</Text>
            <Text style={styles.previewGross}>
              {formatPaisaToRupees(preview.totalPaisa)}
            </Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Platform Commission ({commissionPercent}%):</Text>
            <Text style={styles.previewCommission}>
              -{formatPaisaToRupees(preview.commissionPaisa)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.previewRow}>
            <Text style={styles.netLabel}>Your Net Take-Home:</Text>
            <Text style={styles.netAmount}>
              {formatPaisaToRupees(preview.hostNetPaisa)}
            </Text>
          </View>

          <Text style={styles.calculationNote}>
            * You collect the full {formatPaisaToRupees(preview.totalPaisa)} directly from the driver in cash or transfer. The platform commission of {formatPaisaToRupees(preview.commissionPaisa)} is deducted from your prepaid wallet once confirmed.
          </Text>
        </View>

        <Button
          title={isRevising ? 'Submit Revision' : 'Submit Meter Reading'}
          onPress={() => submitMutation.mutate()}
          loading={submitMutation.isPending}
          style={styles.submitBtn}
        />
      </ScrollView>
    </HostStatusGate>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 50,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  headerBox: {
    marginBottom: spacing.md,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  pageSub: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
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
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  photoFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.xs,
    marginBottom: 6,
  },
  photoActionBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  uploadingText: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
  },
  photoAttachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  photoAttachedIcon: {
    fontSize: 24,
  },
  photoAttachedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
  photoAttachedSub: {
    fontSize: 11,
    color: colors.subtleText,
  },
  takePhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cameraIcon: {
    fontSize: 26,
  },
  takePhotoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  takePhotoSub: {
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
  previewCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.emeraldLight,
    marginBottom: spacing.lg,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewLabel: {
    fontSize: 13,
    color: colors.mutedText,
  },
  previewGross: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  previewCommission: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dangerDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.xs,
  },
  netLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  netAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.emeraldDark,
  },
  calculationNote: {
    fontSize: 11,
    color: colors.subtleText,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  submitBtn: {
    marginBottom: 30,
  },
});
