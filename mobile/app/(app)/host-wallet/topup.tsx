import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { getPublicConfig } from '../../../src/api/config';
import { getTopups, createTopup } from '../../../src/api/wallet';
import { HostStatusGate } from '../../../src/components/HostStatusGate';
import { TextField } from '../../../src/components/TextField';
import { Button } from '../../../src/components/Button';
import { formatPaisaToRupees } from '../../../src/components/MoneyText';
import { rupeeStringToPaisa } from '../../../src/utils/money';
import { uploadImageWithSignedUrl } from '../../../src/utils/upload-helper';
import { colors, radii, spacing } from '../../../src/theme';

export default function TopupScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [amountRupees, setAmountRupees] = useState('1000');
  const [reference, setReference] = useState('');
  const [screenshotKey, setScreenshotKey] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorText, setErrorText] = useState('');

  const { data: config } = useQuery({
    queryKey: ['public-config'],
    queryFn: getPublicConfig,
  });

  const { data: topupsData } = useQuery({
    queryKey: ['host-topups-list'],
    queryFn: () => getTopups(undefined, 10),
  });

  const minTopupPaisa = config?.minTopupPaisa ?? 50000;
  const maxTopupPaisa = config?.maxTopupPaisa ?? 50000000;
  const topupInstructions =
    config?.topupInstructions ||
    'Transfer funds to Easypaisa / JazzCash account: 0300-1234567 (Title: ChargeShare Admin). Save your transaction ID and upload a screenshot.';

  const pendingCount = (topupsData?.topups || []).filter((t) => t.status === 'PENDING').length;
  const isMaxPendingReached = pendingCount >= 3;

  const handlePickScreenshot = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        setIsUploading(true);
        setUploadProgress(0.1);

        const key = await uploadImageWithSignedUrl(
          res.assets[0].uri,
          'TOPUP_SCREENSHOT',
          (p) => setUploadProgress(p)
        );

        setScreenshotKey(key);
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Could not upload payment screenshot.');
    } finally {
      setIsUploading(false);
    }
  };

  const topupMutation = useMutation({
    mutationFn: () => {
      setErrorText('');

      let paisa: number;
      try {
        paisa = rupeeStringToPaisa(amountRupees);
      } catch (err: any) {
        throw new Error(err?.message || 'Invalid amount.');
      }

      if (paisa < minTopupPaisa || paisa > maxTopupPaisa) {
        throw new Error(
          `Deposit amount must be between ${formatPaisaToRupees(minTopupPaisa)} and ${formatPaisaToRupees(maxTopupPaisa)}.`
        );
      }

      if (!reference.trim()) {
        throw new Error('Please enter the payment transaction ID or bank reference.');
      }

      if (!screenshotKey) {
        throw new Error('Please upload a screenshot of your payment receipt.');
      }

      return createTopup({
        amountPaisa: paisa,
        reference: reference.trim(),
        screenshotKey,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-topups-list'] });
      queryClient.invalidateQueries({ queryKey: ['host-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['host-wallet-full'] });
      Alert.alert(
        'Top-up Submitted',
        'Your top-up request has been submitted for admin verification. Funds will be credited once confirmed.',
        [{ text: 'OK', onPress: () => router.replace('/(app)/host-wallet') }]
      );
    },
    onError: (err: any) => {
      setErrorText(err?.message || 'Failed to submit top-up.');
    },
  });

  return (
    <HostStatusGate>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Top Up Wallet</Text>
          <Text style={styles.sub}>
            Prepay platform commission in advance via Easypaisa or JazzCash.
          </Text>
        </View>

        {/* Max Pending Reached Alert */}
        {isMaxPendingReached && (
          <View style={styles.pendingLimitBox}>
            <Text style={styles.pendingLimitTitle}>Pending Request Limit Reached</Text>
            <Text style={styles.pendingLimitText}>
              You currently have 3 pending top-up requests under admin review. Please wait for them to be processed before submitting another request.
            </Text>
          </View>
        )}

        {/* Instructions Box */}
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsHeader}>Payment Instructions</Text>
          <Text style={styles.instructionsBody}>{topupInstructions}</Text>
        </View>

        {errorText ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorText}</Text>
          </View>
        ) : null}

        {/* Form Inputs */}
        <View style={styles.card}>
          <TextField
            label="Deposit Amount (PKR)"
            placeholder="1000"
            value={amountRupees}
            onChangeText={setAmountRupees}
            keyboardType="decimal-pad"
            helperText={`Min: ${formatPaisaToRupees(minTopupPaisa)} • Max: ${formatPaisaToRupees(maxTopupPaisa)}`}
          />

          <TextField
            label="Transaction ID / Payment Reference"
            placeholder="e.g. TRX12345678"
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
          />

          {/* Screenshot Upload Button */}
          <Text style={styles.fieldLabel}>Payment Screenshot (Receipt)</Text>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={handlePickScreenshot}
            disabled={isUploading || isMaxPendingReached}
            activeOpacity={0.8}
          >
            {isUploading ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color={colors.emeraldDark} />
                <Text style={styles.uploadingText}>
                  Uploading receipt... {Math.round(uploadProgress * 100)}%
                </Text>
              </View>
            ) : screenshotKey ? (
              <View style={styles.uploadedRow}>
                <Text style={styles.checkIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadedTitle}>Payment Receipt Uploaded</Text>
                  <Text style={styles.uploadedSub}>Tap to change screenshot</Text>
                </View>
              </View>
            ) : (
              <View style={styles.pickRow}>
                <Text style={styles.pickIcon}>📎</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickTitle}>Select Screenshot from Gallery</Text>
                  <Text style={styles.pickSub}>PNG or JPEG • Max 5 MB</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Button
          title={isMaxPendingReached ? 'Limit Reached (3 Pending)' : 'Submit Top-up Request'}
          onPress={() => topupMutation.mutate()}
          loading={topupMutation.isPending}
          disabled={isMaxPendingReached}
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
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
  },
  pendingLimitBox: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pendingLimitTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991b1b',
    marginBottom: 4,
  },
  pendingLimitText: {
    fontSize: 12,
    color: '#7f1d1d',
    lineHeight: 16,
  },
  instructionsBox: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  instructionsHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e40af',
    marginBottom: 4,
  },
  instructionsBody: {
    fontSize: 12,
    color: '#1e3a8a',
    lineHeight: 18,
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
    fontSize: 13,
    color: '#991b1b',
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
    marginTop: spacing.xs,
  },
  uploadBtn: {
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
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkIcon: {
    fontSize: 22,
  },
  uploadedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
  uploadedSub: {
    fontSize: 11,
    color: colors.subtleText,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickIcon: {
    fontSize: 24,
  },
  pickTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  pickSub: {
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
  submitBtn: {
    marginBottom: 20,
  },
});
