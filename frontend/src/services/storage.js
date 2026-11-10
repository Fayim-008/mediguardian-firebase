/**
 * storage.js — harmless UI preferences ONLY (e.g. whether the demo panel is shown).
 * Accounts, patients, boxes, medicines, events and reports live in MongoDB behind the API.
 */
const NAMESPACE = 'mediguardian';
const key = (name) => `${NAMESPACE}:${name}`;

export function readCollection(name, fallback = null) {
  try { const raw = localStorage.getItem(key(name)); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; }
}
export function writeCollection(name, value) {
  try { localStorage.setItem(key(name), JSON.stringify(value)); return true; } catch { return false; }
}
export function clearAll() {
  Object.keys(localStorage).filter((k) => k.startsWith(`${NAMESPACE}:`)).forEach((k) => localStorage.removeItem(k));
}
export const StorageKeys = { DEMO_MODE: 'demo_mode' };
