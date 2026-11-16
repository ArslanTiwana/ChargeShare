'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Save,
  RefreshCw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { adminFetch } from '../_lib/api-client';
import { formatPaisa } from '../_lib/formatters';
import { PageHeader } from '../_components/page-header';
import { ConfirmDialog } from '../_components/confirm-dialog';
import { useToast } from '../_components/toast';

interface ConfigResponse {
  configs: Record<string, string>;
  items: Array<{ id: string; key: string; value: string }>;
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [commissionPercent, setCommissionPercent] = useState('15');
  const [bookingExpiryMinutes, setBookingExpiryMinutes] = useState('30');
  const [autoConfirmHours, setAutoConfirmHours] = useState('24');
  const [maxSessionKwh, setMaxSessionKwh] = useState('150');
  const [minTopupRupees, setMinTopupRupees] = useState('500');
  const [maxTopupRupees, setMaxTopupRupees] = useState('50000');
  const [hostMinWalletWarningRupees, setHostMinWalletWarningRupees] = useState('500');
  const [topupInstructions, setTopupInstructions] = useState('Transfer funds to Easypaisa / JazzCash account: 0300-1234567 (Title: ChargeShare Admin). Save your transaction ID and upload a screenshot.');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Fetch Config
  const { data, isLoading, error, refetch, isFetching } = useQuery<ConfigResponse>({
    queryKey: ['admin-config'],
    queryFn: () => adminFetch<ConfigResponse>('config'),
  });

