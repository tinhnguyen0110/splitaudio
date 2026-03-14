import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Music,
  History,
  CreditCard,
  User,
  BarChart3,
  Users,
  Monitor,
  LogOut,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useLogout } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const userNav = [
  { to: '/separate', icon: Music, labelKey: 'nav.separate' },
  { to: '/history', icon: History, labelKey: 'nav.history' },
  { to: '/credits', icon: CreditCard, labelKey: 'nav.credits' },
  { to: '/profile', icon: User, labelKey: 'nav.profile' },
];

const adminNav = [
  { to: '/admin/dashboard', icon: BarChart3, labelKey: 'nav.adminDashboard' },
  { to: '/admin/users', icon: Users, labelKey: 'nav.userManagement' },
  { to: '/admin/system', icon: Monitor, labelKey: 'nav.systemOverview' },
];

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        {/* Logo section */}
        <SheetHeader className="border-b px-5 py-5">
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Music className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-accent to-pink-500 bg-clip-text text-transparent">
              SplitAudio
            </span>
          </SheetTitle>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col py-4">
          {userNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 px-5 py-3 text-sm transition-colors',
                  isActive
                    ? 'bg-accent/10 text-accent after:absolute after:right-0 after:top-0 after:h-full after:w-[3px] after:bg-accent'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
              onClick={() => onOpenChange(false)}
            >
              <item.icon className="h-4 w-4" />
              {t(item.labelKey)}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              <Separator className="my-3" />
              <div className="px-5 pb-2 text-xs font-semibold uppercase text-muted-foreground">
                {t('nav.admin')}
              </div>
              {adminNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-3 px-5 py-3 text-sm transition-colors',
                      isActive
                        ? 'bg-accent/10 text-accent after:absolute after:right-0 after:top-0 after:h-full after:w-[3px] after:bg-accent'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                  onClick={() => onOpenChange(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User info section */}
        <div className="border-t px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
              {user?.display_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.display_name}</p>
              <p className="text-xs text-muted-foreground">
                {user?.credits ?? 0} {t('nav.credits').toLowerCase()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => {
                logout.mutate();
                onOpenChange(false);
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
