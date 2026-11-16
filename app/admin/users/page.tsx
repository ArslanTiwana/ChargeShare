'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  CheckCircle,
  Slash,
  RefreshCw,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Calendar,
} from 'lucide-react';
import { adminFetch } from '../_lib/api-client';
import { formatKarachiDate } from '../_lib/formatters';
import { StatusBadge } from '../_components/status-badge';
import { PageHeader } from '../_components/page-header';
import { ConfirmDialog } from '../_components/confirm-dialog';
import { useToast } from '../_components/toast';

interface UserItem {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  hostStatus: string;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

interface UsersResponse {
  items: UserItem[];
  nextCursor: string | null;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Dialog State
  const [confirmUser, setConfirmUser] = useState<{
    type: 'activate' | 'deactivate';
    user: UserItem;
  } | null>(null);

  // Fetch Users
  const { data, isLoading, error, refetch, isFetching } = useQuery<UsersResponse>({
    queryKey: ['admin-users', roleFilter, search, cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (search.trim()) params.set('search', search.trim());
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '15');
      return adminFetch<UsersResponse>(`users?${params.toString()}`);
    },
  });

  // Activate Mutation
  const activateMutation = useMutation({
    mutationFn: (userId: string) =>
      adminFetch(`/api/v1/admin/users/${userId}/activate`, { method: 'POST' }),
    onSuccess: () => {
      success('User Activated', 'User account is now enabled.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setConfirmUser(null);
    },
    onError: (err: any) => {
      toastError('Activation Failed', err.message);
    },
  });

  // Deactivate Mutation
  const deactivateMutation = useMutation({
    mutationFn: (userId: string) =>
      adminFetch(`/api/v1/admin/users/${userId}/deactivate`, { method: 'POST' }),
    onSuccess: () => {
      success('User Deactivated', 'User account disabled and all active sessions revoked.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setConfirmUser(null);
    },
    onError: (err: any) => {
      toastError('Deactivation Failed', err.message);
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
        title="User & Account Governance"
        description="Search drivers, hosts, and administrative personnel across the platform. Manage security status and active sessions."
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          {['ALL', 'USER', 'ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => {
                setRoleFilter(r);
                setCursor(undefined);
                setCursorHistory([]);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                roleFilter === r
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {r === 'ALL' ? 'All Roles' : r}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search email or name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(undefined);
              setCursorHistory([]);
            }}
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
            <p className="text-sm">Failed to load users: {(error as any)?.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : data?.items?.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No users found</p>
            <p className="text-xs text-slate-400 mt-1">No accounts match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Host Status</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Email Verified</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-slate-400 text-[11px] font-mono">{user.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          user.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {user.role === 'ADMIN' && <Shield className="w-3 h-3 text-purple-700" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={user.hostStatus} />
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {user.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {user.emailVerifiedAt ? (
                        <span className="text-emerald-700 font-medium">Verified</span>
                      ) : (
                        <span className="text-slate-400">Unverified</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {formatKarachiDate(user.createdAt, false)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {user.isActive ? (
                        <button
                          onClick={() => setConfirmUser({ type: 'deactivate', user })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors"
                          title="Deactivate Account"
                        >
                          <Slash className="w-3.5 h-3.5" />
                          <span>Deactivate</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmUser({ type: 'activate', user })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
                          title="Activate Account"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Activate</span>
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
            Showing {data?.items?.length || 0} user{data?.items?.length !== 1 ? 's' : ''}
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

      {/* Confirmation Dialog */}
      {confirmUser && (
        <ConfirmDialog
          isOpen={true}
          title={
            confirmUser.type === 'activate'
              ? 'Reactivate User Account?'
              : 'Deactivate User Account?'
          }
          description={`Are you sure you want to ${confirmUser.type} the account for ${confirmUser.user.name} (${confirmUser.user.email})?`}
          effectMessage={
            confirmUser.type === 'activate'
              ? 'The user account will be reactivated, permitting login, charger bookings, and host dashboard access.'
              : 'The user account will be locked immediately. ALL active refresh tokens and sessions will be revoked. The user will be logged out everywhere.'
          }
          variant={confirmUser.type === 'activate' ? 'primary' : 'danger'}
          confirmLabel={confirmUser.type === 'activate' ? 'Activate Account' : 'Deactivate Account'}
          isLoading={activateMutation.isPending || deactivateMutation.isPending}
          onConfirm={() => {
            if (confirmUser.type === 'activate') {
              activateMutation.mutate(confirmUser.user.id);
            } else {
              deactivateMutation.mutate(confirmUser.user.id);
            }
          }}
          onCancel={() => setConfirmUser(null)}
        />
      )}
    </div>
  );
}
