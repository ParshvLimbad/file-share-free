import React from 'react';
import type { User } from '../services/auth';

export interface AuthContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  user,
  setUser,
  children,
}: {
  user: User | null;
  setUser: (user: User | null) => void;
  children: React.ReactNode;
}) {
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

