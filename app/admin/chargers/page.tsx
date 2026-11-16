'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  ExternalLink,
  MapPin,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { adminFetch } from '../_lib/api-client';
import { formatPaisa, formatKarachiDate } from '../_lib/formatters';
import { StatusBadge } from '../_components/status-badge';
import { PageHeader } from '../_components/page-header';
import { ConfirmDialog } from '../_components/confirm-dialog';
import { useToast } from '../_components/toast';

interface ChargerItem {
  id: string;
  title: string;
  powerKw: number;
  connectorType: string;
  pricePerKwhPaisa: number;
  areaLabel: string;
  addressLine: string;
  notes: string | null;
  meterInstalled: boolean;
  isOnline: boolean;
  approvalStatus: string;
  createdAt: string;
  host: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

interface ChargersResponse {
  items?: ChargerItem[];
  chargers?: ChargerItem[];
  nextCursor: string | null;
}

export default function AdminChargersPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [approvalFilter, setApprovalFilter] = useState<string>('ALL');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Drawer & Dialog State
  const [selectedCharger, setSelectedCharger] = useState<ChargerItem | null>(null);
  const [approveCharger, setApproveCharger] = useState<ChargerItem | null>(null);
  const [rejectCharger, setRejectCharger] = useState<ChargerItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch Chargers
  const { data, isLoading, error, refetch, isFetching } = useQuery<ChargersResponse>({
    queryKey: ['admin-chargers', approvalFilter, cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      if (approvalFilter !== 'ALL') params.set('approvalStatus', approvalFilter);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '15');
      return adminFetch<ChargersResponse>(`chargers?${params.toString()}`);
    },
  });

  const chargerList = data?.items ?? data?.chargers ?? [];

  // Approve Charger Mutation
  const approveMutation = useMutation({
    mutationFn: (chargerId: string) =>
      adminFetch(`/api/v1/admin/chargers/${chargerId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      success('Charger Approved', 'Charger listing is approved and ready to accept bookings.');
      queryClient.invalidateQueries({ queryKey: ['admin-chargers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setApproveCharger(null);
    },
    onError: (err: any) => {
      toastError('Approval Failed', err.message);
    },
  });

  // Reject Charger Mutation
  const rejectMutation = useMutation({
    mutationFn: ({ chargerId, reason }: { chargerId: string; reason: string }) =>
      adminFetch(`/api/v1/admin/chargers/${chargerId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      success('Charger Rejected', 'Charger listing has been rejected with feedback sent to host.');
      queryClient.invalidateQueries({ queryKey: ['admin-chargers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setRejectCharger(null);
      setRejectReason('');
    },
    onError: (err: any) => {
      toastError('Rejection Failed', err.message);
    },
  });

  const handleNextPage = () => {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor || '']);
      setCursor(data.nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const prevCursor = cursorHistory[cursorHistory.length - 1];
      setCursorHistory((prev) => prev.slice(0, -1));
      setCursor(prevCursor || undefined);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="EV Charger Verification & Fleet"
        description="Review residential chargers submitted by homeowners, check electrical specifications, and inspect installation safety."
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
          <button
            key={st}
            onClick={() => {
              setApprovalFilter(st);
              setCursor(undefined);
              setCursorHistory([]);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              approvalFilter === st
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st === 'ALL' ? 'All Chargers' : st}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-sm">Failed to load chargers: {(error as any)?.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : chargerList.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Zap className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No chargers found</p>
            <p className="text-xs text-slate-400 mt-1">
              {approvalFilter !== 'ALL'
                ? `No chargers in status ${approvalFilter}`
                : 'No chargers registered on platform.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Charger</th>
                  <th className="py-3 px-4">Host</th>
                  <th className="py-3 px-4">Connector & Power</th>
                  <th className="py-3 px-4">Rate (PKR)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Online</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chargerList.map((charger) => (
                  <tr key={charger.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{charger.title}</div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{charger.areaLabel}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{charger.host.name}</div>
                      <div className="text-slate-400 text-[11px] font-mono">{charger.host.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-semibold text-slate-800">{charger.connectorType}</span> &bull;{' '}
                      <span className="text-emerald-700 font-bold">{charger.powerKw} kW</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                      {formatPaisa(charger.pricePerKwhPaisa)}/kWh
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={charger.approvalStatus} />
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          charger.isOnline
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {charger.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => setSelectedCharger(charger)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                        title="Inspect full details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>

                      {charger.approvalStatus !== 'APPROVED' && (
                        <button
                          onClick={() => setApproveCharger(charger)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
                          title="Approve Charger"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      )}

                      {charger.approvalStatus !== 'REJECTED' && (
                        <button
                          onClick={() => {
                            setRejectCharger(charger);
                            setRejectReason('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors"
                          title="Reject Charger"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cursor Pagination */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
          <div className="text-slate-500">
            Showing {chargerList.length} charger{chargerList.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={cursorHistory.length === 0}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={!data?.nextCursor}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Charger Details Drawer */}
      {selectedCharger && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedCharger.title}</h3>
                <p className="text-xs text-slate-500 font-mono">ID: {selectedCharger.id}</p>
              </div>
              <button
                onClick={() => setSelectedCharger(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Technical Specifications */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Approval Status</span>
                  <StatusBadge status={selectedCharger.approvalStatus} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Connector Standard</span>
                  <span className="font-bold text-slate-900">{selectedCharger.connectorType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Max Charging Power</span>
                  <span className="font-bold text-emerald-700 font-mono">
                    {selectedCharger.powerKw} kW
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Price Rate</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {formatPaisa(selectedCharger.pricePerKwhPaisa)} / kWh
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Dedicated Sub-meter</span>
                  <span
                    className={`font-semibold ${
                      selectedCharger.meterInstalled ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {selectedCharger.meterInstalled ? 'Installed & Certified' : 'Not Installed'}
                  </span>
                </div>
              </div>

              {/* Private Address & Location */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <span>Physical Address & Pin Location</span>
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <div className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                      Public Area Label
                    </div>
                    <div className="font-medium text-slate-900 mt-0.5">{selectedCharger.areaLabel}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                      Confidential House Address (Admin View)
                    </div>
                    <div className="font-mono text-slate-900 mt-0.5 p-2 bg-white rounded border border-slate-200">
                      {selectedCharger.addressLine}
                    </div>
                  </div>
                  {selectedCharger.notes && (
                    <div>
                      <div className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                        Host Parking & Access Notes
                      </div>
                      <div className="text-slate-700 mt-0.5 italic">{selectedCharger.notes}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Host Contact Information */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Host Account</h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Host Name</span>
                    <span className="font-semibold text-slate-900">{selectedCharger.host.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email</span>
                    <span className="font-mono text-slate-800">{selectedCharger.host.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone</span>
                    <span className="font-mono text-slate-800">
                      {selectedCharger.host.phone || 'Not set'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              {selectedCharger.approvalStatus !== 'APPROVED' && (
                <button
                  onClick={() => {
                    const c = selectedCharger;
                    setSelectedCharger(null);
                    setApproveCharger(c);
                  }}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors"
                >
                  Approve Charger
                </button>
              )}
              {selectedCharger.approvalStatus !== 'REJECTED' && (
                <button
                  onClick={() => {
                    const c = selectedCharger;
                    setSelectedCharger(null);
                    setRejectCharger(c);
                    setRejectReason('');
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition-colors"
                >
                  Reject Charger
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Approve Charger */}
      {approveCharger && (
        <ConfirmDialog
          isOpen={true}
          title="Approve Charger Listing?"
          description={`You are about to approve "${approveCharger.title}" by ${approveCharger.host.name}.`}
          effectMessage="The charger approvalStatus will become APPROVED. The charger will be indexed on the driver discovery map and made available for public booking slots."
          variant="primary"
          confirmLabel="Approve Charger"
          isLoading={approveMutation.isPending}
          onConfirm={() => approveMutation.mutate(approveCharger.id)}
          onCancel={() => setApproveCharger(null)}
        />
      )}

      {/* Reject Charger Modal with Mandatory Reason */}
      {rejectCharger && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-red-100 text-red-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Reject Charger Listing</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Provide specific reasons for rejecting &ldquo;{rejectCharger.title}&rdquo;.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="reason" className="block text-xs font-semibold text-slate-700 mb-1">
                Rejection Reason (Required, min 3 chars)
              </label>
              <textarea
                id="reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Photos indicate non-compliant outdoor wiring, or meter reading is unverified."
                className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
              <span className="font-semibold block mb-0.5">⚠️ Exact Effect:</span>
              The charger will be marked as REJECTED and taken offline. The host will be notified of
              this feedback.
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectCharger(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={rejectReason.trim().length < 3 || rejectMutation.isPending}
                onClick={() =>
                  rejectMutation.mutate({
                    chargerId: rejectCharger.id,
                    reason: rejectReason.trim(),
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Reject Listing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
