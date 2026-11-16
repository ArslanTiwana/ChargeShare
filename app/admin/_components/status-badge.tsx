import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<string, { bg: string; text: string; label?: string }> = {
  // Booking Statuses
  REQUESTED: { bg: 'bg-amber-100 border-amber-200', text: 'text-amber-800', label: 'Requested' },
  ACCEPTED: { bg: 'bg-blue-100 border-blue-200', text: 'text-blue-800', label: 'Accepted' },
  CHARGING: { bg: 'bg-emerald-100 border-emerald-200', text: 'text-emerald-800', label: 'Charging' },
  COMPLETED: { bg: 'bg-purple-100 border-purple-200', text: 'text-purple-800', label: 'Completed' },
  CONFIRMED: { bg: 'bg-emerald-600 border-emerald-700', text: 'text-white', label: 'Confirmed' },
  DECLINED: { bg: 'bg-slate-200 border-slate-300', text: 'text-slate-700', label: 'Declined' },
  CANCELLED: { bg: 'bg-red-100 border-red-200', text: 'text-red-800', label: 'Cancelled' },
  DISPUTED: { bg: 'bg-rose-100 border-rose-300', text: 'text-rose-900', label: 'Disputed' },
  EXPIRED: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', label: 'Expired' },

  // Host & Charger Approval Statuses
  PENDING: { bg: 'bg-amber-50 border-amber-300', text: 'text-amber-900', label: 'Pending Review' },
  APPROVED: { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-900', label: 'Approved' },
  REJECTED: { bg: 'bg-red-50 border-red-300', text: 'text-red-900', label: 'Rejected' },
  SUSPENDED: { bg: 'bg-slate-900 border-slate-900', text: 'text-white', label: 'Suspended' },
  NONE: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', label: 'None' },

  // Dispute Statuses
  OPEN: { bg: 'bg-rose-600 border-rose-700', text: 'text-white', label: 'Open' },
  RESOLVED: { bg: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-800', label: 'Resolved' },

  // User Status
  ACTIVE: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Active' },
  INACTIVE: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', label: 'Inactive' },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const normalized = status ? status.toUpperCase() : 'UNKNOWN';
  const config = statusStyles[normalized] || {
    bg: 'bg-slate-100 border-slate-200',
    text: 'text-slate-700',
    label: status,
  };

  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${config.text} ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70" />
      {config.label || status}
    </span>
  );
}
