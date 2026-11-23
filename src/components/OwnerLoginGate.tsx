import React, { useState } from 'react';
import { ArrowRight, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import type { AppRoute } from '../types/tilawa';

interface OwnerLoginGateProps {
  navigate: (next: AppRoute) => void;
}

export const OwnerLoginGate: React.FC<OwnerLoginGateProps> = ({ navigate }) => {
  const { loginOwnerByEmail } = useDynamicConfig();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني الخاص بالمالك.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginOwnerByEmail(trimmed);
      if (!res.ok) {
        setErrorMsg(res.error || 'البريد الإلكتروني غير مصرح له بالدخول.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass-gold rounded-3xl p-6 sm:p-8 border border-[#C8A253]/30 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-[#0E6B4D]/25 border border-[#C8A253]/35 flex items-center justify-center text-[#C8A253]">
            <Lock className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'home' })}
            className="inline-flex items-center gap-1.5 text-xs text-[#A9B2AE] hover:text-[#F5F3EE] cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة للمنصة</span>
          </button>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-display font-bold text-[#F5F3EE]">
            بوابة التحقق الخاصة بالمالك
          </h1>
          <p className="text-xs text-[#A9B2AE] leading-relaxed">
            هذه المساحة مخصصة لإدارة المنصة وتطويرها تقنيًا. أدخل البريد الإلكتروني المعتمد للمتابعة.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <label htmlFor="owner-email-input" className="block text-xs font-medium text-[#F5F3EE]">
              البريد الإلكتروني
            </label>
            <input
              id="owner-email-input"
              type="email"
              dir="ltr"
              required
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="name@domain.com"
              className="w-full px-4 py-3 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE] placeholder:text-[#A9B2AE]/45 focus:border-[#C8A253] transition-colors"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/35 text-xs text-rose-200"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] disabled:opacity-60 text-sm font-semibold text-[#F5F3EE] shadow-lg transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-[#C8A253]" />
            <span>{submitting ? 'جارٍ التحقق...' : 'دخول المالك'}</span>
          </button>
        </form>

        <div className="pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-[#A9B2AE]">
          <ShieldCheck className="w-4 h-4 text-[#C8A253] shrink-0" />
          <span>الجلسة محمية بتوقيع رقمي مشفر من الخادم ولا يتم إنشاء أي حسابات عامة.</span>
        </div>
      </div>
    </main>
  );
};
