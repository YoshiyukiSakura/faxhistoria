import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { GameLobby } from './components/lobby/GameLobby';
import { AdminPanel } from './components/admin/AdminPanel';
import { CountrySelectionScreen } from './components/selection/CountrySelectionScreen';
import { GameUI } from './components/game/GameUI';
import { ToastProvider } from './components/layout/ToastProvider';
import type { ReactNode } from 'react';

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

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
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
    </BrowserRouter>
  );
}

function RootRedirect() {
  const token = useAuthStore((s) => s.token);
  return <Navigate to={token ? '/lobby' : '/login'} replace />;
}
