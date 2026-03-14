import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './sidebar';
import Topbar from './topbar';
import MobileNav from './mobile-nav';

export default function RootLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();
  const { pathname } = useLocation();

  useEffect(() => {
    const titles: Record<string, string> = {
      '/dashboard': t('dashboard.title'),
      '/separate': t('separation.title'),
      '/history': t('history.title'),
      '/credits': t('credits.title'),
      '/profile': t('profile.title'),
      '/admin/dashboard': t('admin.dashboard'),
      '/admin/users': t('admin.users'),
      '/admin/system': t('admin.system'),
      '/admin/tracing': t('admin.tracing'),
    };
    const pageTitle = titles[pathname];
    document.title = pageTitle ? `SplitAudio - ${pageTitle}` : 'SplitAudio';
  }, [pathname, t]);

  return (
    <div className="flex h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex">
        <Sidebar />
      </aside>

      {/* Mobile nav */}
      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onToggleMobile={() => setMobileOpen(true)} />
        <main id="main-content" className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
