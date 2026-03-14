import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Menu, Coins, Sun, Moon, Globe, LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { useLogout } from '@/hooks/use-auth';
import { useBalance } from '@/hooks/use-credits';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function usePageTitle() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const titles: Record<string, string> = {
    '/separate': t('nav.separate'),
    '/history': t('nav.history'),
    '/credits': t('nav.credits'),
    '/profile': t('nav.profile'),
    '/admin/dashboard': t('nav.adminDashboard'),
    '/admin/users': t('nav.userManagement'),
    '/admin/system': t('nav.systemOverview'),
  };

  return titles[pathname] ?? '';
}

interface TopbarProps {
  onToggleMobile: () => void;
}

export default function Topbar({ onToggleMobile }: TopbarProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { theme, toggleTheme } = useThemeStore();
  const logout = useLogout();
  const pageTitle = usePageTitle();
  const { data: balance } = useBalance();

  const isAdmin = user?.role === 'admin';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/80 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onToggleMobile}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="text-base font-semibold">{pageTitle}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Credits badge - only for non-admin */}
        {!isAdmin && (
          <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            <Coins className="h-4 w-4" />
            <span>{balance?.balance ?? user?.credits ?? 0}</span>
            <span className="hidden sm:inline">{t('nav.credits').toLowerCase()}</span>
          </div>
        )}

        {/* Theme toggle */}
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* Language dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Globe className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>
              English
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => i18n.changeLanguage('vi')}>
              Tiếng Việt
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {user ? getInitials(user.display_name) : '?'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <User className="mr-2 h-4 w-4" />
                {t('nav.profile')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logout.mutate()}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('nav.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
