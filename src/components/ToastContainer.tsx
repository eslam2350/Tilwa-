import React from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useAppData();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-20 left-4 right-4 sm:right-auto sm:left-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl glass-panel shadow-xl border ${
            t.tone === 'error'
              ? 'border-rose-500/40 text-rose-100'
              : t.tone === 'success'
              ? 'border-[#0E6B4D]/60 text-[#F5F3EE]'
              : 'border-[#C8A253]/40 text-[#F5F3EE]'
          }`}
        >
          {t.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#178A64] shrink-0" />
          ) : t.tone === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-[#C8A253] shrink-0" />
          )}
          <span className="text-xs sm:text-sm flex-1">{t.text}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="إغلاق التنبيه"
            className="text-[#A9B2AE] hover:text-white p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
