import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  DollarSign,
  Settings,
  Menu,
  X,
  LogOut,
  User,
  Wifi,
  WifiOff,
  PackageX,
  ChevronLeft,
  Pin,
  PinOff,
  Home,
  MoreHorizontal,
  Printer,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/use-theme';

const adminNavItems = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Inventory', icon: Package, page: 'Inventory' },
  { name: 'Print Labels', icon: Printer, page: 'PrintLabels' },
  { name: 'Orders', icon: ShoppingCart, page: 'Orders' },
  { name: 'Returns', icon: PackageX, page: 'Returns' },
  { name: 'Runs', icon: Truck, page: 'Runs' },
  { name: 'Financials', icon: DollarSign, page: 'Financials' },
  { name: 'Settings', icon: Settings, page: 'AdminSettings' },
];

const mobileTabItems = [
  { name: 'Home', icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Inventory', icon: Package, page: 'Inventory' },
  { name: 'Orders', icon: ShoppingCart, page: 'Orders' },
  { name: 'Runs', icon: Truck, page: 'Runs' },
  { name: 'More', icon: MoreHorizontal, page: null },
];

const moreMenuItems = [
  { name: 'Returns', icon: PackageX, page: 'Returns' },
  { name: 'Financials', icon: DollarSign, page: 'Financials' },
  { name: 'Print Labels', icon: Printer, page: 'PrintLabels' },
  { name: 'Settings', icon: Settings, page: 'AdminSettings' },
];

export default function Layout({ children, currentPageName }) {
  const { data: user } = useCurrentUser();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showMore, setShowMore] = useState(false);
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const runnerPages = ['RunnerHome', 'RunnerPickStore', 'RunnerPicking', 'RunnerLogin'];
  const isRunnerPage = runnerPages.includes(currentPageName);
  const storePages = ['StoreOrders', 'StoreLogin'];
  const isStorePage = storePages.includes(currentPageName);
  const publicPages = ['Login', 'RunnerLogin', 'StoreLogin'];
  const isPublicPage = publicPages.includes(currentPageName);

  if (isPublicPage) {
    return <>{children}</>;
  }

  // Store Owner Layout
  if (isStorePage) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50">
          <span className="font-semibold text-lg text-foreground">
            {user?.store_name || 'Store Portal'}
          </span>
          <div className="flex items-center gap-3">
            {isOnline ? (
              <div className="flex items-center gap-1.5 text-success text-sm font-medium">
                <Wifi className="w-4 h-4" />
                <span>Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-warning text-sm font-medium">
                <WifiOff className="w-4 h-4" />
                <span>Offline</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>
        <main className="p-4 lg:p-8 max-w-[1200px] mx-auto">
          {children}
        </main>
      </div>
    );
  }

  // Runner Layout
  if (isRunnerPage) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50">
          <Link to={createPageUrl('Dashboard')} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl text-foreground">MarketRunner</span>
          </Link>
          <div className="flex items-center gap-3">
            {isOnline ? (
              <div className="flex items-center gap-1.5 text-success text-sm font-medium">
                <Wifi className="w-4 h-4" />
                <span>Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-warning text-sm font-medium">
                <WifiOff className="w-4 h-4" />
                <span>Offline</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>
        <main className="pb-24">
          {children}
        </main>
      </div>
    );
  }

  // Admin Layout
  const sidebarExpanded = sidebarPinned || sidebarHover;

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-50 hidden lg:flex flex-col transition-all duration-300 ease-in-out",
          "bg-[hsl(224,15%,6%)] border-r border-border/50",
          sidebarExpanded ? "w-[280px]" : "w-16"
        )}
        onMouseEnter={() => !sidebarPinned && setSidebarHover(true)}
        onMouseLeave={() => !sidebarPinned && setSidebarHover(false)}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center h-16 px-4 border-b border-border/30",
          sidebarExpanded ? "justify-between" : "justify-center"
        )}>
          <Link to={createPageUrl('Dashboard')} className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4 text-primary-foreground" />
            </div>
            {sidebarExpanded && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-bold text-lg text-foreground whitespace-nowrap"
              >
                MarketRunner
              </motion.span>
            )}
          </Link>
          {sidebarExpanded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarPinned(!sidebarPinned)}
              className="text-muted-foreground hover:text-foreground shrink-0 h-8 w-8"
              aria-label={sidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
            >
              {sidebarPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {adminNavItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={cn(
                  "flex items-center gap-3 rounded-lg transition-all duration-200 relative group",
                  sidebarExpanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
                )}
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                {sidebarExpanded && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm font-medium whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
                {!sidebarExpanded && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border text-popover-foreground text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className={cn(
          "border-t border-border/30 p-3",
          sidebarExpanded ? "" : "flex justify-center"
        )}>
          {user && sidebarExpanded ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.full_name || user.email}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logout()}
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground h-9 w-9"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link to={createPageUrl('Dashboard')} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Truck className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">MarketRunner</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground h-8 w-8"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          {user && (
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </header>

      {/* Mobile Bottom Tabs */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 pb-safe" role="navigation" aria-label="Mobile navigation">
        <div className="flex items-center justify-around h-16 relative">
          {mobileTabItems.map((item) => {
            const isActive = item.page ? currentPageName === item.page : showMore;
            const isMore = item.page === null;

            if (isMore) {
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(!showMore)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors min-w-[44px]",
                    showMore ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-label="More options"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setShowMore(false)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors min-w-[44px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* More Menu */}
        <AnimatePresence>
          {showMore && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 bg-card border-t border-border p-3 grid grid-cols-4 gap-2 shadow-lg"
            >
              {moreMenuItems.map((item) => (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setShowMore(false)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg transition-colors min-h-[64px]",
                    currentPageName === item.page
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium text-center">{item.name}</span>
                </Link>
              ))}
              <button
                onClick={() => {
                  logout();
                  setShowMore(false);
                }}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg transition-colors text-destructive hover:bg-destructive/10 min-h-[64px]"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-[10px] font-medium">Logout</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main
        id="main-content"
        className={cn(
          "transition-all duration-300 ease-in-out",
          sidebarPinned ? "lg:pl-[280px]" : "lg:pl-16",
          "pb-20 lg:pb-0"
        )}
        role="main"
      >
        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
