import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { setAccessToken } from '../src/services/api';
import { parsePairingText } from '../src/services/boxService';
import { mockApi } from './setup';

vi.mock('socket.io-client', () => ({ io: () => ({ on: () => {}, close: () => {}, connected: false }) }));
const ID_TOKEN = 'x'.repeat(150);
const fbUser = { getIdToken: async () => ID_TOKEN, email: 'f@example.com' };
const fb = vi.hoisted(() => ({
  emailSignIn: vi.fn(), emailSignUp: vi.fn(), googleSignIn: vi.fn(),
  completeGoogleRedirect: vi.fn(async () => null), firebaseReady: vi.fn(async () => null), firebaseSignOut: vi.fn(async () => {}),
  resetPasswordEmail: vi.fn(async () => {}), applyNewPassword: vi.fn(), checkResetCode: vi.fn(),
  signInMethod: vi.fn(() => 'password'), changeFirebasePassword: vi.fn(), reauthenticate: vi.fn(), deleteFirebaseAccount: vi.fn(),
  resendVerification: vi.fn(), currentFirebaseUser: vi.fn(() => null), freshIdToken: vi.fn(),
}));
vi.mock('../src/services/firebase', () => ({ ...fb, firebaseConfigError: null }));
beforeEach(() => {
  Object.values(fb).forEach((f) => f.mockClear?.());
  fb.emailSignIn.mockReset(); fb.emailSignUp.mockReset(); fb.googleSignIn.mockReset();
  fb.completeGoogleRedirect.mockResolvedValue(null); fb.firebaseReady.mockResolvedValue(null);
});


const user = { id: 'u1', name: 'Farhan Ahmed', email: 'f@example.com', phone: '017', role: 'caregiver' };
const patient = (o = {}) => ({ id: 'p1', name: 'Rahela Begum', relationship: 'Mother', dob: '', gender: 'Female', phone: '01711111', email: '', address: '', bloodGroup: '', conditions: '', allergies: '',
  emergencyName: '', emergencyPhone: '', emergencyRelation: '', doctorName: '', doctorContact: '', notes: '', timezone: 'Asia/Dhaka', status: 'Active', gracePeriodMinutes: 60, missedAfterHours: 24, ...o });
const box = { id: 'b1', boxCode: 'MG-AAAA-BBBB-CCCC', label: 'Mum', status: 'paired', simulated: true, patientId: 'p1', patientName: 'Rahela Begum',
  connection: { state: 'awaiting_first_connection', label: 'Awaiting' }, refillMode: null, config: { sync: 'pending', serverVersion: 2 },
  drawers: [{ id: 'd1', slot: 1, name: 'Morning', kind: 'morning' }, { id: 'd4', slot: 4, name: 'Extra', kind: 'extra' }] };
const report = { totals: { scheduled: 4, onTime: 2, late: 1, missed: 1, upcoming: 0, awaiting: 0, completed: 3, resolved: 4, hardwareOnly: 3, confirmedByHuman: 0 },
  percentages: { adherence: 75, onTime: 50, late: 25, missed: 25 }, medicineWise: [], dailyTrend: [], recentActivity: [], statusBreakdown: [], refillHistory: [], consumption: [], deviceEvents: [], definition: 'adherence = x' };
const dash = { patients: 1, boxes: 1, boxesOnline: 0, boxesOffline: 0, boxesAwaiting: 1, boxesPoweredOff: 0, today: { scheduled: 0, onTime: 0, late: 0, missed: 0, upcoming: 0, awaiting: 0 }, lowStock: [], recentEvents: [] };
const signedIn = { 'POST /api/v1/auth/refresh': { user, accessToken: 'tok' }, 'GET /api/v1/meta': { devTools: true } };
const base = { ...signedIn, 'GET /api/v1/patients': { patients: [patient()] }, 'GET /api/v1/boxes': { boxes: [box] }, 'GET /api/v1/dashboard': dash,
  'GET /api/v1/reports': report, 'GET /api/v1/patients/p1/today': { doses: [] }, 'GET /api/v1/patients/p1/boxes': { boxes: [box] }, 'GET /api/v1/medicines': { medicines: [] } };

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider></MemoryRouter>);

