import { useEffect, useRef, useState, useCallback } from 'react';
import { Outlet, useSearchParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth-store';

// ─── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '12.39', unit: 'dB SDR', labelKey: 'landing.statQuality' },
  { value: '24.6x', unit: 'realtime', labelKey: 'landing.statSpeed' },
  { value: '99.7%', unit: 'uptime', labelKey: 'landing.statUptime' },
  { value: '50k+', unit: 'tracks', labelKey: 'landing.statTracks' },
];

const FEATURES = [
  { icon: '🎯', titleKey: 'landing.feat1Title', descKey: 'landing.feat1Desc', tag: 'SDX23 Winner' },
  { icon: '⚡', titleKey: 'landing.feat2Title', descKey: 'landing.feat2Desc', tag: '24.6x RT' },
  { icon: '🎛', titleKey: 'landing.feat3Title', descKey: 'landing.feat3Desc', tag: '2 & 4 stems' },
  { icon: '💳', titleKey: 'landing.feat4Title', descKey: 'landing.feat4Desc', tag: 'Auto refund' },
  { icon: '🔗', titleKey: 'landing.feat5Title', descKey: 'landing.feat5Desc', tag: 'Developer friendly' },
  { icon: '🐳', titleKey: 'landing.feat6Title', descKey: 'landing.feat6Desc', tag: 'Open architecture' },
];

const STEPS = [
  { num: '01', titleKey: 'landing.step1Title', descKey: 'landing.step1Desc', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.08)' },
  { num: '02', titleKey: 'landing.step2Title', descKey: 'landing.step2Desc', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)' },
  { num: '03', titleKey: 'landing.step3Title', descKey: 'landing.step3Desc', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.08)' },
];

const PLANS = [
  { id: 'free', nameKey: 'landing.planFree', price: '0', period: 'forever', credits: 10, badge: null, featuresKey: 'landing.planFreeFeatures', ctaKey: 'landing.planFreeCta', popular: false },
  { id: 'pro', nameKey: 'landing.planPro', price: '199k', period: '/mo', credits: 100, badge: 'Popular', featuresKey: 'landing.planProFeatures', ctaKey: 'landing.planProCta', popular: true },
  { id: 'studio', nameKey: 'landing.planStudio', price: '499k', period: '/mo', credits: 500, badge: 'Best value', featuresKey: 'landing.planStudioFeatures', ctaKey: 'landing.planStudioCta', popular: false },
];

const TESTIMONIALS = [
  { name: 'Minh Tu', role: 'Music Producer, Saigon Beats', textKey: 'landing.test1', avatar: 'MT' },
  { name: 'David Chen', role: 'DJ & Remixer', textKey: 'landing.test2', avatar: 'DC' },
  { name: 'Ha Linh', role: 'Vocal Coach', textKey: 'landing.test3', avatar: 'HL' },
];

// ─── Animated Waveform Background ────────────────────────────────────────────

function WaveformBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf: number;
    const resize = () => {
      c.width = c.offsetWidth * 2;
      c.height = c.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    resize();
    window.addEventListener('resize', resize);
    let t = 0;
    const draw = () => {
      const w = c.offsetWidth;
      const h = c.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      for (let wave = 0; wave < 3; wave++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(99, 102, 241, ${0.06 - wave * 0.015})`;
        ctx.lineWidth = 1.5;
        for (let x = 0; x <= w; x += 3) {
          const y = h / 2 + Math.sin(x * 0.008 + t + wave * 1.2) * (40 + wave * 20) * Math.sin(x * 0.002 + t * 0.3);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      t += 0.012;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ─── Floating Particles ──────────────────────────────────────────────────────

function Particles() {
  const particles = useRef(
    Array.from({ length: 20 }, () => ({
      w: 2 + Math.random() * 3,
      h: 2 + Math.random() * 3,
      opacity: 0.15 + Math.random() * 0.2,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 5,
    }))
  ).current;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.w,
            height: p.h,
            background: `rgba(139, 92, 246, ${p.opacity})`,
            left: p.left,
            top: p.top,
            animation: `float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Waveform Logo ───────────────────────────────────────────────────────────

function WaveformLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const barW = size === 'sm' ? 3 : 3;
  const gap = size === 'sm' ? 2 : 2;
  return (
    <div className="flex items-center" style={{ gap, height: size === 'sm' ? 24 : 28 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            width: barW,
            borderRadius: 2,
            background: 'linear-gradient(180deg, #8b5cf6, #6366f1)',
            animation: `waveBar 1.2s ease ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN LAYOUT
// ═════════════════════════════════════════════════════════════════════════════

export default function AuthLayout() {
  const { t, i18n } = useTranslation();
  const [, setSearchParams] = useSearchParams();
  const [scrollY, setScrollY] = useState(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    document.title = 'SplitAudio - AI Audio Separation';
  }, [t]);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const openAuth = useCallback((mode: 'login' | 'register') => {
    setSearchParams({ tab: mode });
  }, [setSearchParams]);

  // If already logged in, redirect to dashboard (after all hooks)
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const planFeatures = {
    free: [
      t('landing.planFreeF1'), t('landing.planFreeF2'), t('landing.planFreeF3'),
      t('landing.planFreeF4'), t('landing.planFreeF5'), t('landing.planFreeF6'),
    ],
    pro: [
      t('landing.planProF1'), t('landing.planProF2'), t('landing.planProF3'),
      t('landing.planProF4'), t('landing.planProF5'), t('landing.planProF6'), t('landing.planProF7'),
    ],
    studio: [
      t('landing.planStudioF1'), t('landing.planStudioF2'), t('landing.planStudioF3'),
      t('landing.planStudioF4'), t('landing.planStudioF5'), t('landing.planStudioF6'),
      t('landing.planStudioF7'), t('landing.planStudioF8'),
    ],
  };

  return (
    <div className="overflow-x-hidden" style={{ background: '#050508', color: '#e2e0ec', fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif" }}>

      {/* ─── Navbar ──────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 md:px-10 h-16 transition-all duration-300"
        style={{
          background: scrollY > 50 ? 'rgba(5, 5, 8, 0.9)' : 'transparent',
          backdropFilter: scrollY > 50 ? 'blur(16px)' : 'none',
          borderBottom: scrollY > 50 ? '1px solid #12121e' : '1px solid transparent',
        }}
      >
        <div className="flex items-center gap-2.5">
          <WaveformLogo />
          <span className="text-lg font-extrabold" style={{ letterSpacing: -0.5 }}>
            <span style={{ color: '#e2e0ec' }}>Split</span>
            <span style={{ color: '#8b5cf6' }}>Audio</span>
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <span className="landing-nav-link" onClick={() => scrollTo('features')}>{t('landing.navFeatures')}</span>
          <span className="landing-nav-link" onClick={() => scrollTo('how-it-works')}>{t('landing.navHowItWorks')}</span>
          <span className="landing-nav-link" onClick={() => scrollTo('pricing')}>{t('landing.navPricing')}</span>

          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[#8a879a] hover:text-[#c4b5fd]">
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>English</DropdownMenuItem>
              <DropdownMenuItem onClick={() => i18n.changeLanguage('vi')}>Tiếng Việt</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex gap-2.5">
            <button
              onClick={() => openAuth('login')}
              className="px-5 py-2 rounded-[10px] border border-[#2a2840] bg-transparent text-[#c4b5fd] cursor-pointer text-[13px] font-semibold transition-all duration-200 hover:border-[#4c1d95]"
            >
              {t('auth.login')}
            </button>
            <button
              onClick={() => openAuth('register')}
              className="px-6 py-2 rounded-[10px] border-none text-white cursor-pointer text-[13px] font-semibold transition-all duration-200 relative z-[1]"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
            >
              {t('landing.registerFree')}
            </button>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden bg-transparent border-none cursor-pointer p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen
            ? <X className="h-6 w-6" style={{ color: '#c4b5fd' }} />
            : <Menu className="h-6 w-6" style={{ color: '#c4b5fd' }} />
          }
        </button>
      </nav>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[99] pt-16 md:hidden"
          style={{ background: 'rgba(5, 5, 8, 0.97)', backdropFilter: 'blur(16px)' }}
        >
          <div className="flex flex-col items-center gap-6 pt-8">
            <span className="landing-nav-link text-lg" onClick={() => { scrollTo('features'); setMobileMenuOpen(false); }}>{t('landing.navFeatures')}</span>
            <span className="landing-nav-link text-lg" onClick={() => { scrollTo('how-it-works'); setMobileMenuOpen(false); }}>{t('landing.navHowItWorks')}</span>
            <span className="landing-nav-link text-lg" onClick={() => { scrollTo('pricing'); setMobileMenuOpen(false); }}>{t('landing.navPricing')}</span>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { i18n.changeLanguage('en'); }}
                className="px-4 py-2 rounded-lg border border-[#2a2840] bg-transparent text-[#8a879a] cursor-pointer text-sm"
                style={{ fontFamily: 'inherit' }}
              >
                EN
              </button>
              <button
                onClick={() => { i18n.changeLanguage('vi'); }}
                className="px-4 py-2 rounded-lg border border-[#2a2840] bg-transparent text-[#8a879a] cursor-pointer text-sm"
                style={{ fontFamily: 'inherit' }}
              >
                VI
              </button>
            </div>

            <div className="flex flex-col gap-3 w-full px-8 mt-4">
              <button
                onClick={() => { openAuth('login'); setMobileMenuOpen(false); }}
                className="w-full py-3 rounded-xl border border-[#2a2840] bg-transparent text-[#c4b5fd] cursor-pointer text-base font-semibold"
                style={{ fontFamily: 'inherit' }}
              >
                {t('auth.login')}
              </button>
              <button
                onClick={() => { openAuth('register'); setMobileMenuOpen(false); }}
                className="w-full py-3 rounded-xl border-none text-white cursor-pointer text-base font-semibold"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', fontFamily: 'inherit' }}
              >
                {t('landing.registerFree')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-4 md:px-10 pt-[100px] md:pt-[120px] pb-12 md:pb-20 overflow-hidden">
        <WaveformBg />
        <Particles />
        {/* Gradient orbs */}
        <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 70%)' }} />

        <div className="text-center max-w-[900px] relative z-[1]">
          <div style={{ animation: 'fadeUp 0.8s ease 0.1s both' }}>
            <span className="inline-block px-4 py-1.5 rounded-[20px] text-xs font-semibold mb-7" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', color: '#a78bfa', letterSpacing: 0.5 }}>
              {t('landing.heroTagline')}
            </span>
          </div>

          <h1 className="font-black leading-[1.05] mb-6" style={{ fontSize: 'clamp(42px, 7vw, 80px)', letterSpacing: -2, animation: 'fadeUp 0.8s ease 0.2s both' }}>
            <span style={{ color: '#e2e0ec' }}>{t('landing.heroTitle1')} </span>
            <br />
            <span className="italic font-normal" style={{
              fontFamily: "'Instrument Serif', serif",
              background: 'linear-gradient(135deg, #a78bfa, #818cf8, #c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '200% 200%',
              animation: 'gradientShift 4s ease infinite',
            }}>
              {t('landing.heroTitle2')}
            </span>
          </h1>

          <p className="text-lg leading-relaxed max-w-[600px] mx-auto mb-10 font-normal" style={{ color: '#6b6580', animation: 'fadeUp 0.8s ease 0.35s both' }}>
            {t('landing.heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3.5 justify-center" style={{ animation: 'fadeUp 0.8s ease 0.5s both' }}>
            <button
              onClick={() => openAuth('register')}
              className="px-7 sm:px-9 py-3.5 sm:py-4 rounded-[14px] border-none text-white cursor-pointer text-base font-bold transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', boxShadow: '0 8px 40px rgba(99, 102, 241, 0.3)' }}
            >
              {t('landing.getStarted')}
            </button>
            <button
              onClick={() => scrollTo('how-it-works')}
              className="px-6 sm:px-8 py-3.5 sm:py-4 rounded-[14px] cursor-pointer text-base font-medium"
              style={{ border: '1px solid #2a2840', background: 'rgba(14, 14, 22, 0.6)', color: '#a09cb2', backdropFilter: 'blur(8px)' }}
            >
              {t('landing.watchDemo')}
            </button>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-12 mt-12 sm:mt-[72px]" style={{ animation: 'fadeUp 0.8s ease 0.65s both' }}>
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <div className="font-mono text-[28px] font-bold" style={{ color: '#c4b5fd' }}>
                  {s.value}<span className="text-sm font-normal ml-1" style={{ color: '#6b6580' }}>{s.unit}</span>
                </div>
                <div className="text-xs mt-1" style={{ color: '#4a4660' }}>{t(s.labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="py-16 md:py-[120px] px-4 md:px-10 max-w-[1200px] mx-auto">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-2xl md:text-[40px] font-extrabold mb-4" style={{ letterSpacing: -1 }}>
            {t('landing.featuresTitle')}{' '}
            <span className="italic font-normal" style={{ fontFamily: "'Instrument Serif', serif", color: '#a78bfa' }}>SplitAudio</span>?
          </h2>
          <p className="text-base max-w-[500px] mx-auto" style={{ color: '#6b6580' }}>{t('landing.featuresSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card" style={{ animation: `fadeUp 0.6s ease ${0.1 + i * 0.08}s both` }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[32px]">{f.icon}</span>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-md font-mono" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa' }}>{f.tag}</span>
              </div>
              <h3 className="text-lg font-bold mb-2.5" style={{ color: '#e2e0ec' }}>{t(f.titleKey)}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#6b6580' }}>{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 md:py-[120px] px-4 md:px-10" style={{ background: 'linear-gradient(180deg, #050508 0%, #08070e 50%, #050508 100%)' }}>
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-2xl md:text-[40px] font-extrabold mb-4" style={{ letterSpacing: -1 }}>
              {t('landing.howItWorksTitle')}{' '}
              <span className="italic font-normal" style={{ fontFamily: "'Instrument Serif', serif", color: '#a78bfa' }}>{t('landing.howItWorksHighlight')}</span>
            </h2>
            <p className="text-base" style={{ color: '#6b6580' }}>{t('landing.howItWorksSubtitle')}</p>
          </div>

          <div className="flex flex-col gap-8">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className="flex gap-4 md:gap-6 items-start px-5 md:px-9 py-6 md:py-8 rounded-[20px]"
                style={{ background: 'rgba(14, 14, 22, 0.4)', border: '1px solid #14142a', animation: `fadeUp 0.6s ease ${0.1 + i * 0.12}s both` }}
              >
                <div
                  className="w-12 h-12 rounded-[14px] flex items-center justify-center text-lg font-bold font-mono shrink-0"
                  style={{ background: s.bg, color: s.color }}
                >
                  {s.num}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2" style={{ color: '#e2e0ec' }}>{t(s.titleKey)}</h3>
                  <p className="text-[15px] leading-relaxed" style={{ color: '#6b6580' }}>{t(s.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-16 md:py-[120px] px-4 md:px-10 max-w-[1200px] mx-auto">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-2xl md:text-[40px] font-extrabold mb-4" style={{ letterSpacing: -1 }}>
            {t('landing.pricingTitle')}{' '}
            <span className="italic font-normal" style={{ fontFamily: "'Instrument Serif', serif", color: '#a78bfa' }}>{t('landing.pricingHighlight')}</span>
          </h2>
          <p className="text-base mb-6" style={{ color: '#6b6580' }}>{t('landing.pricingSubtitle')}</p>
          {/* Billing toggle */}
          <div className="inline-flex p-1 rounded-xl" style={{ background: '#0e0e16', border: '1px solid #1e1e32' }}>
            {(['monthly', 'yearly'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBillingCycle(b)}
                className="px-5 py-2 rounded-[9px] border-none cursor-pointer text-[13px] font-semibold transition-all duration-200"
                style={{
                  background: billingCycle === b ? '#1e1b4b' : 'transparent',
                  color: billingCycle === b ? '#c4b5fd' : '#6b6580',
                  fontFamily: 'inherit',
                }}
              >
                {t(b === 'monthly' ? 'landing.billingMonthly' : 'landing.billingYearly')}
                {b === 'yearly' && <span className="ml-1.5 text-[10px] font-bold" style={{ color: '#10b981' }}>-20%</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {PLANS.map((p, i) => {
            const features = planFeatures[p.id as keyof typeof planFeatures];
            return (
              <div key={p.id} className={`pricing-card ${p.popular ? 'popular' : ''}`} style={{ animation: `fadeUp 0.6s ease ${0.1 + i * 0.1}s both` }}>
                {p.badge && (
                  <div className="absolute top-[-1px] left-0 right-0 h-[3px] rounded-t-[20px]" style={{ background: 'linear-gradient(90deg, #7c3aed, #6366f1, #8b5cf6)' }} />
                )}
                {p.badge && (
                  <span className="inline-block mb-4 px-3 py-1 rounded-md text-[11px] font-bold" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>{p.badge}</span>
                )}
                <h3 className="text-[22px] font-bold mb-1" style={{ color: '#e2e0ec' }}>{t(p.nameKey)}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-mono text-[42px] font-extrabold" style={{ color: '#e2e0ec' }}>
                    {billingCycle === 'yearly' && p.price !== '0'
                      ? Math.round(parseInt(p.price) * 0.8) + 'k'
                      : p.price === '0' ? t('landing.priceFree') : p.price}
                  </span>
                  {p.price !== '0' && <span className="text-sm" style={{ color: '#6b6580' }}>VND{p.period}</span>}
                </div>
                <p className="text-[13px] font-semibold mb-6" style={{ color: '#8b5cf6' }}>
                  {p.credits} credits{p.price !== '0' ? `/${t('landing.billingMonthly').toLowerCase()}` : ''}
                </p>

                <div className="flex flex-col gap-3 mb-7">
                  {features.map((f, fi) => (
                    <div key={fi} className="flex items-start gap-2.5 text-[13px]" style={{ color: '#8a879a' }}>
                      <span className="shrink-0 mt-0.5 text-xs" style={{ color: '#8b5cf6' }}>✓</span>
                      {f}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => openAuth('register')}
                  className="w-full py-3.5 rounded-xl cursor-pointer text-sm font-bold transition-all duration-300"
                  style={{
                    border: p.popular ? 'none' : '1px solid #2a2840',
                    background: p.popular ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : 'transparent',
                    color: p.popular ? '#fff' : '#a09cb2',
                    boxShadow: p.popular ? '0 8px 32px rgba(99, 102, 241, 0.25)' : 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  {t(p.ctaKey)}
                </button>
              </div>
            );
          })}
        </div>

        {/* Credit explanation */}
        <div className="mt-8 md:mt-12 px-5 md:px-9 py-5 md:py-7 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-8" style={{ background: 'rgba(14, 14, 22, 0.5)', border: '1px solid #18182a' }}>
          {[
            { labelKey: 'landing.creditRule1Label', costKey: 'landing.creditRule1Cost', icon: '🎵' },
            { labelKey: 'landing.creditRule2Label', costKey: 'landing.creditRule2Cost', icon: '🎶' },
            { labelKey: 'landing.creditRule3Label', costKey: 'landing.creditRule3Cost', icon: '⏱' },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-3.5">
              <span className="text-2xl">{c.icon}</span>
              <div>
                <div className="text-sm font-semibold" style={{ color: '#e2e0ec' }}>{t(c.labelKey)}</div>
                <div className="text-xs" style={{ color: '#6b6580' }}>{t(c.costKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Testimonials ────────────────────────────────────────────────── */}
      <section className="py-16 md:py-[100px] px-4 md:px-10" style={{ background: 'linear-gradient(180deg, #050508 0%, #08070e 100%)' }}>
        <div className="max-w-[1000px] mx-auto">
          <h2 className="text-2xl md:text-[32px] font-extrabold text-center mb-8 md:mb-12" style={{ letterSpacing: -0.5 }}>
            {t('landing.testimonialsTitle')}{' '}
            <span className="italic font-normal" style={{ fontFamily: "'Instrument Serif', serif", color: '#a78bfa' }}>producers</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TESTIMONIALS.map((tm, i) => (
              <div key={i} className="testimonial-card" style={{ animation: `fadeUp 0.6s ease ${0.1 + i * 0.1}s both` }}>
                <p className="text-sm leading-relaxed mb-5 italic" style={{ color: '#8a879a' }}>"{t(tm.textKey)}"</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', color: '#c4b5fd' }}
                  >
                    {tm.avatar}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: '#e2e0ec' }}>{tm.name}</div>
                    <div className="text-[11px]" style={{ color: '#4a4660' }}>{tm.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-[100px] px-4 md:px-10 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, transparent 70%)' }} />
        <div className="relative z-[1]">
          <h2 className="text-2xl md:text-[44px] font-extrabold mb-4" style={{ letterSpacing: -1 }}>
            {t('landing.ctaTitle')}{' '}
            <span className="italic font-normal" style={{ fontFamily: "'Instrument Serif', serif", color: '#a78bfa' }}>{t('landing.ctaHighlight')}</span>?
          </h2>
          <p className="text-base mb-9" style={{ color: '#6b6580' }}>{t('landing.ctaSubtitle')}</p>
          <button
            onClick={() => openAuth('register')}
            className="px-8 md:px-12 py-4 md:py-[18px] rounded-2xl border-none text-white cursor-pointer text-base md:text-lg font-bold"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', boxShadow: '0 12px 48px rgba(99, 102, 241, 0.35)', fontFamily: 'inherit' }}
          >
            {t('landing.ctaButton')}
          </button>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <footer className="px-4 md:px-10 pt-8 md:pt-12 pb-6 md:pb-8" style={{ borderTop: '1px solid #12121e' }}>
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-center text-center sm:text-left">
          <div>
            <span className="text-base font-extrabold">
              <span style={{ color: '#e2e0ec' }}>Split</span><span style={{ color: '#8b5cf6' }}>Audio</span>
            </span>
            <p className="text-xs mt-1.5" style={{ color: '#3a384a' }}>Powered by BS-RoFormer & Demucs v4</p>
          </div>
          <div className="flex gap-6">
            {['API Docs', 'GitHub', 'Terms', 'Privacy'].map((l) => (
              <span key={l} className="text-xs cursor-pointer transition-colors duration-200 hover:text-[#6b6580]" style={{ color: '#4a4660' }}>{l}</span>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: '#2a2840' }}>© 2025 SplitAudio</p>
        </div>
      </footer>

      {/* ─── Auth Modal (rendered by Outlet → AuthPage) ──────────────── */}
      <Outlet />
    </div>
  );
}
