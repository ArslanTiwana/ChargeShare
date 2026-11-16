import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { getWallet, getTopups, WalletTransactionItem, WalletTopupItem } from '../../src/api/wallet';
import { getPublicConfig } from '../../src/api/config';
import {
  HostStatusGate,
  MoneyText,
  Button,
  StatusBadge,
  EmptyState,
  ErrorState,
  Skeleton,
  formatPaisaToRupees,
} from '../../src/components';
import { colors, radii, spacing } from '../../src/theme';

const TIMEZONE = 'Asia/Karachi';

export default function HostWalletScreen() {
  const router = useRouter();

  const { data: config } = useQuery({
    queryKey: ['public-config'],
    queryFn: getPublicConfig,
  });

  const {
    data: wallet,
    isLoading: isLoadingWallet,
    isRefetching: isRefetchingWallet,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: ['host-wallet-full'],
    queryFn: () => getWallet(undefined, 50),
  });

  const {
    data: topupsData,
    isLoading: isLoadingTopups,
    isRefetching: isRefetchingTopups,
    refetch: refetchTopups,
  } = useQuery({
    queryKey: ['host-topups-list'],
    queryFn: () => getTopups(undefined, 20),
  });

  const balancePaisa = wallet?.balancePaisa ?? 0;
  const warningPaisa = config?.hostMinWalletWarningPaisa ?? 50000;
  const isZeroOrNegative = balancePaisa <= 0;
  const isLowBalance = balancePaisa > 0 && balancePaisa < warningPaisa;

  const transactions = wallet?.transactions || [];
  const topups = topupsData?.topups || [];
  const pendingTopupsCount = topups.filter((t) => t.status === 'PENDING').length;

  const handleRefresh = () => {
    refetchWallet();
    refetchTopups();
  };

  return (
    <HostStatusGate>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingWallet || isRefetchingTopups}
            onRefresh={handleRefresh}
          />
        }
      >
        {/* Zero Balance Alert */}
        {isZeroOrNegative && (
          <View style={styles.alertBoxDanger}>
            <Text style={styles.alertIcon}>🚨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitleDanger}>Booking Requests Paused</Text>
              <Text style={styles.alertTextDanger}>
                Your wallet balance is zero or negative. Top up to reactivate incoming booking requests.
              </Text>
            </View>
          </View>
        )}

        {/* Low Balance Warning */}
        {isLowBalance && (
          <View style={styles.alertBoxWarning}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitleWarning}>Low Balance Warning</Text>
              <Text style={styles.alertTextWarning}>
                Balance is below {formatPaisaToRupees(warningPaisa)}. Top up to maintain uninterrupted bookings.
              </Text>
            </View>
          </View>
        )}

        {/* Wallet Overview Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>PREPAID WALLET BALANCE</Text>
          <MoneyText
            paisa={balancePaisa}
            style={{
              fontSize: 32,
              color: isZeroOrNegative ? colors.dangerDark : colors.emeraldDark,
              marginBottom: 4,
            }}
          />
          <Text style={styles.balanceSub}>
            Platform commission is deducted here when sessions complete.
          </Text>

          <Button
            title="Top Up Wallet"
            onPress={() => router.push('/host-wallet/topup')}
            style={styles.topupBtn}
          />
        </View>

        {/* Recent Top-up Requests Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top-up Requests</Text>
          {pendingTopupsCount > 0 && (
            <Text style={styles.pendingBadge}>{pendingTopupsCount} Pending</Text>
          )}
        </View>

        {topups.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No recent top-up requests.</Text>
          </View>
        ) : (
          topups.slice(0, 5).map((t) => (
            <View key={t.id} style={styles.topupCard}>
              <View style={styles.topupTop}>
                <Text style={styles.topupAmount}>{formatPaisaToRupees(t.amountPaisa)}</Text>
                <StatusBadge status={t.status} />
              </View>
              <Text style={styles.topupDate}>
                {formatInTimeZone(new Date(t.createdAt), TIMEZONE, 'MMM d, yyyy • h:mm a')}
              </Text>
              {t.reference ? (
                <Text style={styles.topupRef}>Ref / Trx: {t.reference}</Text>
              ) : null}
              {t.status === 'REJECTED' && t.rejectionReason ? (
                <Text style={styles.rejectionText}>Reason: {t.rejectionReason}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* Transaction History Section */}
        <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
        </View>

        {isLoadingWallet ? (
          <View style={{ gap: 8 }}>
            <Skeleton width="100%" height={60} borderRadius={radii.md} />
            <Skeleton width="100%" height={60} borderRadius={radii.md} />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No wallet transactions yet.</Text>
          </View>
        ) : (
          transactions.map((tx) => {
            const isNegative = tx.amountPaisa < 0;
            return (
              <View key={tx.id} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txType}>{tx.type}</Text>
                  <Text style={styles.txDate}>
                    {formatInTimeZone(new Date(tx.createdAt), TIMEZONE, 'MMM d, yyyy • h:mm a')}
                  </Text>
                  {tx.note ? <Text style={styles.txNote}>{tx.note}</Text> : null}
                </View>

                <Text
                  style={[
                    styles.txAmount,
                    isNegative ? styles.txAmountNegative : styles.txAmountPositive,
                  ]}
                >
                  {isNegative ? '-' : '+'}
                  {formatPaisaToRupees(Math.abs(tx.amountPaisa))}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </HostStatusGate>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 50,
  },
  alertBoxDanger: {
    flexDirection: 'row',
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    gap: 10,
  },
  alertIcon: {
    fontSize: 24,
  },
  alertTitleDanger: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991b1b',
  },
  alertTextDanger: {
    fontSize: 12,
    color: '#7f1d1d',
    marginTop: 2,
    lineHeight: 16,
  },
  alertBoxWarning: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    gap: 10,
  },
  alertTitleWarning: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
  },
  alertTextWarning: {
    fontSize: 12,
    color: '#78350f',
    marginTop: 2,
    lineHeight: 16,
  },
  balanceCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.lg,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.mutedText,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  balanceSub: {
    fontSize: 12,
    color: colors.subtleText,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  topupBtn: {
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  pendingBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warningDark,
    backgroundColor: '#fffbeb',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.subtleText,
    fontStyle: 'italic',
  },
  topupCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.sm,
  },
  topupTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  topupAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  topupDate: {
    fontSize: 11,
    color: colors.mutedText,
  },
  topupRef: {
    fontSize: 12,
    color: colors.ink,
    marginTop: 4,
    fontWeight: '600',
  },
  rejectionText: {
    fontSize: 12,
    color: colors.dangerDark,
    marginTop: 4,
    fontWeight: '600',
  },
  txRow: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txType: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  txDate: {
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
  txNote: {
    fontSize: 12,
    color: colors.subtleText,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  txAmountPositive: {
    color: colors.emeraldDark,
  },
  txAmountNegative: {
    color: colors.dangerDark,
  },
});
