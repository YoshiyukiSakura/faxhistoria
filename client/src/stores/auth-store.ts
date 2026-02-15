import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, ApiError } from '../services/api';
import type { AuthResponse } from '@faxhistoria/shared';

interface User {
  id: string;
  email: string;
  displayName: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      loading: false,
      error: null,

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const data = await api.post<AuthResponse>('/auth/login', { email, password });
          set({ token: data.token, user: data.user, loading: false });
        } catch (err) {
          const message = err instanceof ApiError ? err.message : 'Login failed';
          set({ loading: false, error: message });
        }
      },

      register: async (email, password, displayName) => {
        set({ loading: true, error: null });
        try {
          const data = await api.post<AuthResponse>('/auth/register', {
            email,
            password,
            displayName,
          });
          set({ token: data.token, user: data.user, loading: false });
        } catch (err) {
          const message = err instanceof ApiError ? err.message : 'Registration failed';
          set({ loading: false, error: message });
        }
      },

      logout: () => {
        set({ token: null, user: null, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
