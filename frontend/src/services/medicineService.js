import { get, post, patch, del, qs } from './api';

export const MEDICINE_TYPES = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Ointment'];
export const DOSE_OPTIONS = [
  { label: 'Half Tablet', quantity: 0.5 }, { label: '1 Tablet', quantity: 1 }, { label: '2 Tablets', quantity: 2 }, { label: '3 Tablets', quantity: 3 },
];

export const getMedicines = (patientId) => get(`/api/v1/medicines${qs({ patientId })}`).then((r) => r.medicines);
export const createMedicine = (patientId, data) => post(`/api/v1/patients/${patientId}/medicines`, data).then((r) => r.medicine);
export const updateMedicine = (id, data) => patch(`/api/v1/medicines/${id}`, data).then((r) => r.medicine);
export const deleteMedicine = (id) => del(`/api/v1/medicines/${id}`);
export const toggleMedicineActive = (m) => updateMedicine(m.id, { active: !m.active });
export const refillMedicine = (id, amount, note) => post(`/api/v1/medicines/${id}/refill`, { amount: Number(amount), note });
export const adjustStock = (id, newQuantity, note) => post(`/api/v1/medicines/${id}/adjust-stock`, { newQuantity: Number(newQuantity), note });
export const getStockHistory = (id) => get(`/api/v1/medicines/${id}/stock-history`).then((r) => r.ledger);
export const isLowStock = (m) => m.lowStock ?? Number(m.quantity) <= Number(m.lowStockThreshold ?? 6);

/* doses */
export const getTodaySchedule = (patientId) => get(`/api/v1/patients/${patientId}/today`).then((r) => r.doses);
export const getDoses = (patientId, params) => get(`/api/v1/patients/${patientId}/doses${qs(params)}`).then((r) => r.doses);
export const confirmDose = (doseId, note) => post(`/api/v1/doses/${doseId}/confirm`, note ? { note } : {});

/* times are stored as 24h "HH:MM" in the patient's time zone */
export function fmtTime(iso, timeZone) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timeZone || undefined });
}
export function fmtDateTime(iso, timeZone) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timeZone || undefined });
}
export function scheduleSummary(m) {
  const s = m.schedule; if (!s) return 'No schedule';
  return s.type === 'times' ? s.times.join(', ') : `every ${s.everyHours}h from ${s.anchor}`;
}
