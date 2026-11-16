import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii } from '../../src/theme';
import { Button, TextField, Toast, Card } from '../../src/components';
import { useAuthStore } from '../../src/store/auth-store';
import { apiFetch } from '../../src/api/client';
import { ApiError } from '../../src/api/types';

const APP_VERSION = '1.0.0';
const WEB_BASE = 'https://chargeshare.pk';

export default function HelpScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!subject.trim()) {
      setErrorMsg('Please enter a subject');
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setErrorMsg('Message must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await apiFetch('/support', {
        method: 'POST',
        body: JSON.stringify({
          name: user?.name,
          email: user?.email || 'driver@chargeshare.pk',
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      setSuccessMsg('Your message has been sent. Our support team will reply via email.');
      setSubject('');
      setMessage('');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message || 'Failed to submit support message');
      } else {
        setErrorMsg('Network error. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openUrl = (path: string) => {
    Linking.openURL(`${WEB_BASE}${path}`).catch(() => {
      setErrorMsg(`Could not open browser for ${path}`);
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle}>Help & Support</Text>
      <Text style={styles.headerSubtitle}>
        ChargeShare Pakistan • App Version {APP_VERSION}
      </Text>

      {successMsg ? <Toast message={successMsg} type="success" /> : null}
      {errorMsg ? <Toast message={errorMsg} type="error" /> : null}

      {/* Support Message Form */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Contact Support</Text>
        <Text style={styles.cardDescription}>
          Have an issue with a booking, payment, or charger? Send our operations desk a direct message.
        </Text>

        <TextField
          label="Subject"
          value={subject}
          onChangeText={setSubject}
          placeholder="e.g., Question about my charging session"
        />

        <TextField
          label="Message"
          value={message}
          onChangeText={setMessage}
          placeholder="Please describe your inquiry in detail..."
          multiline
          numberOfLines={4}
        />

        <Button
          title={isSubmitting ? 'Sending...' : 'Submit Message'}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          style={styles.submitBtn}
        />
      </Card>

      {/* Legal & Policies */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Legal & Safety Policies</Text>
        <Text style={styles.cardDescription}>
          Review our terms of service, electrical safety guidelines, and data policies.
        </Text>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => openUrl('/terms')}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>Terms of Service & Electrical Safety</Text>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => openUrl('/privacy')}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>Privacy Policy & Data Handling</Text>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => openUrl('/delete-account')}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>Web Account Deletion Portal</Text>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </Card>

      {/* Direct Contact */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Emergency & Direct Inquiries</Text>
        <Text style={styles.cardDescription}>
          For electrical hazards or immediate safety issues, disconnect equipment safely and email us:
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('mailto:support@chargeshare.pk')}>
          <Text style={styles.emailLink}>support@chargeshare.pk</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    flexGrow: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.emeraldDark,
  },
  arrowText: {
    fontSize: 18,
    color: colors.mutedText,
  },
  emailLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emerald,
    marginTop: 4,
  },
});
