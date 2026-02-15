import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { GameLobby } from './components/lobby/GameLobby';
import { AdminPanel } from './components/admin/AdminPanel';
import { CountrySelectionScreen } from './components/selection/CountrySelectionScreen';
import { GameUI } from './components/game/GameUI';
import { ToastProvider } from './components/layout/ToastProvider';
import { HomePage } from './components/marketing/HomePage';
import { SeoHead } from './components/seo/SeoHead';
import { DEFAULT_SEO_DESCRIPTION } from './config/site';
import type { ReactNode } from 'react';

interface RouteSeo {
  title: string;
  description: string;
  robots?: string;
}

const NOINDEX = 'noindex, nofollow';

function getRouteSeo(pathname: string): RouteSeo {
  if (pathname === '/') {
    return {
      title: 'FaxHistoria - AI Alternate History Strategy Game',
      description:
        'Play FaxHistoria, an AI-driven alternate history strategy game where each turn reshapes diplomacy, economy, and warfare.',
      robots: 'index, follow',
    };
  }

  if (pathname === '/login') {
    return {
      title: 'Sign In',
      description: 'Sign in to continue your FaxHistoria campaign.',
      robots: NOINDEX,
    };
  }

  if (pathname === '/register') {
    return {
      title: 'Create Account',
      description: 'Create your FaxHistoria account and start your first campaign.',
      robots: NOINDEX,
    };
  }

  if (
    pathname === '/lobby' ||
    pathname === '/admin' ||
    pathname === '/game/new/select-country' ||
    pathname.startsWith('/game/')
  ) {
    return {
      title: 'Game Dashboard',
      description: 'Private gameplay area for authenticated FaxHistoria players.',
      robots: NOINDEX,
    };
  }

  return {
    title: 'FaxHistoria',
    description: DEFAULT_SEO_DESCRIPTION,
    robots: NOINDEX,
  };
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (token) return <Navigate to="/lobby" replace />;
  return <>{children}</>;
}

function RouterContent() {
  const location = useLocation();
  const seo = getRouteSeo(location.pathname);

  return (
    <>
      <SeoHead
        title={seo.title}
        description={seo.description}
        pathname={location.pathname}
        robots={seo.robots}
      />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginForm />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterForm />
            </PublicRoute>
          }
        />
        <Route
          path="/lobby"
          element={
            <ProtectedRoute>
              <GameLobby />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/new/select-country"
          element={
            <ProtectedRoute>
              <CountrySelectionScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/:id/select-country"
          element={
            <ProtectedRoute>
              <CountrySelectionScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/:id"
          element={
            <ProtectedRoute>
              <GameUI />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastProvider />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <RouterContent />
    </BrowserRouter>
  );
}
