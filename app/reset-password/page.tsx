'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Zap, Lock, Eye, EyeOff } from 'lucide-react';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Set Referrer policy
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);

    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      // Remove token from address bar immediately
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else {
      setStatus('error');
      setErrorMessage('Reset token is missing or has already been used.');
    }
  }, [searchParams]);

  // Validation rules
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Password reset failed. The link may have expired.');
      }

      setStatus('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during password reset.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F4F6] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Zap className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-[#0F172A] tracking-tight">ChargeShare</span>
        </div>

        {status === 'form' && (
          <div>
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-[#0F172A] mb-1">Set New Password</h1>
              <p className="text-sm text-slate-500">Choose a secure password for your account</p>
            </div>

            {errorMessage ? (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-1.5">
                <p className="font-semibold text-slate-600 mb-1">Password requirements:</p>
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className="text-sm">{hasMinLength ? '✓' : '○'}</span> At least 8 characters
                </div>
                <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className="text-sm">{hasUppercase ? '✓' : '○'}</span> At least one uppercase letter
                </div>
                <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className="text-sm">{hasLowercase ? '✓' : '○'}</span> At least one lowercase letter
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className="text-sm">{hasNumber ? '✓' : '○'}</span> At least one number
                </div>
                {confirmPassword ? (
                  <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-700' : 'text-red-500'}`}>
                    <span className="text-sm">{passwordsMatch ? '✓' : '✕'}</span> Passwords match
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="w-full py-3 px-4 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Reset Password</span>
              </button>
            </form>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-xl font-bold text-[#0F172A] mb-2">Password Reset Successful!</h1>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Your password has been securely updated. You can now open the ChargeShare mobile app and sign in with your new password.
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
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10" />
            </div>
            <h1 className="text-xl font-bold text-[#0F172A] mb-2">Invalid or Expired Link</h1>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {errorMessage || 'This password reset link is invalid or has expired. Please open the ChargeShare mobile app to request a new link.'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F1F4F6] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
