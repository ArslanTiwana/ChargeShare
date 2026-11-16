'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  CheckCircle,
  Slash,
  Eye,
  RefreshCw,
  Wallet,
  Zap,
  Calendar,
  UserCheck,
  X,
  Loader2,
} from 'lucide-react';
import { adminFetch } from '../_lib/api-client';
import { formatPaisa, formatKarachiDate } from '../_lib/formatters';
import { StatusBadge } from '../_components/status-badge';
import { PageHeader } from '../_components/page-header';
import { ConfirmDialog } from '../_components/confirm-dialog';
import { useToast } from '../_components/toast';

interface HostItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  hostStatus: string;
  createdAt: string;
  chargers: Array<{
    id: string;
    title: string;
    areaLabel: string;
    isOnline: boolean;
    approvalStatus: string;
    pricePerKwhPaisa: number;
  }>;
  walletTransactions: Array<{
    id: string;
    amountPaisa: number;
  }>;
  bookingsAsHost?: Array<{
    id: string;
    status: string;
    startsAt: string;
    driver: { name: string; email: string };
  }>;
}

interface HostsResponse {
  items?: HostItem[];
  hosts?: HostItem[];
  nextCursor: string | null;
}

export default function AdminHostsPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Drawer & Dialog State
  const [selectedHost, setSelectedHost] = useState<HostItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'suspend';
    host: HostItem;
  } | null>(null);

  // Fetch Hosts
  const { data, isLoading, error, refetch, isFetching } = useQuery<HostsResponse>({
    queryKey: ['admin-hosts', statusFilter, search, cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '15');
      return adminFetch<HostsResponse>(`hosts?${params.toString()}`);
    },
  });

  // Approve Host Mutation
  const approveMutation = useMutation({
    mutationFn: (hostId: string) =>
      adminFetch(`/api/v1/admin/hosts/${hostId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      success('Host Approved', 'Host account is now active and approved to list chargers.');
      queryClient.invalidateQueries({ queryKey: ['admin-hosts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setConfirmAction(null);
    },
    onError: (err: any) => {
      toastError('Approval Failed', err.message);
    },
  });

  // Suspend Host Mutation
  const suspendMutation = useMutation({
    mutationFn: (hostId: string) =>
      adminFetch(`/api/v1/admin/hosts/${hostId}/suspend`, { method: 'POST' }),
    onSuccess: () => {
      success('Host Suspended', 'Host suspended. All associated chargers are taken offline.');
      queryClient.invalidateQueries({ queryKey: ['admin-hosts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setConfirmAction(null);
    },
    onError: (err: any) => {
      toastError('Suspension Failed', err.message);
    },
  });

  const hostList = data?.items ?? data?.hosts ?? [];
  const filteredItems = hostList.filter((h) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return h.name.toLowerCase().includes(term) || h.email.toLowerCase().includes(term);
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
        title="Host Applications & Accounts"
        description="Verify homeowner identities, manage charger host accounts, and inspect host wallet activity."
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

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'PENDING', 'APPROVED', 'SUSPENDED'].map((st) => (
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
              {st === 'ALL' ? 'All Hosts' : st}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search host name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
          />
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
            <p className="text-sm">Failed to load hosts: {(error as any)?.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <UserCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No hosts found</p>
            <p className="text-xs text-slate-400 mt-1">
              {statusFilter !== 'ALL'
                ? `No hosts with status ${statusFilter}`
                : 'No hosts match your search query.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Host</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Chargers</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((host) => (
                  <tr key={host.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{host.name}</div>
                      <div className="text-slate-500 text-[11px] font-mono">{host.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {host.phone || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={host.hostStatus} />
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800">{host.chargers.length}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {formatKarachiDate(host.createdAt, false)}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => setSelectedHost(host)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                        title="View Host Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>

                      {host.hostStatus !== 'APPROVED' && (
                        <button
                          onClick={() => setConfirmAction({ type: 'approve', host })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
                          title="Approve Host"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      )}

                      {host.hostStatus === 'APPROVED' && (
                        <button
                          onClick={() => setConfirmAction({ type: 'suspend', host })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors"
                          title="Suspend Host"
                        >
                          <Slash className="w-3.5 h-3.5" />
                          <span>Suspend</span>
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
            Showing {filteredItems.length} host{filteredItems.length !== 1 ? 's' : ''}
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

      {/* Host Details Drawer */}
      {selectedHost && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedHost.name}</h3>
                <p className="text-xs text-slate-500 font-mono">{selectedHost.email}</p>
              </div>
              <button
                onClick={() => setSelectedHost(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Profile Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Account Status</span>
                  <StatusBadge status={selectedHost.hostStatus} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Direct Contact Phone</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {selectedHost.phone || 'Not provided'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Member Since</span>
                  <span className="text-slate-800">
                    {formatKarachiDate(selectedHost.createdAt)}
                  </span>
                </div>
              </div>

              {/* Wallet Summary */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-700" />
                  <span>Wallet Ledger History</span>
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 text-xs">Ledger Transactions Count</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    {selectedHost.walletTransactions?.length || 0} transaction(s) recorded
                  </div>
                </div>
              </div>

              {/* Listed Chargers */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-700" />
                  <span>Owned EV Chargers ({selectedHost.chargers?.length || 0})</span>
                </h4>
                {selectedHost.chargers?.length === 0 ? (
                  <p className="text-slate-400 p-4 border rounded-xl text-center">
                    No chargers registered yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedHost.chargers?.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{c.title}</div>
                          <div className="text-slate-400 text-[11px] font-mono">
                            {c.areaLabel} &bull; {formatPaisa(c.pricePerKwhPaisa)}/kWh
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={c.approvalStatus} />
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {c.isOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              {selectedHost.hostStatus !== 'APPROVED' && (
                <button
                  onClick={() => {
                    const host = selectedHost;
                    setSelectedHost(null);
                    setConfirmAction({ type: 'approve', host });
                  }}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors"
                >
                  Approve Host
                </button>
              )}
              {selectedHost.hostStatus === 'APPROVED' && (
                <button
                  onClick={() => {
                    const host = selectedHost;
                    setSelectedHost(null);
                    setConfirmAction({ type: 'suspend', host });
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition-colors"
                >
                  Suspend Host
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          isOpen={true}
          title={confirmAction.type === 'approve' ? 'Approve Host Account?' : 'Suspend Host Account?'}
          description={`You are about to change the host status for ${confirmAction.host.name} (${confirmAction.host.email}).`}
          effectMessage={
            confirmAction.type === 'approve'
              ? 'The host status will be set to APPROVED. The host will be permitted to list chargers and accept driver bookings.'
              : 'The host status will be set to SUSPENDED. ALL chargers belonging to this host will immediately be taken OFFLINE and removed from the driver discovery map.'
          }
          variant={confirmAction.type === 'approve' ? 'primary' : 'danger'}
          confirmLabel={confirmAction.type === 'approve' ? 'Approve Host' : 'Suspend Host'}
          isLoading={approveMutation.isPending || suspendMutation.isPending}
          onConfirm={() => {
            if (confirmAction.type === 'approve') {
              approveMutation.mutate(confirmAction.host.id);
            } else {
              suspendMutation.mutate(confirmAction.host.id);
            }
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
