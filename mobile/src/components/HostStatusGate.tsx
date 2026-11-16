import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/auth-store';
import { applyHostApi } from '../api/auth';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, radii, spacing } from '../theme';

export interface HostStatusGateProps {
  children: React.ReactNode;
}

export function HostStatusGate({ children }: HostStatusGateProps) {
  const router = useRouter();
  const { user, setUser, setActiveRole } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyError, setApplyError] = useState('');

  if (!user) {
    return null;
  }

  // 1. APPROVED: render host screen children
  if (user.hostStatus === 'APPROVED') {
    return <>{children}</>;
  }

  // 2. PENDING: Application under review
  if (user.hostStatus === 'PENDING') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>⏳</Text>
          <Text style={styles.title}>Application Under Review</Text>
          <Text style={styles.description}>
            Thank you for applying to become a ChargeShare host! Your application is currently being reviewed by our administrative team.
          </Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Host reviews usually take less than 24 hours. You will receive access to your host dashboard as soon as you are approved.
            </Text>
          </View>
          <Button
            title="Switch back to Driver mode"
            variant="outline"
            onPress={() => setActiveRole('driver')}
            style={styles.switchButton}
          />
        </View>
      </View>
    );
  }

  // 3. SUSPENDED: Account suspended
  if (user.hostStatus === 'SUSPENDED') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>🚫</Text>
          <Text style={styles.title}>Host Privileges Suspended</Text>
          <Text style={styles.description}>
            Your host account has been suspended by administration. You cannot accept new bookings or manage chargers.
          </Text>
          <View style={[styles.infoBox, { backgroundColor: '#fee2e2' }]}>
            <Text style={[styles.infoText, { color: '#991b1b' }]}>
              Please contact platform support at support@chargeshare.pk to appeal this decision or restore your account.
            </Text>
          </View>
          <Button
            title="Switch to Driver mode"
            variant="outline"
            onPress={() => setActiveRole('driver')}
            style={styles.switchButton}
          />
        </View>
      </View>
    );
  }

  // 4. NONE: Prompt to apply
  const handleApply = async () => {
    if (!name.trim()) {
      setApplyError('Please enter your full name');
      return;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      setApplyError('Please enter a valid phone number (at least 10 digits)');
      return;
    }

    setIsSubmitting(true);
    setApplyError('');
    try {
      const res = await applyHostApi({
        name: name.trim(),
        phone: phone.trim(),
      });
      setUser({
        ...user,
        name: name.trim(),
        phone: phone.trim(),
        hostStatus: 'PENDING',
      });
      Alert.alert('Application Submitted', res.message);
    } catch (err: any) {
      setApplyError(err?.message || 'Could not submit host application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.icon}>⚡</Text>
        <Text style={styles.title}>Become a ChargeShare Host</Text>
        <Text style={styles.description}>
          Earn income by sharing your home EV charger with verified drivers across Pakistan.
        </Text>

        <View style={styles.benefitList}>
          <Text style={styles.benefitItem}>• Set your own charging schedule and rates (Rs/kWh)</Text>
          <Text style={styles.benefitItem}>• Safe, manual sub-meter tracking and driver verification</Text>
          <Text style={styles.benefitItem}>• Direct payments from drivers to you</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formHeader}>Host Contact Details</Text>
          <Text style={styles.formSub}>Name and phone are required for driver coordination.</Text>

          {applyError ? <Text style={styles.errorText}>{applyError}</Text> : null}

          <TextField
            label="Full Name"
            placeholder="e.g. Tariq Mehmood"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <TextField
            label="Phone Number"
            placeholder="03001234567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Button
            title="Submit Host Application"
            onPress={handleApply}
            loading={isSubmitting}
            style={styles.applyButton}
          />

          <Button
            title="Cancel & return to Driver"
            variant="outline"
            onPress={() => setActiveRole('driver')}
            style={styles.cancelButton}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.md,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  benefitList: {
    width: '100%',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
    gap: 8,
  },
  benefitItem: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.lg,
  },
  infoText: {
    fontSize: 13,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 18,
  },
  formContainer: {
    width: '100%',
  },
  formHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  formSub: {
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: colors.dangerDark,
    marginBottom: spacing.sm,
  },
  applyButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  cancelButton: {
    marginTop: spacing.xs,
  },
  switchButton: {
    width: '100%',
  },
});
