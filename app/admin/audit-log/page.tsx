'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Filter,
  RefreshCw,
  Shield,
  Eye,
  Calendar,
  Code,
  X,
} from 'lucide-react';
import { adminFetch } from '../_lib/api-client';
import { formatKarachiDate } from '../_lib/formatters';
import { PageHeader } from '../_components/page-header';

interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: string;
  admin: {
    id: string;
    name: string;
    email: string;
  };
}

interface AuditLogResponse {
  items: AuditLogEntry[];
  nextCursor: string | null;
}

const actionOptions = [
  'ALL',
  'HOST_APPROVED',
  'HOST_SUSPENDED',
  'CHARGER_APPROVED',
  'CHARGER_REJECTED',
  'TOPUP_APPROVED',
  'TOPUP_REJECTED',
  'DISPUTE_RESOLVED',
  'USER_ACTIVATED',
  'USER_DEACTIVATED',
  'CONFIG_UPDATED',
];

export default function AdminAuditLogPage() {
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<AuditLogResponse>({
    queryKey: ['admin-audit-log', actionFilter, cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      if (actionFilter !== 'ALL') params.set('action', actionFilter);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '20');
      return adminFetch<AuditLogResponse>(`audit-log?${params.toString()}`);
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
        title="Administrative Audit Trail"
        description="Immutable record of sensitive operations performed by system administrators, including financial authorizations and account overrides."
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 overflow-x-auto">
        {actionOptions.map((act) => (
          <button
            key={act}
            onClick={() => {
              setActionFilter(act);
              setCursor(undefined);
              setCursorHistory([]);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              actionFilter === act
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {act === 'ALL' ? 'All Actions' : act}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-sm">Failed to load audit logs: {(error as any)?.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : data?.items?.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No audit log entries</p>
            <p className="text-xs text-slate-400 mt-1">No actions match the selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Timestamp (PKT)</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Administrator</th>
                  <th className="py-3 px-4">Metadata</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {formatKarachiDate(log.createdAt)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-semibold text-slate-900">{log.targetType}</div>
                      <div className="text-slate-400 text-[10px] truncate max-w-[120px]">
                        {log.targetId}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{log.admin.name}</div>
                      <div className="text-slate-400 text-[11px] font-mono">{log.admin.email}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate font-mono text-[11px] text-slate-500">
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedEntry(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
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
            Showing {data?.items?.length || 0} event{data?.items?.length !== 1 ? 's' : ''}
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

      {/* Detail Modal */}
      {selectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">Audit Log Event</h3>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Action:</span>
                <span className="font-bold text-slate-900">{selectedEntry.action}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Type / ID:</span>
                <span className="font-mono text-slate-800">
                  {selectedEntry.targetType} ({selectedEntry.targetId})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Administrator:</span>
                <span className="font-semibold text-slate-800">
                  {selectedEntry.admin.name} ({selectedEntry.admin.email})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp (PKT):</span>
                <span className="font-mono text-slate-800">
                  {formatKarachiDate(selectedEntry.createdAt)}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block mb-1">Payload Metadata:</span>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono">
                  {JSON.stringify(selectedEntry.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
