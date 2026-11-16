'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Wallet,
  ImageIcon,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { adminFetch } from '../_lib/api-client';
import { formatPaisa, formatKarachiDate } from '../_lib/formatters';
import { StatusBadge } from '../_components/status-badge';
import { PageHeader } from '../_components/page-header';
import { ConfirmDialog } from '../_components/confirm-dialog';
import { ImageZoomModal } from '../_components/image-zoom-modal';
import { useToast } from '../_components/toast';

interface TopupItem {
  id: string;
  amountPaisa: number;
  amountRupees: string;
  screenshotKey: string;
  screenshotUrl: string | null;
  reference: string | null;
  status: string;
  createdAt: string;
  host: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    currentBalancePaisa: number;
  };
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  reviewedAt?: string | null;
}

interface TopupsResponse {
  topups: TopupItem[];
  nextCursor: string | null;
}

export default function AdminTopupsPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Modals & Drawers
  const [selectedTopup, setSelectedTopup] = useState<TopupItem | null>(null);
  const [approveTopup, setApproveTopup] = useState<TopupItem | null>(null);
  const [rejectTopup, setRejectTopup] = useState<TopupItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  // Query
  const { data, isLoading, error, refetch, isFetching } = useQuery<TopupsResponse>({
    queryKey: ['admin-topups', statusFilter, cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '15');
      return adminFetch<TopupsResponse>(`topups?${params.toString()}`);
    },
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: (topupId: string) =>
      adminFetch(`/api/v1/admin/topups/${topupId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      success('Top-up Approved', 'Funds have been credited to the host wallet ledger.');
      queryClient.invalidateQueries({ queryKey: ['admin-topups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setApproveTopup(null);
    },
    onError: (err: any) => {
      toastError('Approval Failed', err.message);
    },
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: ({ topupId, reason }: { topupId: string; reason: string }) =>
      adminFetch(`/api/v1/admin/topups/${topupId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      success('Top-up Rejected', 'The deposit request has been marked as rejected.');
      queryClient.invalidateQueries({ queryKey: ['admin-topups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setRejectTopup(null);
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
        title="Host Wallet Top-ups"
        description="Verify interbank fund transfers (IBFT / Raast / EasyPaisa / JazzCash) deposited by hosts and credit their platform balance."
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setCursor(undefined);
              setCursorHistory([]);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === st
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st === 'ALL' ? 'All Top-ups' : st}
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
            <p className="text-sm">Failed to load topups: {(error as any)?.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : data?.topups?.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CreditCard className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No top-ups found</p>
            <p className="text-xs text-slate-400 mt-1">
              {statusFilter !== 'ALL'
                ? `No top-up records with status ${statusFilter}`
                : 'No wallet top-ups recorded.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Host</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Receipt</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.topups.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{t.host.name}</div>
                      <div className="text-slate-400 text-[11px] font-mono">{t.host.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900 text-sm">
                        {formatPaisa(t.amountPaisa)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Host Balance: {formatPaisa(t.host.currentBalancePaisa)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {t.reference || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {t.screenshotUrl ? (
                        <button
                          onClick={() =>
                            setZoomedImage({
                              url: t.screenshotUrl!,
                              title: `Payment Receipt: ${t.reference || t.id}`,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-700" />
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">No screenshot</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {formatKarachiDate(t.createdAt, false)}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => setSelectedTopup(t)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                        title="Inspect details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>

                      {t.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => setApproveTopup(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
                            title="Approve and credit wallet"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => {
                              setRejectTopup(t);
                              setRejectReason('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors"
                            title="Reject deposit"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
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
            Showing {data?.topups?.length || 0} top-up{data?.topups?.length !== 1 ? 's' : ''}
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

      {/* Detail Drawer */}
      {selectedTopup && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Deposit Verification</h3>
                <p className="text-xs text-slate-500 font-mono">ID: {selectedTopup.id}</p>
              </div>
              <button
                onClick={() => setSelectedTopup(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Amount & Status Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Deposit Status</span>
                  <StatusBadge status={selectedTopup.status} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Deposit Amount</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    {formatPaisa(selectedTopup.amountPaisa)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Transaction Reference</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {selectedTopup.reference || 'None'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Submitted At</span>
                  <span className="text-slate-800">
                    {formatKarachiDate(selectedTopup.createdAt)}
                  </span>
                </div>
              </div>

              {/* Host Summary */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-700" />
                  <span>Host Wallet Context</span>
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Host Name</span>
                    <span className="font-semibold text-slate-900">{selectedTopup.host.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Host Email</span>
                    <span className="font-mono text-slate-800">{selectedTopup.host.email}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-slate-700 font-semibold">Current Ledger Balance</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {formatPaisa(selectedTopup.host.currentBalancePaisa)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Receipt Image */}
              {selectedTopup.screenshotUrl && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-700" />
                    <span>Bank Transfer Screenshot</span>
                  </h4>
                  <div
                    onClick={() =>
                      setZoomedImage({
                        url: selectedTopup.screenshotUrl!,
                        title: `Payment Receipt: ${selectedTopup.reference || selectedTopup.id}`,
                      })
                    }
                    className="cursor-zoom-in relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedTopup.screenshotUrl}
                      alt="Deposit receipt"
                      className="w-full h-48 object-cover group-hover:opacity-90 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 text-white font-semibold text-xs transition-opacity">
                      Click to zoom receipt
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedTopup.status === 'PENDING' && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
                <button
                  onClick={() => {
                    const t = selectedTopup;
                    setSelectedTopup(null);
                    setApproveTopup(t);
                  }}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors"
                >
                  Approve Deposit
                </button>
                <button
                  onClick={() => {
                    const t = selectedTopup;
                    setSelectedTopup(null);
                    setRejectTopup(t);
                    setRejectReason('');
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition-colors"
                >
                  Reject Deposit
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Approve Topup */}
      {approveTopup && (
        <ConfirmDialog
          isOpen={true}
          title="Approve Wallet Deposit?"
          description={`You are about to verify the bank receipt for ${approveTopup.host.name}.`}
          effectMessage={`The host's append-only wallet ledger will immediately be credited with +${formatPaisa(
            approveTopup.amountPaisa
          )} (Reference: ${approveTopup.reference || 'None'}). This operation is idempotent and immutable.`}
          variant="primary"
          confirmLabel={`Approve ${formatPaisa(approveTopup.amountPaisa)}`}
          isLoading={approveMutation.isPending}
          onConfirm={() => approveMutation.mutate(approveTopup.id)}
          onCancel={() => setApproveTopup(null)}
        />
      )}

      {/* Reject Topup Modal */}
      {rejectTopup && (
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
                <h3 className="text-lg font-bold text-slate-900">Reject Wallet Deposit</h3>
                <p className="mt-1 text-sm text-slate-600">
                  State the reason for rejecting deposit of {formatPaisa(rejectTopup.amountPaisa)}.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="topup-reject-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                Rejection Reason (Required, min 3 chars)
              </label>
              <textarea
                id="topup-reject-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Transaction reference not found in bank statement, or receipt details mismatch."
                className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
              <span className="font-semibold block mb-0.5">⚠️ Exact Effect:</span>
              The top-up request will be marked REJECTED. No ledger transaction will be created, and
              the host will be informed.
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectTopup(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={rejectReason.trim().length < 3 || rejectMutation.isPending}
                onClick={() =>
                  rejectMutation.mutate({
                    topupId: rejectTopup.id,
                    reason: rejectReason.trim(),
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Reject Deposit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Zoom */}
      {zoomedImage && (
        <ImageZoomModal
          isOpen={true}
          imageUrl={zoomedImage.url}
          title={zoomedImage.title}
          onClose={() => setZoomedImage(null)}
        />
      )}
    </div>
  );
}
