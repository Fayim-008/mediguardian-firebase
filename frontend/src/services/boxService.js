import { get, post, patch, qs } from './api';

export const getBoxes = () => get('/api/v1/boxes').then((r) => r.boxes);
export const pairBox = (data) => post('/api/v1/boxes/pair', data);
export const unpairBox = (id) => post(`/api/v1/boxes/${id}/unpair`);
export const getBoxHistory = (id) => get(`/api/v1/boxes/${id}/history`).then((r) => r.history);
export const getConfigHistory = (id) => get(`/api/v1/boxes/${id}/config-history`).then((r) => r.versions);
export const renameDrawer = (id, slot, name) => patch(`/api/v1/boxes/${id}/drawers/${slot}`, { name });
export const getMeta = () => get('/api/v1/meta');
/** Real-time command to the physical box over Socket.IO: 'ring' | 'sync_config' | 'message' | 'stop_alarm'. */
export const sendBoxCommand = (id, command, extra = {}) => post(`/api/v1/boxes/${id}/command`, { command, ...extra });

/** Parse what a scanned QR (or a pasted link) contains: https://app/.../add-box?code=MG-...&token=XXXX-XXXX-XXXX */
export function parsePairingText(text) {
  try {
    const u = new URL(text);
    const code = u.searchParams.get('code'); const token = u.searchParams.get('token');
    if (code && token) return { boxCode: code, pairingCode: token };
  } catch { /* not a URL */ }
  return null;
}

/* development simulator (only available when the server has dev tools on) */
export const createSimulatedBox = () => post('/api/v1/dev/simulated-box');
export const simulate = (boxId, scenario, slot = 1) => post(`/api/v1/dev/boxes/${boxId}/simulate`, { scenario, slot });

/* admin (manufacturing) */
export const adminRegisterBoxes = (count, label) => post('/api/v1/admin/boxes', { count, label });
export const notifications = {
  list: (unread) => get(`/api/v1/notifications${qs({ unread: unread ? 'true' : undefined })}`).then((r) => r.notifications),
  markRead: (id) => post('/api/v1/notifications/read', id ? { id } : {}),
};
