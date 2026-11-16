import React from 'react';
import Link from 'next/link';
import { Shield, Zap, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | ChargeShare',
  description: 'ChargeShare Pakistan Privacy Policy and Data Handling Practices',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-900 font-bold text-lg">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Zap className="w-5 h-5" />
            </div>
            <span>ChargeShare</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Privacy Policy</h1>
            <p className="text-sm text-slate-500 mt-1">Last updated: November 2026 • Legal Draft</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Introduction</h2>
            <p>
              ChargeShare (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates a peer-to-peer residential EV charger marketplace across Pakistan. This Privacy Policy outlines our standards and practices regarding the collection, use, retention, and protection of your personal information when you use our web platform and mobile application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Information We Collect</h2>
            <p>To provide reliable and secure marketplace transactions, we collect:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Account Credentials:</strong> Full name, verified email address, hashed passwords, and optional profile pictures. For Google Sign-In users, we receive verified identity tokens from Google LLC.</li>
              <li><strong>Contact Information:</strong> Pakistani phone number (03xx-xxxxxxx) required prior to booking confirmations or host applications to facilitate driver-host coordination.</li>
              <li><strong>Location Data:</strong> Precise GPS coordinates of host charging stations. Public map listings show fuzzified approximate coordinates (~200m offset); exact address lines and coordinates are revealed exclusively to drivers with accepted bookings.</li>
              <li><strong>Visual Documentation:</strong> Optional photographic verification of electric meters during charging sessions, and host top-up payment deposit screenshots. EXIF metadata is stripped prior to storage.</li>
              <li><strong>Device & Notification Identifiers:</strong> Expo Push Tokens to deliver mission-critical transactional notifications (e.g., booking requests, approvals, session completions).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. How Information is Used</h2>
            <p>Collected data is used strictly for:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Enabling marketplace matchmaking between EV owners and charger hosts.</li>
              <li>Calculating consumption sessions, platform commissions, and maintaining immutable host wallet ledgers.</li>
              <li>Delivering automated push notifications and email receipts.</li>
              <li>Preventing fraudulent bookings and resolving driver-host disputes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Data Sharing & Third Parties</h2>
            <p>
              We do not sell or rent personal information to data brokers. Data is processed exclusively by our infrastructure providers under standard data protection agreements:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Database & Hosting:</strong> Neon PostgreSQL and Vercel Inc.</li>
              <li><strong>Object Storage:</strong> Cloudflare R2 / AWS S3 compatible encrypted storage.</li>
              <li><strong>Communications:</strong> Resend (transactional email) and Expo / Google Firebase Cloud Messaging (push notifications).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Data Retention & Deletion Rights</h2>
            <p>
              Under Google Play guidelines and consumer protection standards, users retain the right to permanently delete their account at any time:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>In-App Deletion:</strong> Accessible directly in the mobile app under Profile &gt; Delete Account.</li>
              <li><strong>Web Deletion Portal:</strong> Accessible to anyone via our public <Link href="/delete-account" className="text-emerald-600 underline font-medium">Account Deletion Page</Link>.</li>
              <li><strong>Anonymization:</strong> Upon account deletion, personal identifiers (name, email, phone, photos, tokens) are purged or replaced with non-identifying placeholders. Historical ledger records and completed booking summaries are retained solely to satisfy legal and accounting obligations.</li>
              <li><strong>Photo Lifecycle:</strong> Session meter photos are automatically scheduled for permanent deletion after 180 days.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Security Measures</h2>
            <p>
              We enforce strict industry-standard security controls including Content Security Policies (CSP), HTTP Strict Transport Security (HSTS), rate-limiting on sensitive authentication endpoints, bcrypt password hashing (cost factor 12), and role-based access control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us at <a href="mailto:support@chargeshare.pk" className="text-emerald-600 underline font-medium">support@chargeshare.pk</a> or visit our <Link href="/support" className="text-emerald-600 underline font-medium">Support Desk</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
