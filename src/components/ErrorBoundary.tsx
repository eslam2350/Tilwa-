import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'حدث خطأ غير متوقع في المنصة.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('TILAWA ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#0A0D0C] text-[#F5F3EE] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full glass-gold rounded-2xl p-8 text-center space-y-4">
            <h1 className="text-2xl font-display font-bold text-[#C8A253]">
              عذرًا، واجهت منصة تلاوة عائقًا تقنيًا
            </h1>
            <p className="text-sm text-[#A9B2AE] leading-relaxed">
              تم تسجيل الخطأ لمعالجته. يمكنك إعادة تحميل الصفحة للمتابعة.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-[#F5F3EE] text-sm font-medium transition-colors"
            >
              إعادة تحميل المنصة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
