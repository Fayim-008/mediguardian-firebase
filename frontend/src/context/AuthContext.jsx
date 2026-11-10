import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as authService from '../services/authService';
import { onTokenChange } from '../services/api';
import { startRealtime, stopRealtime } from '../services/realtime';
import { pushToast } from './ToastContext';
import { isUserCancel } from '../services/errors';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);   // until we know whether a session exists
  const [loading, setLoading] = useState(false);
  const userRef = useRef(null); userRef.current = user;
  const leaving = useRef(false);

  useEffect(() => {
    let alive = true;
    authService.restoreSession()
      .then((u) => { if (alive) { setUser(u); if (u) startRealtime(); } })
      .catch((e) => { if (!isUserCancel(e)) pushToast('error', e); })
      .finally(() => alive && setBooting(false));
    return () => { alive = false; };
  }, []);

  // The session can end on its own (refresh token expired / revoked on another device): leave the app cleanly.
  useEffect(() => onTokenChange((t) => {
    if (!t && userRef.current && !leaving.current) {
      stopRealtime();
      setUser(null);
      pushToast('warning', 'Your session has ended. Please log in again.');
    }
  }), []);

  const run = useCallback(async (fn, payload) => {
    setLoading(true);
    try {
      const r = await fn(payload);
      if (r?.user) { setUser(r.user); startRealtime(); }
      return r;
    } finally { setLoading(false); }
  }, []);

  const login = useCallback((p) => run(authService.login, p), [run]);
  const register = useCallback((p) => run(authService.register, p), [run]);
  const loginWithGoogle = useCallback(() => run(authService.loginWithGoogle), [run]);

  const endSession = useCallback(async (fn) => {
    leaving.current = true;
    stopRealtime();
    try { return await fn(); } finally { setUser(null); leaving.current = false; }
  }, []);

  const logout = useCallback(() => endSession(authService.logout), [endSession]);
  const changePassword = useCallback(async (p) => {
    leaving.current = true;
    try { await authService.changePassword(p); stopRealtime(); setUser(null); } finally { leaving.current = false; }
  }, []);
  const deleteAccount = useCallback(async (password) => {
    leaving.current = true;
    try { const r = await authService.deleteAccount(password); stopRealtime(); setUser(null); return r; } finally { leaving.current = false; }
  }, []);

  const refreshUser = useCallback(async () => setUser(await authService.getMe()), []);

  return (
    <AuthContext.Provider value={{ user, booting, loading, login, register, loginWithGoogle, logout, changePassword, deleteAccount, refreshUser, setUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
