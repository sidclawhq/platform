'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api-client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'reviewer' | 'viewer';
  tenant_id: string;
  tenant_name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: AuthUser }>('/api/v1/auth/me')
      .then(res => setUser(res.data))
      .catch(() => {
        // Not authenticated — redirect to login
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await api.post('/api/v1/auth/logout', {}).catch(() => {});
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
