import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChargeShare - Residential EV Charging Network (Pakistan)',
  description: 'Rent out residential EV chargers and book charging slots across Pakistan.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