describe('routing + auth', () => {
  it('renders the landing page', async () => {
    mockApi({ 'POST /api/v1/auth/refresh': { status: 401, data: { error: { message: 'no' } } } });
    renderAt('/');
    expect((await screen.findAllByText(/MediGuardian/i)).length).toBeGreaterThan(0);
  });

  it('redirects unauthenticated visitors from /app/* to the login page', async () => {
    mockApi({ 'POST /api/v1/auth/refresh': { status: 401, data: { error: { message: 'no' } } } });
    renderAt('/app/dashboard');
    expect(await screen.findByRole('heading', { name: /^welcome back$/i })).toBeInTheDocument();
  });

  it('logs in with Firebase, exchanges the ID token, never stores the password', async () => {
    fb.emailSignIn.mockResolvedValue(fbUser);
    const calls = mockApi({ ...base, 'POST /api/v1/auth/refresh': { status: 401, data: { error: { message: 'no' } } },
      'POST /api/v1/auth/firebase': { user, accessToken: 'tok', refreshToken: 'r'.repeat(40) } });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText(/email/i), 'f@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'CorrectHorse9');
    await userEvent.click(screen.getByRole('button', { name: /^login$/i }));
    expect(await screen.findByText(/welcome back, farhan/i)).toBeInTheDocument();
    expect(fb.emailSignIn).toHaveBeenCalledWith({ email: 'f@example.com', password: 'CorrectHorse9' });
    expect(calls.find((c) => c.key === 'POST /api/v1/auth/firebase').body.idToken).toBe(ID_TOKEN);
    expect(JSON.stringify({ ...localStorage })).not.toMatch(/CorrectHorse9|password/);
  });

  it('shows a friendly toast for a wrong password (Firebase error code)', async () => {
    fb.emailSignIn.mockRejectedValue(Object.assign(new Error('Firebase: Error (auth/invalid-credential).'), { code: 'auth/invalid-credential' }));
    mockApi({ 'POST /api/v1/auth/refresh': { status: 401, data: {} } });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText(/email/i), 'f@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'wrongwrong1');
    await userEvent.click(screen.getByRole('button', { name: /^login$/i }));
    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument();
    expect(screen.queryByText(/auth\/invalid-credential/)).toBeNull();
  });

  it('login form validates before calling Firebase', async () => {
    mockApi({ 'POST /api/v1/auth/refresh': { status: 401, data: {} } });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText(/email/i), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /^login$/i }));
    expect(await screen.findByText(/email address is not valid/i)).toBeInTheDocument();
    expect(fb.emailSignIn).not.toHaveBeenCalled();
  });

  it('continue with Google creates the account and welcomes the new user', async () => {
    fb.googleSignIn.mockResolvedValue(fbUser);
    mockApi({ ...base, 'POST /api/v1/auth/refresh': { status: 401, data: {} },
      'POST /api/v1/auth/firebase': { status: 201, data: { user, accessToken: 'tok', refreshToken: 'r'.repeat(40), isNewUser: true } } });
    renderAt('/login');
    await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }));
    expect(await screen.findByText(/welcome to mediguardian, farhan/i)).toBeInTheDocument();
  });

  it('closing the Google popup is not shown as an error', async () => {
    fb.googleSignIn.mockRejectedValue(Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' }));
    mockApi({ 'POST /api/v1/auth/refresh': { status: 401, data: {} } });
    renderAt('/login');
    await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }));
    expect(await screen.findByText(/google sign-in was cancelled/i)).toBeInTheDocument();
  });

  it('if the server refuses the session, the Firebase sign-in is undone and the server message is shown', async () => {
    fb.emailSignIn.mockResolvedValue(fbUser);
    mockApi({ 'POST /api/v1/auth/refresh': { status: 401, data: {} },
      'POST /api/v1/auth/firebase': { status: 503, data: { error: { code: 'db_unavailable', message: 'The server cannot reach its database right now. Please try again in a minute.' } } } });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText(/email/i), 'f@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'CorrectHorse9');
    await userEvent.click(screen.getByRole('button', { name: /^login$/i }));
    expect(await screen.findByText(/cannot reach its database/i)).toBeInTheDocument();
    expect(fb.firebaseSignOut).toHaveBeenCalled();
  });

  it('register validates matching passwords before calling Firebase', async () => {
    mockApi({ 'POST /api/v1/auth/refresh': { status: 401, data: {} } });
    renderAt('/register');
    await userEvent.type(await screen.findByLabelText(/full name/i), 'New User');
    await userEvent.type(screen.getByLabelText(/email/i), 'n@example.com');
    await userEvent.type(screen.getByLabelText(/phone/i), '01712345678');
    await userEvent.type(screen.getAllByLabelText(/password/i)[0], 'Password123');
    await userEvent.type(screen.getAllByLabelText(/password/i)[1], 'Different123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(fb.emailSignUp).not.toHaveBeenCalled();
  });

  it('register shows a clear message when the email is already used', async () => {
    fb.emailSignUp.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }));
    mockApi({ 'POST /api/v1/auth/refresh': { status: 401, data: {} } });
    renderAt('/register');
    await userEvent.type(await screen.findByLabelText(/full name/i), 'New User');
    await userEvent.type(screen.getByLabelText(/email/i), 'n@example.com');
    await userEvent.type(screen.getAllByLabelText(/password/i)[0], 'Password123');
    await userEvent.type(screen.getAllByLabelText(/password/i)[1], 'Password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/account with this email already exists/i)).toBeInTheDocument();
  });

  it('forgot-password asks Firebase to send the email and confirms without revealing accounts', async () => {
    mockApi({ 'POST /api/v1/auth/refresh': { status: 401, data: {} } });
    renderAt('/forgot-password');
    await userEvent.type(await screen.findByLabelText(/email/i), 'f@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset/i }));
    expect(await screen.findByText(/reset link is on its way/i)).toBeInTheDocument();
    expect(fb.resetPasswordEmail).toHaveBeenCalledWith('f@example.com');
  });
});

