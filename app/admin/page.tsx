'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Coins,
  UserCheck,
  Zap,
  CreditCard,
  AlertOctagon,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { adminFetch } from './_lib/api-client';
import { formatPaisa } from './_lib/formatters';
import { StatusBadge } from './_components/status-badge';
import { PageHeader } from './_components/page-header';

interface StatsResponse {
  users: number;
  hostsPending: number;
  chargersPending: number;
  openDisputes: number;
  pendingTopups: number;
  totalCommissionCollectedPaisa: number;
  totalCommissionCollectedRupees: string;
  bookingsByStatus: Record<string, number>;
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading, error, refetch, isFetching } = useQuery<StatsResponse>({
    queryKey: ['admin-stats'],
    queryFn: () => adminFetch<StatsResponse>('stats'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-slate-200 rounded-xl w-64 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Failed to load platform stats</h2>
          <p className="text-sm text-slate-500 mt-1">{(error as any)?.message || 'Unknown network error'}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const attentionCount =
    stats.hostsPending + stats.chargersPending + stats.pendingTopups + stats.openDisputes;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operations Dashboard"
        description="Real-time status of the Pakistan residential EV charger marketplace."
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Top 6 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Total Platform Commission Revenue */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Commission Revenue</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {formatPaisa(stats.totalCommissionCollectedPaisa)}
            </div>
            <div className="text-xs text-emerald-700 font-medium mt-1">
              Collected from completed & confirmed sessions
            </div>
          </div>
        </div>

        {/* Registered Users */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Registered Users</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900">{stats.users}</div>
            <div className="text-xs text-slate-500 mt-1">Drivers and Homeowners across Pakistan</div>
          </div>
        </div>

        {/* Pending Host Applications */}
        <Link
          href="/admin/hosts?status=PENDING"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Hosts</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 group-hover:scale-105 transition-transform">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{stats.hostsPending}</span>
              <span className="text-xs font-semibold text-amber-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Review <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Awaiting approval verification</div>
          </div>
        </Link>

        {/* Pending Chargers */}
        <Link
          href="/admin/chargers?status=PENDING"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Chargers</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{stats.chargersPending}</span>
              <span className="text-xs font-semibold text-amber-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Review <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Listings submitted for inspection</div>
          </div>
        </Link>

        {/* Pending Wallet Top-ups */}
        <Link
          href="/admin/topups?status=PENDING"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Top-ups</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 group-hover:scale-105 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{stats.pendingTopups}</span>
              <span className="text-xs font-semibold text-amber-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Verify <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Bank receipts requiring match</div>
          </div>
        </Link>

        {/* Open Disputes */}
        <Link
          href="/admin/disputes?status=OPEN"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-rose-400 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Open Disputes</span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 group-hover:scale-105 transition-transform">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{stats.openDisputes}</span>
              <span className="text-xs font-semibold text-rose-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Resolve <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Conflicts awaiting admin resolution</div>
          </div>
        </Link>
      </div>

      {/* Needs Attention Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Needs Attention</h2>
            <p className="text-xs text-slate-500">Items requiring administrator action or review</p>
          </div>
          {attentionCount === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> All queues clear
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
              {attentionCount} Pending Action{attentionCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/hosts?status=PENDING"
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-slate-500">Pending Hosts</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{stats.hostsPending}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>

          <Link
            href="/admin/chargers?status=PENDING"
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-slate-500">Pending Chargers</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{stats.chargersPending}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>

          <Link
            href="/admin/topups?status=PENDING"
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-slate-500">Pending Top-ups</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{stats.pendingTopups}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>

          <Link
            href="/admin/disputes?status=OPEN"
            className="p-4 rounded-xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50/30 transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-slate-500">Active Disputes</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{stats.openDisputes}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Bookings Breakdown */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bookings by State</h2>
            <p className="text-xs text-slate-500">Distribution of all slots across the booking state machine</p>
          </div>
          <Link
            href="/admin/bookings"
            className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
          >
            View all bookings <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            'REQUESTED',
            'ACCEPTED',
            'CHARGING',
            'COMPLETED',
            'CONFIRMED',
            'DECLINED',
            'CANCELLED',
            'DISPUTED',
          ].map((st) => {
            const count = stats.bookingsByStatus[st] || 0;
            return (
              <div
                key={st}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex flex-col justify-between"
              >
                <div className="mb-2">
                  <StatusBadge status={st} />
                </div>
                <div className="text-xl font-bold text-slate-900">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
