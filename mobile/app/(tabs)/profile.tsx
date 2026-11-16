import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii } from '../../src/theme';
import { Button, TextField, StatusBadge, Toast, Card, RoleSwitcher } from '../../src/components';
import { useAuthStore } from '../../src/store/auth-store';
import { updateProfileApi, resendVerificationApi, applyHostApi } from '../../src/api/auth';
import { apiFetch } from '../../src/api/client';
import { ApiError } from '../../src/api/types';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser, signOut, activeRole, setActiveRole } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Email verification banner state
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');

  // Host application state
  const [isApplyingHost, setIsApplyingHost] = useState(false);
  const [hostApplyError, setHostApplyError] = useState('');

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (!user) {
    return null;
  }

  const avatarInitial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
  const isEmailVerified = Boolean(user.emailVerifiedAt);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const updated = await updateProfileApi({
        name: name.trim(),
        phone: phone.trim() ? phone.trim() : undefined,
      });
      setUser(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message || 'Failed to update profile.');
      } else {
        setSaveError('Failed to save profile. Please check your network.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendError('');
    setResendMessage('');

    try {
      const res = await resendVerificationApi(user.email);
      setResendMessage(res.message || 'Verification link sent! Check your inbox.');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setResendError('Too many attempts. Please wait 15 minutes before retrying.');
        } else {
          setResendError(err.message || 'Failed to resend verification email.');
        }
      } else {
        setResendError('Could not send verification email. Please check connection.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleBecomeHost = async () => {
    if (!phone.trim()) {
      setHostApplyError('Please enter and save your phone number before applying to host.');
      return;
    }

    setIsApplyingHost(true);
    setHostApplyError('');

    try {
      const res = await applyHostApi();
      setUser({ ...user, hostStatus: res.hostStatus });
      Alert.alert(
        'Application Submitted',
        'Your host application is under review by the ChargeShare team. We will notify you once approved.'
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setHostApplyError(err.message || 'Could not submit host application.');
      } else {
        setHostApplyError('Application failed. Please check your network.');
      }
    } finally {
      setIsApplyingHost(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of ChargeShare?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError('');

    try {
      await apiFetch('/me/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword ? deletePassword : undefined }),
      });
      setShowDeleteModal(false);
      Alert.alert(
        'Account Deleted',
        'Your account and personal data have been permanently anonymized.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await signOut();
              router.replace('/(auth)/sign-in');
            },
          },
        ]
      );
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDeleteError(err.message || 'Failed to delete account.');
      } else {
        setDeleteError('An error occurred. Please check network connectivity.');
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const getHostStatusDescription = () => {
    switch (user.hostStatus) {
      case 'PENDING':
        return 'Host application is currently under review by our team.';
      case 'APPROVED':
        return 'You are an approved host. You can list chargers and earn.';
      case 'SUSPENDED':
        return 'Host privileges are suspended. Please contact customer support.';
      case 'NONE':
      default:
        return 'You are registered as a driver. Become a host to list your EV charger.';
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={{ marginBottom: spacing.md, alignItems: 'center' }}>
        <RoleSwitcher />
      </View>
      {/* Email Verification Banner */}
      {!isEmailVerified && !isBannerDismissed ? (
        <View style={styles.verificationBanner}>
          <View style={styles.bannerHeader}>
            <Text style={styles.bannerTitle}>✉️ Verify your email address</Text>
            <TouchableOpacity
              onPress={() => setIsBannerDismissed(true)}
              style={styles.dismissButton}
              accessibilityRole="button"
              accessibilityLabel="Dismiss banner"
            >
              <Text style={styles.dismissText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.bannerText}>
            We sent a verification link to {user.email}. Verify your email to secure your account.
          </Text>
          {resendMessage ? (
            <Text style={styles.bannerSuccess}>{resendMessage}</Text>
          ) : null}
          {resendError ? (
            <Text style={styles.bannerError}>{resendError}</Text>
          ) : null}
          <Button
            title={isResending ? 'Sending...' : 'Resend Verification Link'}
            onPress={handleResendVerification}
            loading={isResending}
            size="sm"
            variant="outline"
            style={styles.resendButton}
          />
        </View>
      ) : null}

      {/* User Header Card */}
      <Card style={styles.userCard}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={styles.badgeRow}>
              <StatusBadge status={user.hostStatus} />
              <View
                style={[
                  styles.verifiedChip,
                  isEmailVerified ? styles.verifiedActive : styles.verifiedInactive,
                ]}
              >
                <Text
                  style={[
                    styles.verifiedChipText,
                    isEmailVerified
                      ? styles.verifiedActiveText
                      : styles.verifiedInactiveText,
                  ]}
                >
                  {isEmailVerified ? 'Email Verified' : 'Email Unverified'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Card>

      {/* Profile Form */}
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>Personal Details</Text>

        {saveSuccess ? (
          <Toast message="Profile updated successfully!" type="success" />
        ) : null}
        {saveError ? <Toast message={saveError} type="error" /> : null}

        <TextField
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          returnKeyType="next"
        />

        <TextField
          label="Contact Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="03001234567"
          keyboardType="phone-pad"
          helperText="Phone number is unverified and will only be shared with the other party after a booking is accepted."
        />

        <Button
          title="Save Changes"
          onPress={handleSaveProfile}
          loading={isSaving}
          size="sm"
          style={styles.saveButton}
        />
      </Card>

      {/* Active Mode & Role Switcher */}
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>App Experience Mode</Text>
        <Text style={styles.hostDescription}>
          Current Mode: <Text style={{ fontWeight: '700', color: colors.ink }}>{activeRole === 'host' ? 'Host Mode (Managing Chargers)' : 'Driver Mode (Finding Chargers)'}</Text>
        </Text>
        <Button
          title={activeRole === 'host' ? 'Switch to Driver mode' : 'Switch to Host mode'}
          variant="outline"
          onPress={() => setActiveRole(activeRole === 'host' ? 'driver' : 'host')}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      {/* Host Status / Become a Host Card */}
      <Card style={styles.hostCard}>
        <View style={styles.hostCardHeader}>
          <Text style={styles.sectionTitle}>Host Account</Text>
          <StatusBadge status={user.hostStatus} />
        </View>
        <Text style={styles.hostDescription}>
          {getHostStatusDescription()}
        </Text>

        {hostApplyError ? (
          <Toast message={hostApplyError} type="error" />
        ) : null}

        {user.hostStatus === 'NONE' ? (
          <Button
            title="Become a Host"
            onPress={handleBecomeHost}
            loading={isApplyingHost}
            variant="primary"
            size="sm"
            style={styles.hostButton}
          />
        ) : null}
      </Card>

      {/* Help & Support */}
      <Card style={styles.helpCard}>
        <TouchableOpacity
          style={styles.helpRow}
          onPress={() => router.push('/help')}
          accessibilityRole="button"
        >
          <View style={styles.helpTextContainer}>
            <Text style={styles.helpTitle}>Help & Support Desk</Text>
            <Text style={styles.helpSubtitle}>FAQs, Contact Support, Terms & Privacy</Text>
          </View>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </Card>

      {/* Account Actions */}
      <View style={styles.actionsContainer}>
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          variant="secondary"
          style={styles.signOutButton}
        />

        {/* Delete Account */}
        <View style={styles.deleteAccountWrapper}>
          <Button
            title="Delete Account"
            onPress={() => {
              setDeletePassword('');
              setDeleteError('');
              setShowDeleteModal(true);
            }}
            variant="danger"
            style={styles.deleteButton}
          />
          <Text style={styles.deleteHelpText}>
            Permanently anonymizes your account according to Google Play guidelines.
          </Text>
        </View>
      </View>

      {/* Account Deletion Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalWarning}>
              Warning: This action is permanent. Your personal details will be wiped and active sessions terminated.
            </Text>

            {deleteError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{deleteError}</Text>
              </View>
            ) : null}

            <TextField
              label="Account Password"
              placeholder="Enter password (if applicable)"
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
            />

            <View style={styles.modalButtonRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setShowDeleteModal(false)}
                style={styles.modalCancelBtn}
              />
              <Button
                title={isDeletingAccount ? 'Deleting...' : 'Delete'}
                variant="danger"
                onPress={handleDeleteAccount}
                loading={isDeletingAccount}
                disabled={isDeletingAccount}
                style={styles.modalDeleteBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    flexGrow: 1,
  },
  verificationBanner: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warningDark,
  },
  dismissButton: {
    padding: 4,
  },
  dismissText: {
    fontSize: 14,
    color: colors.warningDark,
    fontWeight: '700',
  },
  bannerText: {
    fontSize: 13,
    color: colors.warningDark,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  bannerSuccess: {
    fontSize: 12,
    color: colors.emeraldDark,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  bannerError: {
    fontSize: 12,
    color: colors.dangerDark,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  resendButton: {
    alignSelf: 'flex-start',
    borderColor: colors.warningDark,
    minHeight: 38,
  },
  userCard: {
    marginBottom: spacing.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.emeraldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  verifiedChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  verifiedActive: {
    backgroundColor: colors.emeraldLight,
  },
  verifiedInactive: {
    backgroundColor: colors.surface,
  },
  verifiedChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  verifiedActiveText: {
    color: colors.emeraldDark,
  },
  verifiedInactiveText: {
    color: colors.mutedText,
  },
  formCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  saveButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: spacing.xs,
  },
  hostCard: {
    marginBottom: spacing.xl,
  },
  hostCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  hostDescription: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
    marginVertical: spacing.sm,
  },
  hostButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  actionsContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.xxxl,
  },
  signOutButton: {
    marginBottom: spacing.xl,
  },
  helpCard: {
    marginBottom: spacing.lg,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  helpTextContainer: {
    flex: 1,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  helpSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  arrowText: {
    fontSize: 18,
    color: colors.mutedText,
    marginLeft: 8,
  },
  deleteAccountWrapper: {
    alignItems: 'center',
  },
  deleteButton: {
    width: '100%',
  },
  deleteHelpText: {
    fontSize: 12,
    color: colors.subtleText,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dangerDark,
    marginBottom: spacing.xs,
  },
  modalWarning: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  modalErrorBox: {
    backgroundColor: colors.dangerLight,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  modalErrorText: {
    fontSize: 12,
    color: colors.dangerDark,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalDeleteBtn: {
    flex: 1,
  },
});
