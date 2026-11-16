import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '../../src/theme';
import { Button } from '../../src/components';
import { useAuthStore } from '../../src/store/auth-store';
import { updateProfileApi } from '../../src/api/auth';

export default function ChooseRoleScreen() {
  const router = useRouter();
  const { user, setUser, setActiveRole } = useAuthStore();
  const [selectedMode, setSelectedMode] = useState<'DRIVER' | 'HOST'>('DRIVER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      // 1. Local-first update
      await setActiveRole(selectedMode === 'HOST' ? 'host' : 'driver');

      // 2. Background/direct profile sync
      const updated = await updateProfileApi({ preferredMode: selectedMode }).catch(() => null);
      if (updated && user) {
        setUser(updated);
      }

      // 3. Route according to selected mode
      if (selectedMode === 'HOST') {
        router.replace('/(app)/host-dashboard');
      } else {
        router.replace('/(app)/find');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.badge}>⚡ Welcome to ChargeShare</Text>
          <Text style={styles.title}>How will you use ChargeShare?</Text>
          <Text style={styles.subtitle}>
            Select your primary experience. You can switch between Driver and Host mode anytime in Profile.
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* DRIVER CARD */}
          <TouchableOpacity
            style={[
              styles.card,
              selectedMode === 'DRIVER' && styles.cardSelected,
            ]}
            onPress={() => setSelectedMode('DRIVER')}
            accessibilityRole="button"
            accessibilityLabel="Select Find a charger"
            accessibilityState={{ selected: selectedMode === 'DRIVER' }}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, selectedMode === 'DRIVER' && styles.iconBoxSelected]}>
                <Text style={styles.icon}>⚡</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>DRIVER</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>Find a charger</Text>
            <Text style={styles.cardDescription}>
              Explore verified residential EV chargers near you, reserve a charging slot, and pay the host directly.
            </Text>
            <View style={styles.radioContainer}>
              <View style={[styles.radioOuter, selectedMode === 'DRIVER' && styles.radioOuterSelected]}>
                {selectedMode === 'DRIVER' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>
                {selectedMode === 'DRIVER' ? 'Selected' : 'Tap to select'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* HOST CARD */}
          <TouchableOpacity
            style={[
              styles.card,
              selectedMode === 'HOST' && styles.cardSelected,
            ]}
            onPress={() => setSelectedMode('HOST')}
            accessibilityRole="button"
            accessibilityLabel="Select Host my charger"
            accessibilityState={{ selected: selectedMode === 'HOST' }}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, selectedMode === 'HOST' && styles.iconBoxSelected]}>
                <Text style={styles.icon}>🔌</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>HOST</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>Host my charger</Text>
            <Text style={styles.cardDescription}>
              Share your home EV charger with other drivers, manage incoming requests, and earn side income safely.
            </Text>
            <View style={styles.radioContainer}>
              <View style={[styles.radioOuter, selectedMode === 'HOST' && styles.radioOuterSelected]}>
                {selectedMode === 'HOST' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>
                {selectedMode === 'HOST' ? 'Selected' : 'Tap to select'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.helperText}>
            💡 You can change your choice anytime from the Profile tab.
          </Text>
          <Button
            title={selectedMode === 'HOST' ? 'Continue as Host' : 'Continue as Driver'}
            onPress={handleConfirm}
            loading={isSubmitting}
            size="lg"
            style={styles.continueButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: spacing.xl,
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.emeraldDark,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    lineHeight: 32,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedText,
    lineHeight: 20,
  },
  cardsContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: colors.emeraldDark,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  iconBoxSelected: {
    backgroundColor: colors.white,
    borderColor: colors.emeraldDark,
  },
  icon: {
    fontSize: 24,
  },
  tag: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.emeraldDark,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.emeraldDark,
  },
  radioLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedText,
  },
  footer: {
    marginTop: 'auto',
  },
  helperText: {
    fontSize: 12,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  continueButton: {
    width: '100%',
  },
});