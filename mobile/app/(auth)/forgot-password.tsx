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
import { forgotPasswordApi } from '../../src/api/auth';
import { ApiError } from '../../src/api/types';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      await forgotPasswordApi(email.trim().toLowerCase());
      setIsSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Unable to process password reset request.');
      } else {
        setErrorMessage('Unable to connect to server. Please check your network.');
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
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.backText}>← Back to Sign In</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you instructions to reset your password.
            </Text>
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <Toast message={errorMessage} type="error" style={styles.toast} />
          ) : null}

          {isSubmitted ? (
            <View style={styles.successCard}>
              <View style={styles.successIconBadge}>
                <Text style={styles.successIcon}>✓</Text>
              </View>
              <Text style={styles.successTitle}>Check your inbox</Text>
              <Text style={styles.successText}>
                If an account with {email} exists, we have sent a secure link to reset your password. Please check your email and spam folder.
              </Text>
              <Button
                title="Return to Sign In"
                onPress={() => router.replace('/(auth)/sign-in')}
                style={styles.returnButton}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <TextField
                label="Email Address"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              <Button
                title="Send Reset Instructions"
                onPress={handleSubmit}
                loading={isLoading}
                style={styles.primaryButton}
              />
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/sign-in')}
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
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 14,
    color: colors.mutedText,
    fontWeight: '600',
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
  primaryButton: {
    marginTop: spacing.md,
  },
  successCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  successIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.emeraldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successIcon: {
    fontSize: 22,
    color: colors.emeraldDark,
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  successText: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  returnButton: {
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
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
