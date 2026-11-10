import { io } from 'socket.io-client';
import { apiBase, getAccessToken, onTokenChange } from './api';

let socket = null;
let unsub = null;
const handlers = new Set();
export const connectionListeners = new Set();

export function startRealtime() {
  if (socket || !getAccessToken()) return;
  socket = io(apiBase() || undefined, { auth: (cb) => cb({ token: getAccessToken() }), transports: ['websocket', 'polling'], reconnectionDelayMax: 10000 });
  ['device:event', 'device:status', 'device:config', 'dose:update', 'stock:changed', 'config:changed', 'notification:new'].forEach((ev) => socket.on(ev, (p) => handlers.forEach((h) => h(ev, p))));
  // After any reconnect, never trust missed events: tell listeners to reload from the API.
  socket.on('connect', () => connectionListeners.forEach((f) => f('connected')));
  socket.on('disconnect', () => connectionListeners.forEach((f) => f('disconnected')));
  socket.on('connect_error', () => connectionListeners.forEach((f) => f('disconnected')));
  unsub = onTokenChange((t) => { if (!t) stopRealtime(); });
}
export function stopRealtime() { if (socket) { socket.close(); socket = null; } if (unsub) { unsub(); unsub = null; } }
export function subscribeRealtime(fn) { handlers.add(fn); return () => handlers.delete(fn); }
