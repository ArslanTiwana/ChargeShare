'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  CheckCircle,
  Eye,
  RefreshCw,
  Scale,
  X,
  Loader2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { adminFetch } from '../_lib/api-client';
import { formatPaisa, formatKarachiDate, formatKwh } from '../_lib/formatters';
import { StatusBadge } from '../_components/status-badge';
import { PageHeader } from '../_components/page-header';
import { ConfirmDialog } from '../_components/confirm-dialog';
import { useToast } from '../_components/toast';

interface DisputeItem {
  id: string;
  bookingId: string;
  reason: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  openedBy: {
    id: string;
    name: string;
    email: string;
  };
  resolvedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  booking: {
    id: string;
    status: string;
    startsAt: string;
    endsAt: string;
    driver: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    };
    charger: {
      id: string;
      title: string;
      host: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
      };
    };
    session?: {
      id: string;
      kwhDelivered: number;
      rateSnapshotPaisa: number;
      totalPaisa: number;
      commissionPaisa: number;
    } | null;
  };
}

interface DisputesResponse {
  items: DisputeItem[];
  nextCursor: string | null;
}

export default function AdminDisputesPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Resolution Form State
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<'CONFIRMED' | 'CANCELLED'>('CONFIRMED');
  const [resolutionText, setResolutionText] = useState('');
  const [adjustmentRupees, setAdjustmentRupees] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Fetch Disputes
  const { data, isLoading, error, refetch, isFetching } = useQuery<DisputesResponse>({
    queryKey: ['admin-disputes', statusFilter, cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '15');
      return adminFetch<DisputesResponse>(`disputes?${params.toString()}`);
    },
  });

  // Resolve Mutation
  const resolveMutation = useMutation({
    mutationFn: ({
      disputeId,
      body,
    }: {
      disputeId: string;
      body: {
        resolution: string;
        targetStatus: 'CONFIRMED' | 'CANCELLED';
        adjustmentPaisa?: number;
        adjustmentNote?: string;
      };
    }) =>
      adminFetch(`/api/v1/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      success('Dispute Resolved', 'Case resolved, booking status updated, and financial adjustments applied.');
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setSelectedDispute(null);
      setIsConfirming(false);
      setResolutionText('');
      setAdjustmentRupees('');
      setAdjustmentNote('');
    },
    onError: (err: any) => {
      toastError('Resolution Failed', err.message);
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

  const parsedAdjustmentPaisa = adjustmentRupees ? Math.round(parseFloat(adjustmentRupees) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispute Resolution Center"
        description="Review driver and host conflicts, adjudicate session claims, and authorize platform adjustments."
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
        {['ALL', 'OPEN', 'RESOLVED'].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setCursor(undefined);
              setCursorHistory([]);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === st
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st === 'ALL' ? 'All Disputes' : st}
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
            <p className="text-sm">Failed to load disputes: {(error as any)?.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : data?.items?.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertOctagon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No disputes found</p>
            <p className="text-xs text-slate-400 mt-1">
              {statusFilter !== 'ALL'
                ? `No dispute cases with status ${statusFilter}`
                : 'No disputes logged on platform.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Dispute ID</th>
                  <th className="py-3 px-4">Booking</th>
                  <th className="py-3 px-4">Opened By</th>
                  <th className="py-3 px-4">Dispute Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((dispute) => (
                  <tr key={dispute.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      #{dispute.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/admin/bookings/${dispute.bookingId}`}
                        className="font-medium text-emerald-800 hover:underline flex items-center gap-1 font-mono"
                      >
                        #{dispute.bookingId.slice(-6).toUpperCase()}
                        <ArrowRight className="w-3 h-3 text-emerald-700" />
                      </Link>
                      <div className="text-[11px] text-slate-400">
                        {dispute.booking.charger.title}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{dispute.openedBy.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{dispute.openedBy.email}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-700 font-medium">
                      {dispute.reason}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={dispute.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {formatKarachiDate(dispute.createdAt, false)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedDispute(dispute);
                          setTargetStatus('CONFIRMED');
                          setResolutionText('');
                          setAdjustmentRupees('');
                          setAdjustmentNote('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>{dispute.status === 'OPEN' ? 'Adjudicate' : 'Inspect'}</span>
                      </button>
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
            Showing {data?.items?.length || 0} dispute{data?.items?.length !== 1 ? 's' : ''}
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

      {/* Dispute Resolution Drawer */}
      {selectedDispute && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Dispute #{selectedDispute.id.slice(-6).toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Booking #{selectedDispute.bookingId.slice(-6).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Reason Card */}
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-rose-900">
                  Claim Reason ({selectedDispute.openedBy.name}):
                </div>
                <div className="text-sm font-medium text-rose-950 leading-relaxed">
                  &ldquo;{selectedDispute.reason}&rdquo;
                </div>
              </div>

              {/* Booking & Session Context */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 text-xs mb-1">Session Context</div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Charger</span>
                  <span className="font-semibold text-slate-900">
                    {selectedDispute.booking.charger.title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Driver</span>
                  <span className="font-semibold text-slate-900">
                    {selectedDispute.booking.driver.name} ({selectedDispute.booking.driver.email})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Host</span>
                  <span className="font-semibold text-slate-900">
                    {selectedDispute.booking.charger.host.name} ({selectedDispute.booking.charger.host.email})
                  </span>
                </div>
                {selectedDispute.booking.session && (
                  <>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-500">Recorded kWh</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatKwh(selectedDispute.booking.session.kwhDelivered)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Session Total</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatPaisa(selectedDispute.booking.session.totalPaisa)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Platform Commission</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatPaisa(selectedDispute.booking.session.commissionPaisa)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Existing Resolution (if resolved) */}
              {selectedDispute.status === 'RESOLVED' ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                    <span>Case Resolved</span>
                  </div>
                  <div className="text-emerald-950 font-medium">
                    {selectedDispute.resolution}
                  </div>
                  {selectedDispute.resolvedBy && (
                    <div className="text-[11px] text-emerald-800">
                      Resolved by: {selectedDispute.resolvedBy.name}
                    </div>
                  )}
                </div>
              ) : (
                /* Resolution Form (if open) */
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <h4 className="font-bold text-slate-900 text-xs">Adjudicate Case</h4>

                  {/* Target Status Choice */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Adjudication Outcome
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setTargetStatus('CONFIRMED')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          targetStatus === 'CONFIRMED'
                            ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-slate-900">CONFIRMED</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Uphold session. Commission will be deducted.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTargetStatus('CANCELLED')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          targetStatus === 'CANCELLED'
                            ? 'border-red-500 bg-red-50/50 ring-2 ring-red-500'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-slate-900">CANCELLED</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Void session. No commission deducted.
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Resolution Text */}
                  <div>
                    <label htmlFor="dispute-res-text" className="block text-xs font-semibold text-slate-700 mb-1">
                      Resolution Findings & Statement (Required, min 5 chars)
                    </label>
                    <textarea
                      id="dispute-res-text"
                      rows={3}
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="e.g., Smart meter logs confirm driver received 10 kWh before disconnecting. Confirmed."
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Optional Financial Adjustment */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Discretionary Financial Adjustment (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Rs</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00 (positive to credit, negative to debit host)"
                        value={adjustmentRupees}
                        onChange={(e) => setAdjustmentRupees(e.target.value)}
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    {adjustmentRupees && parseFloat(adjustmentRupees) !== 0 && (
                      <div>
                        <label htmlFor="adj-note" className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Adjustment Audit Note (Required when adjusting balance)
                        </label>
                        <input
                          id="adj-note"
                          type="text"
                          value={adjustmentNote}
                          onChange={(e) => setAdjustmentNote(e.target.value)}
                          placeholder="e.g., Goodwill courtesy credit for host power test"
                          className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Exact Impact Summary */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-amber-950">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Financial & Status Impact:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      <li>
                        Booking #{selectedDispute.bookingId.slice(-6)} status will become{' '}
                        <strong>{targetStatus}</strong>.
                      </li>
                      {targetStatus === 'CONFIRMED' && selectedDispute.booking.session && (
                        <li>
                          Platform commission of{' '}
                          <strong>
                            {formatPaisa(selectedDispute.booking.session.commissionPaisa)}
                          </strong>{' '}
                          will be deducted from host wallet ledger.
                        </li>
                      )}
                      {targetStatus === 'CANCELLED' && (
                        <li>
                          <strong>No platform commission</strong> will be charged to the host.
                        </li>
                      )}
                      {parsedAdjustmentPaisa !== 0 && (
                        <li>
                          An ADJUSTMENT transaction of{' '}
                          <strong>{formatPaisa(parsedAdjustmentPaisa)}</strong> will be added to the
                          host ledger.
                        </li>
                      )}
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={
                      resolutionText.trim().length < 5 ||
                      (parsedAdjustmentPaisa !== 0 && adjustmentNote.trim().length < 5)
                    }
                    onClick={() => setIsConfirming(true)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review & Submit Resolution
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {isConfirming && selectedDispute && (
        <ConfirmDialog
          isOpen={true}
          title="Confirm Dispute Settlement?"
          description={`Resolve Dispute #${selectedDispute.id.slice(-6)} as ${targetStatus}.`}
          effectMessage={`The dispute will permanently be marked RESOLVED. Booking becomes ${targetStatus}.${
            targetStatus === 'CONFIRMED' && selectedDispute.booking.session
              ? ` Commission of ${formatPaisa(selectedDispute.booking.session.commissionPaisa)} will be deducted.`
              : ' No commission will be collected.'
          }${
            parsedAdjustmentPaisa !== 0
              ? ` Balance adjustment of ${formatPaisa(parsedAdjustmentPaisa)} will be recorded.`
              : ''
          }`}
          variant={targetStatus === 'CONFIRMED' ? 'primary' : 'warning'}
          confirmLabel="Execute Adjudication"
          isLoading={resolveMutation.isPending}
          onConfirm={() =>
            resolveMutation.mutate({
              disputeId: selectedDispute.id,
              body: {
                targetStatus,
                resolution: resolutionText.trim(),
                adjustmentPaisa: parsedAdjustmentPaisa || undefined,
                adjustmentNote: adjustmentNote.trim() || undefined,
              },
            })
          }
          onCancel={() => setIsConfirming(false)}
        />
      )}
    </div>
  );
}
