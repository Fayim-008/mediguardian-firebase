import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

/** Tiny fetch router. routes: { 'GET /api/v1/patients': (body, url) => ({ status, data }) | data } */
export function mockApi(routes) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const u = new URL(url, 'http://localhost'); const key = `${opts.method || 'GET'} ${u.pathname}`;
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ key, body, url: u.toString() });
    const h = routes[key];
    if (!h) return new Response(JSON.stringify({ error: { message: `no mock for ${key}` } }), { status: 404 });
    const r = typeof h === 'function' ? h(body, u) : h;
    const { status = 200, data = r } = r && r.status ? r : { data: r };
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}
// A stored refresh token makes the app try to restore the session (the mocked /auth/refresh decides the outcome).
beforeEach(() => { localStorage.clear(); localStorage.setItem('mediguardian:refresh_token', 'test-refresh-token-0123456789'); });
