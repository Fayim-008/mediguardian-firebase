/**
 * api.js — the ONLY place that talks HTTP to the backend.
 *
 * The backend runs on a SEPARATE server, set by VITE_API_URL (e.g. http://localhost:4000 or https://api.example.com).
 * - Access token: short-lived JWT, kept in memory only, sent as "Authorization: Bearer ...".
 * - Refresh token: returned in the JSON body (cross-site cookies are blocked by many browsers), kept in
 *   localStorage, rotated by the server on every use. On a 401 we do ONE silent refresh and retry once.
 */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const REFRESH_KEY = 'mediguardian:refresh_token';
let accessToken = null;
let refreshing = null;
const listeners = new Set();

export const apiBase = () => BASE;
export const getAccessToken = () => accessToken;
export const setAccessToken = (t) => { accessToken = t; listeners.forEach((fn) => fn(t)); };
export const onTokenChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const getRefreshToken = () => { try { return localStorage.getItem(REFRESH_KEY); } catch { return null; } };
export const setRefreshToken = (t) => { try { if (t) localStorage.setItem(REFRESH_KEY, t); else localStorage.removeItem(REFRESH_KEY); } catch { /* private mode */ } };

/** Store everything a login/register/refresh response contains. */
export function setSession(data) {
  setRefreshToken(data?.refreshToken || null);
  setAccessToken(data?.accessToken || null);
}
export function clearSession() { setRefreshToken(null); setAccessToken(null); }

export class ApiError extends Error {
  constructor(status, message, code, details) { super(message); this.status = status; this.code = code; this.details = details; }
}

async function raw(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Cannot reach the server at ${BASE || window.location.origin}. Is the backend running and is VITE_API_URL correct?`, 'network');
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { res, data };
}

export async function refreshAccessToken() {
  const token = getRefreshToken();
  if (!token) { setAccessToken(null); return null; }
  if (!refreshing) {
    refreshing = raw('/api/v1/auth/refresh', { method: 'POST', auth: false, body: { refreshToken: token } })
      .then(({ res, data }) => {
        if (!res.ok) { clearSession(); return null; }
        setSession(data); return data;
      })
      .catch(() => null)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(path, opts = {}) {
  let { res, data } = await raw(path, opts);
  if (res.status === 401 && opts.auth !== false && !path.startsWith('/api/v1/auth/')) {
    if (await refreshAccessToken()) ({ res, data } = await raw(path, opts));
  }
  if (!res.ok) {
    const e = data?.error || {};
    throw new ApiError(res.status, e.message || `Request failed (${res.status})`, e.code, e.details);
  }
  return data;
}

export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: 'POST', body: body ?? {} });
export const patch = (p, body) => api(p, { method: 'PATCH', body });
export const del = (p, body) => api(p, { method: 'DELETE', body });
export const qs = (o) => { const u = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && u.set(k, v)); const s = u.toString(); return s ? `?${s}` : ''; };
