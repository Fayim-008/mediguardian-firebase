import { get, qs } from './api';

/** Reports are computed on the server from persisted dose records (see docs/MEDICATION_LOGIC.md). */
export const buildReport = (patientId, range = '7D', extra = {}) => get(`/api/v1/reports${qs({ patientId, range, ...extra })}`);
export const calculateWeeklyAdherence = (patientId) => buildReport(patientId, '7D').then((r) => r.percentages.adherence);
export const getDashboard = () => get('/api/v1/dashboard');
