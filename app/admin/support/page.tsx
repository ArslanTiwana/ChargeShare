'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy,
  CheckCircle2,
  Clock,
  RefreshCw,
  Mail,
  User,
  Check,
  RotateCcw,
} from 'lucide-react';
import { adminFetch } from '../_lib/api-client';
import { formatKarachiDate } from '../_lib/formatters';
import { PageHeader } from '../_components/page-header';
import { useToast } from '../_components/toast';

interface SupportMessageItem {
  id: string;
  subject: string;
  message: string;
  appVersion?: string | null;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

export default function AdminSupportPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-support', statusFilter],
    queryFn: async () => {
      const url =
        statusFilter === 'ALL'
          ? '/api/v1/admin/support'
          : `/api/v1/admin/support?status=${statusFilter}`;
      const res = await adminFetch<{ items: SupportMessageItem[]; pagination: { total: number } }>(
        url
      );
      return res;
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: 'OPEN' | 'RESOLVED' }) => {
      return adminFetch(`/api/v1/admin/support/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
    },
    onSuccess: (_, variables) => {
      success('Ticket updated', `Ticket status updated to ${variables.newStatus.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['admin-support'] });
    },
    onError: (err: unknown) => {
      toastError('Update failed', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Desk"
        description="Review, manage, and resolve inquiries from drivers, hosts, and visitors"
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {(['OPEN', 'RESOLVED', 'ALL'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              statusFilter === tab
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab === 'ALL' ? 'All Inquiries' : tab === 'OPEN' ? 'Open Inquiries' : 'Resolved'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
          Loading support inquiries...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <LifeBuoy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No support tickets found</h3>
          <p className="text-sm text-slate-500 mt-1">There are no inquiries matching this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'OPEN'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.status === 'OPEN' ? (
                      <>
                        <Clock className="w-3.5 h-3.5" /> Open
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                      </>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatKarachiDate(item.createdAt)}
                  </span>
                </div>

                <div>
                  {item.status === 'OPEN' ? (
                    <button
                      onClick={() =>
                        toggleStatusMutation.mutate({ id: item.id, newStatus: 'RESOLVED' })
                      }
                      disabled={toggleStatusMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" /> Mark Resolved
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        toggleStatusMutation.mutate({ id: item.id, newStatus: 'OPEN' })
                      }
                      disabled={toggleStatusMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reopen Ticket
                    </button>
                  )}
                </div>
              </div>

              <h4 className="text-base font-bold text-slate-900 mb-2">{item.subject}</h4>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
                {item.message}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {item.user?.name || 'User'}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`mailto:${item.user?.email}`} className="text-emerald-600 underline">
                    {item.user?.email}
                  </a>
                </span>
                {item.appVersion && (
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                    v{item.appVersion}
                  </span>
                )}
                {item.user?.phone && (
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                    {item.user.phone}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