describe('authenticated pages (data comes from the API)', () => {
  it('dashboard shows API data and the awaiting-first-connection box state (no fake "connected")', async () => {
    mockApi(base); renderAt('/app/dashboard');
    expect(await screen.findAllByText('Rahela Begum')).not.toHaveLength(0);
    expect(await screen.findByText(/awaiting first connection/i)).toBeInTheDocument();
    expect(screen.getByText(/SIMULATED — not real hardware/)).toBeInTheDocument();
    expect(screen.queryByText(/^online$/i)).not.toBeInTheDocument();
  });

  it('patients page: empty state, then add-patient form validates required fields', async () => {
    const calls = mockApi({ ...base, 'GET /api/v1/patients': { patients: [] }, 'POST /api/v1/patients': { status: 201, data: { patient: patient() } } });
    renderAt('/app/patients');
    expect(await screen.findByText(/no patients added yet/i)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /add patient/i })[0]);
    await userEvent.click(await screen.findByRole('button', { name: /save patient/i }));
    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /api/v1/patients')).toBe(false);
  });

  it('set-medicine form offers only the drawers of this patient\'s box and sends 24h times + drawer id', async () => {
    const calls = mockApi({ ...base, 'POST /api/v1/patients/p1/medicines': { status: 201, data: { medicine: { id: 'm1' } } } });
    renderAt('/app/set-medicine');
    await userEvent.click(await screen.findByRole('button', { name: /^set medicine$/i }));
    const modal = await waitFor(() => { const m = document.querySelector('.modal-box'); expect(m).not.toBeNull(); return m; });
    await userEvent.selectOptions(within(modal).getByLabelText(/select patient/i), 'p1');
    await userEvent.type(within(modal).getByLabelText(/medicine name/i), 'Napa Extra');
    await userEvent.type(within(modal).getByLabelText(/quantity placed/i), '30');
    const drawer = await within(modal).findByLabelText(/^drawer/i);
    await waitFor(() => expect(within(drawer).getAllByRole('option').length).toBe(1 + 2));   // "none" + the 2 drawers of the paired box
    await userEvent.selectOptions(drawer, 'd1');
    await userEvent.click(within(modal).getByRole('button', { name: /save medicine/i }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/v1/patients/p1/medicines')).toBe(true));
    const body = calls.find((c) => c.key === 'POST /api/v1/patients/p1/medicines').body;
    expect(body).toMatchObject({ name: 'Napa Extra', quantity: 30, drawerId: 'd1', schedule: { type: 'times', times: ['08:00'] } });
  });

  it('add-box page accepts manual codes and posts them for pairing', async () => {
    const calls = mockApi({ ...base, 'POST /api/v1/boxes/pair': { status: 201, data: { boxId: 'b1', patientId: 'p1' } } });
    renderAt('/app/add-box');
    await userEvent.type(await screen.findByLabelText(/^box code/i), 'MG-AAAA-BBBB-CCCC');
    await userEvent.type(screen.getByLabelText(/^pairing code/i), 'ABCD-EFGH-JKMN');
    await userEvent.selectOptions(await screen.findByLabelText(/^patient$/i), 'p1');
    await userEvent.click(screen.getByRole('button', { name: /confirm & link box/i }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/v1/boxes/pair')).toBe(true));
    expect(calls.find((c) => c.key === 'POST /api/v1/boxes/pair').body).toMatchObject({ boxCode: 'MG-AAAA-BBBB-CCCC', pairingCode: 'ABCD-EFGH-JKMN', patientId: 'p1' });
  });

  it('reports page renders server-computed figures and the adherence definition', async () => {
    mockApi(base); renderAt('/app/reports');
    expect(await screen.findByText('75%')).toBeInTheDocument();
    expect(await screen.findByText(/how these numbers are calculated/i)).toBeInTheDocument();
  });

  it('boxes page shows simulator controls only when the simulator is switched on', async () => {
    localStorage.setItem('mediguardian:demo_mode', 'true');
    mockApi(base); renderAt('/app/boxes');
    expect(await screen.findByRole('button', { name: /dose on time/i })).toBeInTheDocument();
  });

  it('refresh-token failure drops the session', async () => {
    mockApi({ 'POST /api/v1/auth/refresh': { status: 401, data: {} } });
    setAccessToken(null);
    renderAt('/app/patients');
    expect(await screen.findByRole('heading', { name: /^welcome back$/i })).toBeInTheDocument();
  });
});

describe('QR payload parsing', () => {
  it('extracts box + pairing code from the QR URL', () => {
    expect(parsePairingText('https://app.example.com/app/add-box?code=MG-AAAA-BBBB-CCCC&token=ABCD-EFGH-JKMN')).toEqual({ boxCode: 'MG-AAAA-BBBB-CCCC', pairingCode: 'ABCD-EFGH-JKMN' });
  });
  it('ignores QR codes that are not MediGuardian pairing links', () => {
    expect(parsePairingText('https://example.com')).toBeNull();
    expect(parsePairingText('hello')).toBeNull();
  });
});
