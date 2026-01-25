import { create } from 'zustand';

/**
 * Admin authentication store for stats-v2 pages.
 *
 * Authentication flow:
 * 1. User enters password on client
 * 2. Password is sent to /api/admin/auth for server-side validation
 * 3. Server validates against ADMIN_V2_PASSWORD_HASH env var
 * 4. If valid, server sets httpOnly cookie (not accessible via JS)
 * 5. Subsequent API requests include cookie automatically
 *
 * No sensitive data is stored client-side.
 * Set ADMIN_V2_PASSWORD_HASH in your .env file.
 *
 * To generate a hash, run in Node:
 *   node -e "let h=0;for(const c of 'your-password'){h=(h<<5)-h+c.charCodeAt(0);h=h&h;}console.log(h.toString(16))"
 */

type AdminAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingAuth: boolean;
  error: string | null;
};

type AdminAuthActions = {
  checkAuth: () => Promise<void>;
  authenticate: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
};

type AdminAuthStore = AdminAuthState & AdminAuthActions;

export const useAdminAuth = create<AdminAuthStore>()((set) => ({
  isAuthenticated: false,
  isLoading: false,
  isCheckingAuth: true,
  error: null,

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'GET',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        set({ isAuthenticated: false, isCheckingAuth: false });
        return;
      }
      const data = await response.json();
      set({ isAuthenticated: data.authenticated, isCheckingAuth: false });
    } catch {
      set({ isAuthenticated: false, isCheckingAuth: false });
    }
  },

  authenticate: async (password: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        set({ isLoading: false, error: data.error ?? 'Authentication failed' });
        return false;
      }

      set({ isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch {
      set({ isLoading: false, error: 'Network error' });
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch('/api/admin/auth', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
    } finally {
      set({ isAuthenticated: false, error: null });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
