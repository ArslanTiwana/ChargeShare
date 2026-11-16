'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Head from 'next/head';
import { CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Referrer policy
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);

    const tokenParam = searchParams.get('token');

    // Immediately remove token from URL without triggering a navigation
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!tokenParam) {
      setStatus('error');
      setErrorMessage('Verification token is missing or has already been used.');
      return;
    }

    // Call POST /api/v1/auth/verify-email without logging the token
    fetch('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenParam }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || 'Verification failed. The link may have expired.');
        }
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(err.message || 'Verification failed. The link may have expired.');
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#F1F4F6] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 text-center">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Zap className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-[#0F172A] tracking-tight">ChargeShare</span>
        </div>

        {status === 'loading' && (
          <div className="py-8">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-[#0F172A] mb-1">Verifying your email...</h1>
            <p className="text-sm text-slate-500">Please wait a moment while we confirm your account.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-xl font-bold text-[#0F172A] mb-2">Email Verified Successfully!</h1>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Your email has been confirmed. You can now use all features of the ChargeShare mobile app.
            </p>
            <a
              href="chargeshare://"
              className="inline-block w-full py-3 px-4 bg-[#0F172A] hover:bg-slate-800 text-white font-medium rounded-xl transition-colors shadow-sm"
            >
              Open ChargeShare App
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10" />
            </div>
            <h1 className="text-xl font-bold text-[#0F172A] mb-2">Verification Link Expired</h1>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {errorMessage || 'This link is invalid or has expired. Please open the ChargeShare mobile app to request a new verification email.'}
            </p>
            <a
              href="chargeshare://"
              className="inline-block w-full py-3 px-4 bg-[#0F172A] hover:bg-slate-800 text-white font-medium rounded-xl transition-colors shadow-sm"
            >
              Return to Mobile App
            </a>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-6">
        ChargeShare Pakistan • EV Charging Marketplace
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F1F4F6] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
