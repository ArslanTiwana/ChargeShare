import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '../../src/theme';
import { Button, TextField, Toast } from '../../src/components';
import { registerApi } from '../../src/api/auth';
import { useAuthStore } from '../../src/store/auth-store';
import { ApiError } from '../../src/api/types';

export default function SignUpScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preferredMode, setPreferredMode] = useState<'DRIVER' | 'HOST'>('DRIVER');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Password rules validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  const handleContinueToStep2 = () => {
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!isPasswordValid) {
      setErrorMessage('Please ensure your password meets all requirements.');
      return;
    }

    setErrorMessage('');
    setStep(2);
  };

  const handleSignUp = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const data = await registerApi(
        name.trim(),
        email.trim().toLowerCase(),
        password,
        preferredMode
      );
      setAuth(data);

      if (preferredMode === 'HOST') {
        router.replace('/(app)/host-dashboard');
      } else {
        router.replace('/(app)/find');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Registration failed.');
      } else {
        setErrorMessage('Unable to register. Please check your network connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                if (step === 2) {
                  setStep(1);
                } else {
                  router.back();
                }
              }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>Step {step} of 2</Text>
            </View>

            {step === 1 ? (
              <>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                  Join ChargeShare to start charging or sharing your EV charger.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>How will you use ChargeShare?</Text>
                <Text style={styles.subtitle}>
                  Choose your starting mode. You can switch modes anytime in Profile.
                </Text>
              </>
            )}
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <Toast message={errorMessage} type="error" style={styles.toast} />
          ) : null}

          {step === 1 ? (
            /* STEP 1: Account Details */
            <View style={styles.form}>
              <TextField
                label="Full Name"
                placeholder="Ali Khan"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />

              <TextField
                label="Email Address"
                placeholder="ali@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              <TextField
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                isPassword
                returnKeyType="done"
              />

              {/* Visible Password Rules Checklist */}
              <View style={styles.rulesCard}>
                <Text style={styles.rulesTitle}>Password must contain:</Text>
                <View style={styles.ruleItem}>
                  <Text style={[styles.ruleBullet, hasMinLength && styles.ruleActive]}>
                    {hasMinLength ? '✓' : '○'}
                  </Text>
                  <Text style={[styles.ruleText, hasMinLength && styles.ruleActive]}>
                    At least 8 characters
                  </Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={[styles.ruleBullet, hasUppercase && styles.ruleActive]}>
                    {hasUppercase ? '✓' : '○'}
                  </Text>
                  <Text style={[styles.ruleText, hasUppercase && styles.ruleActive]}>
                    At least one uppercase letter (A-Z)
                  </Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={[styles.ruleBullet, hasLowercase && styles.ruleActive]}>
                    {hasLowercase ? '✓' : '○'}
                  </Text>
                  <Text style={[styles.ruleText, hasLowercase && styles.ruleActive]}>
                    At least one lowercase letter (a-z)
                  </Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={[styles.ruleBullet, hasNumber && styles.ruleActive]}>
                    {hasNumber ? '✓' : '○'}
                  </Text>
                  <Text style={[styles.ruleText, hasNumber && styles.ruleActive]}>
                    At least one number (0-9)
                  </Text>
                </View>
              </View>

              <Button
                title="Continue"
                onPress={handleContinueToStep2}
                style={styles.primaryButton}
              />
            </View>
          ) : (
            /* STEP 2: Role / Mode Selection */
            <View style={styles.form}>
              <View style={styles.cardsContainer}>
                {/* FIND A CHARGER (DRIVER) */}
                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    preferredMode === 'DRIVER' && styles.modeCardSelected,
                  ]}
                  onPress={() => setPreferredMode('DRIVER')}
                  accessibilityRole="button"
                  accessibilityLabel="Find a charger"
                  accessibilityState={{ selected: preferredMode === 'DRIVER' }}
                  activeOpacity={0.8}
                >
                  <View style={styles.modeCardHeader}>
                    <View
                      style={[
                        styles.modeIconBox,
                        preferredMode === 'DRIVER' && styles.modeIconBoxSelected,
                      ]}
                    >
                      <Text style={styles.modeIcon}>⚡</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>DRIVER</Text>
                    </View>
                  </View>
                  <Text style={styles.modeTitle}>Find a charger</Text>
                  <Text style={styles.modeDescription}>
                    Locate verified residential chargers nearby, reserve charging slots, and pay hosts directly.
                  </Text>
                  <View style={styles.radioRow}>
                    <View
                      style={[
                        styles.radioOuter,
                        preferredMode === 'DRIVER' && styles.radioOuterSelected,
                      ]}
                    >
                      {preferredMode === 'DRIVER' && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioLabel}>
                      {preferredMode === 'DRIVER' ? 'Selected' : 'Tap to select'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* HOST MY CHARGER (HOST) */}
                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    preferredMode === 'HOST' && styles.modeCardSelected,
                  ]}
                  onPress={() => setPreferredMode('HOST')}
                  accessibilityRole="button"
                  accessibilityLabel="Host my charger"
                  accessibilityState={{ selected: preferredMode === 'HOST' }}
                  activeOpacity={0.8}
                >
                  <View style={styles.modeCardHeader}>
                    <View
                      style={[
                        styles.modeIconBox,
                        preferredMode === 'HOST' && styles.modeIconBoxSelected,
                      ]}
                    >
                      <Text style={styles.modeIcon}>🔌</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>HOST</Text>
                    </View>
                  </View>
                  <Text style={styles.modeTitle}>Host my charger</Text>
                  <Text style={styles.modeDescription}>
                    Share your home EV charger with other drivers, set your schedule and rates, and earn income.
                  </Text>
                  <View style={styles.radioRow}>
                    <View
                      style={[
                        styles.radioOuter,
                        preferredMode === 'HOST' && styles.radioOuterSelected,
                      ]}
                    >
                      {preferredMode === 'HOST' && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioLabel}>
                      {preferredMode === 'HOST' ? 'Selected' : 'Tap to select'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={styles.hostNoticeText}>
                {preferredMode === 'HOST'
                  ? 'Selecting Host will continue to host onboarding to enter your phone number and submit your host application. You can still use driver mode anytime.'
                  : 'You will enter as a driver. You can apply to become a host whenever you wish.'}
              </Text>

              <Button
                title={preferredMode === 'HOST' ? 'Sign Up as Host' : 'Sign Up as Driver'}
                onPress={handleSignUp}
                loading={isLoading}
                style={styles.primaryButton}
              />
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/sign-in')}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: 14,
    color: colors.emeraldDark,
    fontWeight: '600',
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedText,
    lineHeight: 20,
  },
  toast: {
    marginBottom: spacing.md,
  },
  form: {
    flex: 1,
  },
  rulesCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  rulesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  ruleBullet: {
    fontSize: 12,
    color: colors.border,
    marginRight: spacing.sm,
    fontWeight: 'bold',
  },
  ruleText: {
    fontSize: 12,
    color: colors.mutedText,
  },
  ruleActive: {
    color: colors.emeraldDark,
    fontWeight: '600',
  },
  cardsContainer: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modeCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  modeCardSelected: {
    borderColor: colors.emeraldDark,
    backgroundColor: colors.surface,
  },
  modeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modeIconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modeIconBoxSelected: {
    backgroundColor: colors.white,
    borderColor: colors.emeraldDark,
  },
  modeIcon: {
    fontSize: 20,
  },
  tag: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.emeraldDark,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emeraldDark,
  },
  radioLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedText,
  },
  hostNoticeText: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 16,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  primaryButton: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  footerText: {
    fontSize: 14,
    color: colors.mutedText,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
});