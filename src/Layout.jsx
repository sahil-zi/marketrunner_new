import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
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
  WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Inventory', icon: Package, page: 'Inventory' },
  { name: 'Orders', icon: ShoppingCart, page: 'Orders' },
  { name: 'Runs', icon: Truck, page: 'Runs' },
  { name: 'Financials', icon: DollarSign, page: 'Financials' },
  { name: 'Settings', icon: Settings, page: 'AdminSettings' },
];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const location = useLocation();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        // Not logged in
      }
    };
    loadUser();
  }, []);

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

  // Runner pages - minimal layout
  const runnerPages = ['RunnerHome', 'RunnerPickStore', 'RunnerPicking', 'RunnerLogin'];
  const isRunnerPage = runnerPages.includes(currentPageName);

  // Public pages - no layout
  const publicPages = ['Login', 'RunnerLogin'];
  const isPublicPage = publicPages.includes(currentPageName);

  if (isPublicPage) {
    return <>{children}</>;
  }

  // Runner Layout
  if (isRunnerPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">MarketRunner</span>
          </div>
          <div className="flex items-center gap-3">
            {isOnline ? (
              <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <Wifi className="w-4 h-4" />
                <span>Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
                <WifiOff className="w-4 h-4" />
                <span>Offline</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => base44.auth.logout()}
              className="text-gray-500"
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
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900">MarketRunner</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-72 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">MarketRunner</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="px-4 space-y-1">
          {adminNavItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  isActive 
                    ? "bg-teal-50 text-teal-700" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5",
                  isActive ? "text-teal-600" : "text-gray-400"
                )} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          {user && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{user.full_name || user.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => base44.auth.logout()}
                className="text-gray-400 hover:text-gray-600"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-72">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}