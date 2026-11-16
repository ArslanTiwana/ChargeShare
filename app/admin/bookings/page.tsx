'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  Search,
  Filter,
  Eye,
  RefreshCw,
  MapPin,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { adminFetch } from '../_lib/api-client';
import { formatPaisa, formatKarachiDate, formatKwh } from '../_lib/formatters';
import { StatusBadge } from '../_components/status-badge';
import { PageHeader } from '../_components/page-header';

interface BookingListItem {
  id: string;
  driverId: string;
  chargerId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  estimatedKwh: number | null;
  rateSnapshotPaisa: number | null;
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
    totalPaisa: number;
    commissionPaisa: number;
  } | null;
  dispute?: {
    id: string;
    status: string;
  } | null;
}

interface BookingsResponse {
  items: BookingListItem[];
  nextCursor: string | null;
}

const bookingStatusOptions = [
  'ALL',
  'REQUESTED',
  'ACCEPTED',
  'CHARGING',
  'COMPLETED',
  'CONFIRMED',
  'DECLINED',
  'CANCELLED',
  'DISPUTED',
  'EXPIRED',
];

export default function AdminBookingsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const { data, isLoading, error, refetch, isFetching } = useQuery<BookingsResponse>({
    queryKey: ['admin-bookings', statusFilter, dateFilter, cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (dateFilter) params.set('date', dateFilter);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '15');
      return adminFetch<BookingsResponse>(`bookings?${params.toString()}`);
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
        title="EV Slot Bookings"
        description="Inspect charging sessions across Pakistan, monitor state transitions, and audit rate snapshots and energy delivery."
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

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {bookingStatusOptions.map((st) => (
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
              {st === 'ALL' ? 'All Bookings' : st}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="booking-date" className="text-xs text-slate-500 font-medium">
            Date (PKT):
          </label>
          <input
            id="booking-date"
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setCursor(undefined);
              setCursorHistory([]);
            }}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {dateFilter && (
            <button
              onClick={() => {
                setDateFilter('');
                setCursor(undefined);
                setCursorHistory([]);
              }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>
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
            <p className="text-sm">Failed to load bookings: {(error as any)?.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : data?.items?.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CalendarCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No bookings found</p>
            <p className="text-xs text-slate-400 mt-1">
              No charging sessions match the selected filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Booking</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Charger & Host</th>
                  <th className="py-3 px-4">Schedule (PKT)</th>
                  <th className="py-3 px-4">Energy & Rate</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      #{b.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{b.driver.name}</div>
                      <div className="text-slate-400 text-[11px] font-mono">{b.driver.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{b.charger.title}</div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{b.charger.areaLabel}</span> &bull;{' '}
                        <span className="text-slate-400 font-mono">{b.charger.host.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">
                        {formatKarachiDate(b.startsAt)}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        to {formatKarachiDate(b.endsAt, true)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {b.session ? (
                        <>
                          <div className="font-bold text-slate-900">
                            {formatKwh(b.session.kwhDelivered)}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-semibold">
                            Total: {formatPaisa(b.session.totalPaisa)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-slate-600">
                            Est: {b.estimatedKwh ? `${b.estimatedKwh} kWh` : '—'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Rate: {b.rateSnapshotPaisa ? formatPaisa(b.rateSnapshotPaisa) : 'Pending'}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
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
            Showing {data?.items?.length || 0} booking{data?.items?.length !== 1 ? 's' : ''}
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
    </div>
  );
}
