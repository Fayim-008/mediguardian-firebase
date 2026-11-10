import { get, post, patch, del } from './api';

export const getPatients = () => get('/api/v1/patients').then((r) => r.patients);
export const getPatientById = (id) => get(`/api/v1/patients/${id}`).then((r) => r.patient);
export const createPatient = (data) => post('/api/v1/patients', clean(data)).then((r) => r.patient);
export const updatePatient = (id, data) => patch(`/api/v1/patients/${id}`, clean(data)).then((r) => r.patient);
export const deletePatient = (id) => del(`/api/v1/patients/${id}`);
export const toggleDeactivate = (p) => updatePatient(p.id, { status: p.status === 'Active' ? 'Inactive' : 'Active' });
export const getPatientBoxes = (id) => get(`/api/v1/patients/${id}/boxes`).then((r) => r.boxes);

// Never send server-owned fields back.
function clean(d) {
  const { id, createdAt, photo, gracePeriodMinutes, missedAfterHours, ...rest } = d;
  const out = { ...rest };
  if (gracePeriodMinutes !== undefined && gracePeriodMinutes !== '') out.gracePeriodMinutes = Number(gracePeriodMinutes);
  if (missedAfterHours !== undefined && missedAfterHours !== '') out.missedAfterHours = Number(missedAfterHours);
  return out;
}

export function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  return Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

export function getInitials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');
}

export const TIMEZONES = ['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
