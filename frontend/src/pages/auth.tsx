import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoginForm from '@/components/auth/login-form';
import RegisterForm from '@/components/auth/register-form';

export default function AuthPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const [dismissed, setDismissed] = useState(false);

  // Don't auto-show login modal — landing page is shown by default
  // Modal only appears when user clicks login/register buttons (sets ?tab=login|register)

  // Reset dismissed when tab changes via URL (e.g. navbar buttons)
  useEffect(() => {
    if (tab === 'login' || tab === 'register') {
      setDismissed(false);
    }
  }, [tab]);

  // Don't show modal if dismissed or no valid tab
  if (dismissed || (tab !== 'login' && tab !== 'register')) {
    return null;
  }

  const isLogin = tab === 'login';

  const close = () => {
    setDismissed(true);
    setSearchParams({}, { replace: true });
  };

  return (
    <div
      className="auth-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="auth-card">
        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-xl leading-none hover:opacity-80"
          style={{ color: '#4a4660' }}
        >
          ✕
        </button>

        {/* Waveform logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-0.5 mb-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: 12 + Math.sin(i) * 8,
                  borderRadius: 2,
                  background: 'linear-gradient(180deg, #8b5cf6, #6366f1)',
                }}
              />
            ))}
          </div>
          <h2 className="text-2xl font-extrabold mb-1.5" style={{ color: '#e2e0ec' }}>
            {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h2>
          <p className="text-[13px]" style={{ color: '#6b6580' }}>
            {isLogin ? t('auth.subtitle') : t('landing.registerSubtitle', { defaultValue: 'Get 10 free credits instantly' })}
          </p>
        </div>

        {/* Auth form */}
        <div className="space-y-4">
          {isLogin ? <LoginForm /> : <RegisterForm />}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3.5 my-6">
          <div className="flex-1 h-px" style={{ background: '#1e1e32' }} />
          <span className="text-[11px]" style={{ color: '#3a384a' }}>{t('landing.or', { defaultValue: 'or' })}</span>
          <div className="flex-1 h-px" style={{ background: '#1e1e32' }} />
        </div>

        {/* OAuth buttons */}
        <div className="flex gap-2.5">
          {[
            { label: 'Google', icon: 'G' },
            { label: 'GitHub', icon: '⌘' },
          ].map((o) => (
            <button
              key={o.label}
              className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-[13px] font-medium transition-all duration-200 hover:border-[#2e2456]"
              style={{
                border: '1px solid #1e1e32',
                background: '#1a1a28',
                color: '#8a879a',
                fontFamily: 'inherit',
              }}
            >
              <span className="text-base">{o.icon}</span> {o.label}
            </button>
          ))}
        </div>

        {/* Switch mode — only shown when LoginForm/RegisterForm don't have their own links visible */}
      </div>
    </div>
  );
}
