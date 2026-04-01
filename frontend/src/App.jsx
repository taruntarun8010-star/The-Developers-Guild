import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, usePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import ChatbotWidget from './components/ChatbotWidget';
import { useAuthStore } from './store/authStore';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Events = lazy(() => import('./pages/Events'));
const Projects = lazy(() => import('./pages/Projects'));
const Team = lazy(() => import('./pages/Team'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const LoginOtp = lazy(() => import('./pages/LoginOtp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Register = lazy(() => import('./pages/Register'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const About = lazy(() => import('./pages/About'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const TeamInviteResponse = lazy(() => import('./pages/TeamInviteResponse'));

const RouteLoader = () => (
  <div style={{ minHeight: 'calc(100vh - 64px)', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
    Loading...
  </div>
);

const PageTransition = ({ children }) => (
  <TransitionFrame>
    {children}
  </TransitionFrame>
);

const TransitionFrame = ({ children }) => {
  const [isPresent, safeToRemove] = usePresence();

  useEffect(() => {
    if (!isPresent) {
      const timeout = setTimeout(safeToRemove, 280);
      return () => clearTimeout(timeout);
    }
  }, [isPresent, safeToRemove]);

  return (
    <div
      style={{
        opacity: isPresent ? 1 : 0,
        transform: isPresent ? 'translateY(0px)' : 'translateY(-8px)',
        transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>
  );
};

const RequireUserAuth = ({ children }) => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const adminUser = useAuthStore((state) => state.adminUser);
  const adminToken = useAuthStore((state) => state.adminToken);

  if (!user && !(adminUser && adminToken)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

const RequireAdminAuth = ({ children }) => {
  const location = useLocation();
  const adminUser = useAuthStore((state) => state.adminUser);
  const adminToken = useAuthStore((state) => state.adminToken);

  if (!adminUser || !adminToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

const App = () => {
  const location = useLocation();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Toaster position="top-right" />
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar />
      <main id="main-content" tabIndex={-1} style={{ paddingTop: '64px' }}>
        <Suspense fallback={<RouteLoader />}>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<PageTransition><Home /></PageTransition>} />
              <Route path="/dashboard" element={<RequireUserAuth><PageTransition><UserDashboard /></PageTransition></RequireUserAuth>} />
              <Route path="/events" element={<RequireUserAuth><PageTransition><Events /></PageTransition></RequireUserAuth>} />
              <Route path="/projects" element={<RequireUserAuth><PageTransition><Projects /></PageTransition></RequireUserAuth>} />
              <Route path="/team" element={<RequireUserAuth><PageTransition><Team /></PageTransition></RequireUserAuth>} />
              <Route path="/contact" element={<RequireUserAuth><PageTransition><Contact /></PageTransition></RequireUserAuth>} />
              <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
              <Route path="/login-otp" element={<PageTransition><LoginOtp /></PageTransition>} />
              <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
              <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
              <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
              <Route path="/verify-email" element={<PageTransition><VerifyEmail /></PageTransition>} />
              <Route path="/about" element={<PageTransition><About /></PageTransition>} />
              <Route path="/u/:slug" element={<PageTransition><PublicProfile /></PageTransition>} />
              <Route path="/team-invite/:token" element={<PageTransition><TeamInviteResponse /></PageTransition>} />
              <Route path="/admin" element={<RequireAdminAuth><PageTransition><AdminDashboard /></PageTransition></RequireAdminAuth>} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
      <ChatbotWidget />
    </div>
  );
};

export default App;