  useEffect(() => {
    if (data?.configs) {
      if (data.configs.commissionPercent) setCommissionPercent(data.configs.commissionPercent);
      if (data.configs.bookingExpiryMinutes) setBookingExpiryMinutes(data.configs.bookingExpiryMinutes);
      if (data.configs.autoConfirmHours) setAutoConfirmHours(data.configs.autoConfirmHours);
      if (data.configs.maxSessionKwh) setMaxSessionKwh(data.configs.maxSessionKwh);
      if (data.configs.minTopupPaisa) {
        setMinTopupRupees((parseInt(data.configs.minTopupPaisa, 10) / 100).toString());
      }
      if (data.configs.maxTopupPaisa) {
        setMaxTopupRupees((parseInt(data.configs.maxTopupPaisa, 10) / 100).toString());
      }
      if (data.configs.hostMinWalletWarningPaisa) {
        setHostMinWalletWarningRupees((parseInt(data.configs.hostMinWalletWarningPaisa, 10) / 100).toString());
      }
      if (data.configs.topupInstructions) {
        setTopupInstructions(data.configs.topupInstructions);
      }
    }
  }, [data]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, string>) =>
      adminFetch('/api/v1/admin/config', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      success('Platform Settings Saved', 'Configuration parameters updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
      setIsConfirmOpen(false);
    },
    onError: (err: any) => {
      toastError('Update Failed', err.message);
    },
  });

  const handleSave = () => {
    const updates: Record<string, string> = {
      commissionPercent: commissionPercent.trim(),
      bookingExpiryMinutes: bookingExpiryMinutes.trim(),
      autoConfirmHours: autoConfirmHours.trim(),
      maxSessionKwh: maxSessionKwh.trim(),
      minTopupPaisa: Math.round(parseFloat(minTopupRupees) * 100).toString(),
      maxTopupPaisa: Math.round(parseFloat(maxTopupRupees) * 100).toString(),
      hostMinWalletWarningPaisa: Math.round(parseFloat(hostMinWalletWarningRupees) * 100).toString(),
      topupInstructions: topupInstructions.trim(),
    };
    updateMutation.mutate(updates);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Platform & Economic Parameters"
        description="Configure marketplace commission rates, booking expiry timeouts, energy delivery safety limits, and deposit thresholds."
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Reset to Server</span>
          </button>
        }
      />

      {/* Warning Disclaimer */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 shadow-sm">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold block text-sm mb-0.5">Application Scope:</span>
          Changes to these system parameters take effect immediately for all{' '}
          <strong>future</strong> bookings and deposits. Existing active or historical bookings retain
          their snapshotted rates and commission ledger calculations.
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 bg-white rounded-2xl border border-red-200 text-center">
          <p className="text-sm text-red-600 font-semibold">Failed to load configuration</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
          >
            Try Again
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsConfirmOpen(true);
          }}
          className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 text-xs"
        >
          {/* Commission & Monetization */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Commission & Marketplace Cut</h3>
            <p className="text-slate-500 mb-4">
              Percentage deducted from host payout upon confirmed charging sessions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-comm" className="block font-semibold text-slate-700 mb-1">
                  Commission Percentage (%)
                </label>
                <div className="relative">
                  <input
                    id="cfg-comm"
                    type="number"
                    min="0"
                    max="50"
                    required
                    value={commissionPercent}
                    onChange={(e) => setCommissionPercent(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Default: 15% (Range: 0% - 50%)</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Booking & Automation Timeouts */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Lifecycle Timeouts & Expiry</h3>
            <p className="text-slate-500 mb-4">
              Automated expiration and confirmation thresholds for booking flows.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-expiry" className="block font-semibold text-slate-700 mb-1">
                  Booking Request Expiry (Minutes)
                </label>
                <input
                  id="cfg-expiry"
                  type="number"
                  min="5"
                  max="1440"
                  required
                  value={bookingExpiryMinutes}
                  onChange={(e) => setBookingExpiryMinutes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Time allowed for a host to accept or decline before lazy expiry (Default: 30 mins).
                </p>
              </div>

              <div>
                <label htmlFor="cfg-autoconfirm" className="block font-semibold text-slate-700 mb-1">
                  Auto-Confirm Completed Sessions (Hours)
                </label>
                <input
                  id="cfg-autoconfirm"
                  type="number"
                  min="1"
                  max="168"
                  required
                  value={autoConfirmHours}
                  onChange={(e) => setAutoConfirmHours(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Window for driver confirmation before cron auto-confirms (Default: 24 hours).
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Safety & Physical Limits */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Energy Safety Caps</h3>
            <p className="text-slate-500 mb-4">
              Physical thresholds to reject erroneous or corrupt meter readings.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-max-kwh" className="block font-semibold text-slate-700 mb-1">
                  Maximum Single-Session Energy Cap (kWh)
                </label>
                <input
                  id="cfg-max-kwh"
                  type="number"
                  min="10"
                  max="500"
                  required
                  value={maxSessionKwh}
                  onChange={(e) => setMaxSessionKwh(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Readings above this will be rejected by backend (Default: 150 kWh).
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Wallet Limits */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Host Wallet Deposit Limits</h3>
            <p className="text-slate-500 mb-4">
              Minimum and maximum allowable bank transfer deposits per top-up.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-min-topup" className="block font-semibold text-slate-700 mb-1">
                  Minimum Top-up (PKR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    Rs
                  </span>
                  <input
                    id="cfg-min-topup"
                    type="number"
                    min="10"
                    required
                    value={minTopupRupees}
                    onChange={(e) => setMinTopupRupees(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Default: Rs 500 (50,000 paisa)</p>
              </div>

              <div>
                <label htmlFor="cfg-max-topup" className="block font-semibold text-slate-700 mb-1">
                  Maximum Top-up (PKR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    Rs
                  </span>
                  <input
                    id="cfg-max-topup"
                    type="number"
                    max="100000"
                    required
                    value={maxTopupRupees}
                    onChange={(e) => setMaxTopupRupees(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Default: Rs 50,000 (5,000,000 paisa)</p>
              </div>

              <div>
                <label htmlFor="cfg-host-warning" className="block font-semibold text-slate-700 mb-1">
                  Host Low Wallet Warning Threshold (PKR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    Rs
                  </span>
                  <input
                    id="cfg-host-warning"
                    type="number"
                    min="0"
                    required
                    value={hostMinWalletWarningRupees}
                    onChange={(e) => setHostMinWalletWarningRupees(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Warns hosts on dashboard if balance falls below this (Default: Rs 500).
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="cfg-topup-instructions" className="block font-semibold text-slate-700 mb-1">
                Host Top-up Instructions (Easypaisa / JazzCash)
              </label>
              <textarea
                id="cfg-topup-instructions"
                rows={3}
                required
                value={topupInstructions}
                onChange={(e) => setTopupInstructions(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Account title, number, and payment guidance shown directly to hosts in the mobile app.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Save System Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* Confirmation Dialog */}
      {isConfirmOpen && (
        <ConfirmDialog
          isOpen={true}
          title="Save Platform Configuration?"
          description="You are modifying platform economics and system timeout rules."
          effectMessage={`New parameters: Commission=${commissionPercent}%, Expiry=${bookingExpiryMinutes}m, AutoConfirm=${autoConfirmHours}h, MaxSession=${maxSessionKwh}kWh, MinTopup=Rs ${minTopupRupees}, MaxTopup=Rs ${maxTopupRupees}. This mutation is audited in the AdminAuditLog.`}
          variant="warning"
          confirmLabel="Save & Apply"
          isLoading={updateMutation.isPending}
          onConfirm={handleSave}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </div>
  );
}
