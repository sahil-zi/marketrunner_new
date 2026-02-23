import { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { motion, AnimatePresence } from 'framer-motion';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background" role="status" aria-live="polite">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" aria-hidden="true"></div>
    <span className="sr-only">Loading...</span>
  </div>
);

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </Layout>
  : <Suspense fallback={<PageLoader />}>{children}</Suspense>;

const AnimatedPage = ({ children }) => (
  <motion.div {...pageTransition}>
    {children}
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <AnimatedPage><MainPage /></AnimatedPage>
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <AnimatedPage><Page /></AnimatedPage>
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return <PageLoader />;
  }

  // Allow access to Login, RunnerLogin, and StoreLogin without auth
  const publicPaths = ['/Login', '/RunnerLogin', '/StoreLogin'];
  const isPublicPath = publicPaths.some(p => location.pathname.startsWith(p));

  if (!isAuthenticated && !isPublicPath) {
    return <Navigate to="/Login" replace />;
  }

  const { user } = useAuth();

  // Role-based redirect: store owners can only access store pages
  const storePages = ['/StoreOrders', '/StoreLogin'];
  const isStorePage = storePages.some(p => location.pathname.startsWith(p));
  if (isAuthenticated && user?.role === 'store_owner' && !isStorePage) {
    return <Navigate to="/StoreOrders" replace />;
  }

  // Role-based redirect: runners (role 'user') can only access runner pages
  const runnerPages = ['/RunnerHome', '/RunnerPickStore', '/RunnerPicking', '/RunnerLogin'];
  const isRunnerPage = runnerPages.some(p => location.pathname.startsWith(p));
  if (isAuthenticated && user?.role === 'user' && !isRunnerPage && !isPublicPath) {
    return <Navigate to="/RunnerHome" replace />;
  }

  return <AnimatedRoutes />;
};


function App() {

  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
