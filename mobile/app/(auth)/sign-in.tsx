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
import { loginApi, googleLoginApi } from '../../src/api/auth';
import { useAuthStore } from '../../src/store/auth-store';
import { isGoogleAuthAvailable, promptGoogleSignIn } from '../../src/services/google-auth';
import { ApiError } from '../../src/api/types';

export default function SignInScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const navigateAfterAuth = (user: { preferredMode: 'DRIVER' | 'HOST' | null }) => {
    if (!user.preferredMode) {
      router.replace('/(auth)/choose-role');
    } else if (user.preferredMode === 'HOST') {
      router.replace('/host-dashboard');
    } else {
      router.replace('/find');
    }
  };

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const data = await loginApi(email.trim().toLowerCase(), password);
      setAuth(data);
      navigateAfterAuth(data.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Invalid email or password.');
      } else {
        setErrorMessage('Unable to sign in. Please check your network connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage('');

    try {
      const idToken = await promptGoogleSignIn();
      if (!idToken) {
        setIsGoogleLoading(false);
        return; // User cancelled
      }

      const data = await googleLoginApi(idToken);
      setAuth(data);
      navigateAfterAuth(data.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Google sign-in failed.');
      } else {
        setErrorMessage('Google sign-in could not be completed.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const hasGoogle = isGoogleAuthAvailable();

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
            <View style={styles.badge}>
              <Text style={styles.badgeText}>⚡ ChargeShare</Text>
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to book EV chargers or manage your host account.
            </Text>
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <Toast message={errorMessage} type="error" style={styles.toast} />
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            <TextField
              label="Email Address"
              placeholder="you@example.com"
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
              onSubmitEditing={handleEmailSignIn}
            />

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotPasswordButton}
              accessibilityRole="button"
              accessibilityLabel="Forgot password?"
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={handleEmailSignIn}
              loading={isLoading}
              style={styles.primaryButton}
            />

            {/* Google Sign In (if available in Dev Build / Prebuild) */}
            {hasGoogle ? (
              <View style={styles.googleContainer}>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Button
                  title="Continue with Google"
                  onPress={handleGoogleSignIn}
                  variant="secondary"
                  loading={isGoogleLoading}
                  style={styles.googleButton}
                />
              </View>
            ) : null}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/sign-up')}
              accessibilityRole="button"
              accessibilityLabel="Sign up"
            >
              <Text style={styles.footerLink}>Sign up</Text>
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
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: spacing.xl,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    marginBottom: spacing.md,
  },
  badgeText: {
    color: colors.emeraldDark,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: colors.mutedText,
    lineHeight: 22,
  },
  toast: {
    marginBottom: spacing.md,
  },
  form: {
    flex: 1,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.emeraldDark,
  },
  primaryButton: {
    marginTop: spacing.xs,
  },
  googleContainer: {
    marginTop: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtleText,
    paddingHorizontal: spacing.md,
  },
  googleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  footerText: {
    fontSize: 14,
    color: colors.mutedText,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
});
