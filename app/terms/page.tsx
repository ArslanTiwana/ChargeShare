import React from 'react';
import Link from 'next/link';
import { FileText, Zap, ArrowLeft, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | ChargeShare',
  description: 'ChargeShare Marketplace Terms of Service and Electrical Safety Agreement',
};

export default function TermsOfServicePage() {
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
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Terms of Service</h1>
            <p className="text-sm text-slate-500 mt-1">Last updated: November 2026 • Legal Draft</p>
          </div>
        </div>

        {/* Safety Warning Banner */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 my-6">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <span className="font-bold">CRITICAL ELECTRICAL & PREMISES SAFETY NOTICE:</span> ChargeShare is an online communications marketplace. ChargeShare does not inspect, install, certify, or maintain residential electric equipment or premises. Hosts and drivers participate at their own discretion and risk.
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Platform Nature & Marketplace Role</h2>
            <p>
              ChargeShare operates an online intermediary marketplace designed to connect residential electric vehicle (EV) charging station owners (&quot;Hosts&quot;) with electric vehicle drivers (&quot;Drivers&quot;) in Pakistan. ChargeShare is not an electric utility, distributor, EV charger manufacturer, or certified electrician.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Electrical Safety & Host Responsibilities</h2>
            <p>
              Hosts maintain complete and exclusive responsibility for their premises, electrical wiring, and charging equipment. By listing a charger on ChargeShare, Hosts represent and warrant that:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>The charger was installed by a qualified electrician in accordance with Pakistan National Electric Power Regulatory Authority (NEPRA) regulations and local utility standards (e.g., LESCO, K-Electric, IESCO).</li>
              <li>Dedicated circuit breakers, adequate earthing/grounding, and surge protection devices are installed and properly maintained.</li>
              <li>The parking area provides safe, unobstructed ingress and egress without posing fire, tripping, or electrocution hazards.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Driver Responsibilities & Vehicle Compatibility</h2>
            <p>
              Drivers are solely responsible for ensuring that their vehicle’s onboard charger, battery management system (BMS), cables, and adapters (e.g., GB/T to Type 2) are fully compatible with the Host&apos;s specified connector type and power rating. Drivers agree to operate the charging apparatus respectfully and vacate premises promptly upon session conclusion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Fees, Billing, and Host Ledger</h2>
            <p>
              Electricity consumption fees are calculated based on recorded kilowatt-hours (kWh) multiplied by the snapshot rate in Pakistani Rupees (PKR) at the time of booking confirmation:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Driver Settlement:</strong> Drivers pay the Host directly upon session completion via agreed peer-to-peer methods (Cash, Easypaisa, JazzCash, or bank transfer).</li>
              <li><strong>Platform Commission:</strong> ChargeShare deducts an agreed platform commission from the Host&apos;s prepaid in-app wallet upon driver confirmation or auto-confirmation.</li>
              <li><strong>Prepaid Minimum Balance:</strong> Hosts must maintain a positive prepaid wallet balance to accept incoming bookings.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Dispute Resolution</h2>
            <p>
              In the event of a discrepancy regarding meter readings or session delivery, either party may file a Dispute in the app prior to confirmation. ChargeShare administration will review meter evidence and photographic records to issue a final administrative resolution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable Pakistani law, ChargeShare, its officers, employees, and partners disclaim all liability for any direct, indirect, incidental, punitive, or consequential damages resulting from equipment malfunction, vehicular damage, property damage, electrical surges, power cuts, or personal injury arising out of or related to charging sessions arranged through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Modifications & Inquiries</h2>
            <p>
              We reserve the right to revise these Terms of Service at any time. For questions regarding these terms, contact <a href="mailto:support@chargeshare.pk" className="text-emerald-600 underline font-medium">support@chargeshare.pk</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
