import React from 'react';
import type { Metadata } from 'next';
import { AdminQueryProvider } from './_lib/query-provider';
import { ToastProvider } from './_components/toast';
import { AdminShell } from './_components/admin-shell';

export const metadata: Metadata = {
  title: 'ChargeShare Admin Portal',
  description: 'Management & Operations Portal for ChargeShare Pakistan',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminQueryProvider>
      <ToastProvider>
        <AdminShell>{children}</AdminShell>
      </ToastProvider>
    </AdminQueryProvider>
  );
}
