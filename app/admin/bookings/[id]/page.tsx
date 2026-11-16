'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarCheck,
  User,
  Zap,
  MapPin,
  Clock,
  Coins,
  ImageIcon,
  History,
  AlertOctagon,
  Star,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { adminFetch } from '../../_lib/api-client';
import { formatPaisa, formatKarachiDate, formatKwh } from '../../_lib/formatters';
import { StatusBadge } from '../../_components/status-badge';
import { ImageZoomModal } from '../../_components/image-zoom-modal';

interface BookingDetailResponse {
  id: string;
  driverId: string;
  chargerId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  estimatedKwh: number | null;
  rateSnapshotPaisa: number | null;
  cancelReason: string | null;
  createdAt: string;
  driver: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  charger: {
    id: string;
    title: string;
    powerKw: number;
    connectorType: string;
    areaLabel: string;
    addressLine: string;
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
    autoConfirmed: boolean;
    hostEnteredAt: string;
    driverConfirmedAt: string | null;
    meterStartPhotoKey: string | null;
    meterEndPhotoKey: string | null;
    meterStartPhotoUrl: string | null;
    meterEndPhotoUrl: string | null;
    edits?: Array<{
      id: string;
      previousKwh: number;
      newKwh: number;
      reason: string | null;
      createdAt: string;
    }>;
  } | null;
  dispute?: {
    id: string;
    reason: string;
    status: string;
    resolution: string | null;
    createdAt: string;
    openedBy: { id: string; name: string; email: string };
    resolvedBy?: { id: string; name: string; email: string } | null;
  } | null;
  reviews?: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    reviewer: { id: string; name: string };
  }>;
}

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  const { data: booking, isLoading, error, refetch } = useQuery<BookingDetailResponse>({
    queryKey: ['admin-booking-detail', id],
    queryFn: () => adminFetch<BookingDetailResponse>(`bookings/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-slate-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse md:col-span-2" />
          <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-4">
        <p className="text-sm text-red-600 font-semibold">Failed to load booking details</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back Button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <Link
            href="/admin/bookings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Bookings</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              Booking #{booking.id.slice(-6).toUpperCase()}
            </h1>
            <StatusBadge status={booking.status} size="md" />
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Created: <span className="font-semibold text-slate-700">{formatKarachiDate(booking.createdAt)}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Session & Technical Data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Progress Stepper */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Booking Lifecycle
            </h2>
            <div className="flex items-center justify-between text-xs font-semibold relative">
              {['REQUESTED', 'ACCEPTED', 'CHARGING', 'COMPLETED', 'CONFIRMED'].map((st, idx) => {
                const isPassed =
                  st === booking.status ||
                  (booking.status === 'CONFIRMED' && st !== 'CONFIRMED') ||
                  (booking.status === 'COMPLETED' && ['REQUESTED', 'ACCEPTED', 'CHARGING'].includes(st)) ||
                  (booking.status === 'CHARGING' && ['REQUESTED', 'ACCEPTED'].includes(st)) ||
                  (booking.status === 'ACCEPTED' && st === 'REQUESTED');

                const isCurrent = st === booking.status;

                return (
                  <div key={st} className="flex flex-col items-center z-10">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        isCurrent
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                          : isPassed
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span className={`mt-1.5 ${isCurrent ? 'text-emerald-800 font-bold' : 'text-slate-500'}`}>
                      {st}
                    </span>
                  </div>
                );
              })}
            </div>
            {booking.cancelReason && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
                <span className="font-semibold">Cancellation Reason:</span> {booking.cancelReason}
              </div>
            )}
          </div>

          {/* Session Energy & Financial Settlement */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-700" />
                <span>Session Settlement & Meter Readings</span>
              </h2>
              {booking.session?.autoConfirmed && (
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold">
                  Auto-Confirmed by Daily Cron
                </span>
              )}
            </div>

            {booking.session ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <div className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                      Delivered Energy
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {formatKwh(booking.session.kwhDelivered)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                      Agreed Rate
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {formatPaisa(booking.session.rateSnapshotPaisa)}/kWh
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                      Total Driver Payment
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {formatPaisa(booking.session.totalPaisa)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                      ChargeShare Commission
                    </div>
                    <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                      {formatPaisa(booking.session.commissionPaisa)}
                    </div>
                  </div>
                </div>

                {/* Meter Photos */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Sub-meter Verification Photos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Start Photo */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col justify-between">
                      <div className="font-semibold text-slate-800 text-xs mb-2 flex items-center justify-between">
                        <span>Meter Start Photo</span>
                        <span className="text-[10px] text-slate-400">Pre-Charge</span>
                      </div>
                      {booking.session.meterStartPhotoUrl ? (
                        <div
                          onClick={() =>
                            setZoomedImage({
                              url: booking.session!.meterStartPhotoUrl!,
                              title: `Booking #${booking.id.slice(-6)} - Meter Start Photo`,
                            })
                          }
                          className="cursor-zoom-in relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-900 h-40"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={booking.session.meterStartPhotoUrl}
                            alt="Meter Start"
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 text-white font-semibold text-xs transition-opacity">
                            Click to zoom
                          </div>
                        </div>
                      ) : (
                        <div className="h-40 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs">
                          No photo submitted
                        </div>
                      )}
                    </div>

                    {/* End Photo */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col justify-between">
                      <div className="font-semibold text-slate-800 text-xs mb-2 flex items-center justify-between">
                        <span>Meter End Photo</span>
                        <span className="text-[10px] text-slate-400">Post-Charge</span>
                      </div>
                      {booking.session.meterEndPhotoUrl ? (
                        <div
                          onClick={() =>
                            setZoomedImage({
                              url: booking.session!.meterEndPhotoUrl!,
                              title: `Booking #${booking.id.slice(-6)} - Meter End Photo`,
                            })
                          }
                          className="cursor-zoom-in relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-900 h-40"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={booking.session.meterEndPhotoUrl}
                            alt="Meter End"
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 text-white font-semibold text-xs transition-opacity">
                            Click to zoom
                          </div>
                        </div>
                      ) : (
                        <div className="h-40 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs">
                          No photo submitted
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session Edit History */}
                {booking.session.edits && booking.session.edits.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-slate-400" />
                      <span>Reading Revision Audit Log ({booking.session.edits.length})</span>
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="py-2 px-3">Revised At</th>
                            <th className="py-2 px-3">Previous</th>
                            <th className="py-2 px-3">Updated To</th>
                            <th className="py-2 px-3">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {booking.session.edits.map((edit) => (
                            <tr key={edit.id}>
                              <td className="py-2 px-3 text-slate-500">
                                {formatKarachiDate(edit.createdAt)}
                              </td>
                              <td className="py-2 px-3 font-mono line-through text-slate-400">
                                {formatKwh(edit.previousKwh)}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                {formatKwh(edit.newKwh)}
                              </td>
                              <td className="py-2 px-3 text-slate-700 italic">
                                {edit.reason || 'None provided'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
                No session reading has been submitted yet for this booking.
              </div>
            )}
          </div>

          {/* Dispute Context if Exists */}
          {booking.dispute && (
            <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  <span>Associated Dispute Case</span>
                </h3>
                <StatusBadge status={booking.dispute.status} />
              </div>
              <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 text-xs space-y-2">
                <div>
                  <span className="font-semibold text-rose-900">Reason Filed:</span>{' '}
                  <span className="text-rose-800">{booking.dispute.reason}</span>
                </div>
                {booking.dispute.resolution && (
                  <div>
                    <span className="font-semibold text-rose-900">Admin Resolution:</span>{' '}
                    <span className="text-rose-800">{booking.dispute.resolution}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reviews if Exist */}
          {booking.reviews && booking.reviews.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                <span>Submitted Reviews</span>
              </h3>
              <div className="space-y-2">
                {booking.reviews.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-900">{r.reviewer.name}</span>
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        ★ {r.rating} / 5
                      </span>
                    </div>
                    {r.comment && <p className="text-slate-600 italic">&ldquo;{r.comment}&rdquo;</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Parties & Charger Details */}
        <div className="space-y-6">
          {/* Driver Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Driver</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{booking.driver.name}</div>
                <div className="text-slate-400 text-xs font-mono">{booking.driver.email}</div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 text-xs flex justify-between">
              <span className="text-slate-500">Phone:</span>
              <span className="font-mono text-slate-800 font-semibold">{booking.driver.phone || 'Not provided'}</span>
            </div>
          </div>

          {/* Host Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Host (Owner)</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{booking.charger.host.name}</div>
                <div className="text-slate-400 text-xs font-mono">{booking.charger.host.email}</div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 text-xs flex justify-between">
              <span className="text-slate-500">Phone:</span>
              <span className="font-mono text-slate-800 font-semibold">{booking.charger.host.phone || 'Not provided'}</span>
            </div>
          </div>

          {/* Charger Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Charger & Location</h3>
            <div>
              <div className="font-bold text-slate-900 text-sm">{booking.charger.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {booking.charger.connectorType} &bull; {booking.charger.powerKw} kW
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-xs space-y-2">
              <div>
                <span className="text-slate-400 block font-medium">Public Sector Area:</span>
                <span className="font-semibold text-slate-800">{booking.charger.areaLabel}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Full Private Address (Admin):</span>
                <span className="font-mono text-slate-800 block p-2 bg-slate-50 rounded border border-slate-200 mt-1">
                  {booking.charger.addressLine}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Zoom Modal */}
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
