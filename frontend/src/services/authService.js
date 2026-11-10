/**
 * Authentication flow:
 *   Firebase (email/password or Google)  ->  Firebase ID token  ->  POST /api/v1/auth/firebase  ->  MediGuardian session
 * Every function validates its input first and throws errors with clear messages (see services/errors.js).
 */
import { api, post, patch, del, refreshAccessToken, setSession, clearSession, getRefreshToken } from './api';
import * as fb from './firebase';
import { EMAIL_RE, PHONE_RE, passwordProblem } from './errors';

const fail = (message) => { throw new Error(message); };

/** Exchange the current Firebase user for a MediGuardian session. */
async function exchange(firebaseUser, profile = {}) {
  const idToken = await firebaseUser.getIdToken();
  try {
    const r = await post('/api/v1/auth/firebase', { idToken, ...profile });
    setSession(r);
    return { user: r.user, isNewUser: !!r.isNewUser };
  } catch (e) {
    // Firebase said yes but our server said no: don't leave a half-signed-in state behind.
    await fb.firebaseSignOut();
    throw e;
  }
}

export async function register({ name, email, phone, password, confirmPassword }) {
  name = (name || '').trim(); email = (email || '').trim().toLowerCase(); phone = (phone || '').trim();
  if (!name) fail('Please enter your full name.');
  if (name.length > 100) fail('Name is too long (100 characters max).');
  if (!email) fail('Please enter your email address.');
  if (!EMAIL_RE.test(email)) fail('That email address is not valid. Please check it.');
  if (phone && !PHONE_RE.test(phone)) fail('Phone number may contain only digits, spaces, dashes and a leading +.');
  const pwProblem = passwordProblem(password);
  if (pwProblem) fail(pwProblem);
  if (password !== confirmPassword) fail('Passwords do not match.');
  const { user: fbUser, verificationSent } = await fb.emailSignUp({ name, email, password });
  const r = await exchange(fbUser, { name, ...(phone ? { phone } : {}) });
  return { ...r, verificationSent };
}

export async function login({ email, password }) {
  email = (email || '').trim().toLowerCase();
  if (!email) fail('Please enter your email address.');
  if (!EMAIL_RE.test(email)) fail('That email address is not valid. Please check it.');
  if (!password) fail('Please enter your password.');
  return exchange(await fb.emailSignIn({ email, password }));
}

/** Returns null when the browser was sent to Google (redirect fallback); the session is finished on return. */
export async function loginWithGoogle() {
  const fbUser = await fb.googleSignIn();
  return fbUser ? exchange(fbUser) : null;
}

export async function logout() {
  try { await post('/api/v1/auth/logout', { refreshToken: getRefreshToken() || undefined }); } catch { /* offline: still sign out locally */ }
  clearSession();
  await fb.firebaseSignOut();
}

/**
 * On page load: 1) finish a Google redirect, 2) use our stored refresh token,
 * 3) if that's gone but Firebase still remembers the person, exchange again.
 */
export async function restoreSession() {
  try {
    const redirected = await fb.completeGoogleRedirect();
    if (redirected) return (await exchange(redirected)).user;
  } catch (e) {
    e.fromRedirect = true;
    throw e;
  }
  const r = await refreshAccessToken();
  if (r) return r.user;
  const fbUser = await fb.firebaseReady();
  if (fbUser) {
    try { return (await exchange(fbUser)).user; } catch { return null; }
  }
  return null;
}

export async function requestPasswordReset(email) {
  email = (email || '').trim().toLowerCase();
  if (!email) fail('Please enter your email address.');
  if (!EMAIL_RE.test(email)) fail('That email address is not valid. Please check it.');
  try {
    await fb.resetPasswordEmail(email);
  } catch (e) {
    // Don't reveal whether an account exists for this email.
    if (e?.code === 'auth/user-not-found') return { sent: true };
    throw e;
  }
  return { sent: true };
}

export async function resetPassword({ code, newPassword, confirmPassword }) {
  if (!code) fail('This page needs the link from the password-reset email.');
  const p = passwordProblem(newPassword);
  if (p) fail(p);
  if (newPassword !== confirmPassword) fail('Passwords do not match.');
  await fb.applyNewPassword(code, newPassword);
}

export const checkResetLink = (code) => fb.checkResetCode(code);

export async function updateProfile({ name, phone }) {
  name = (name || '').trim(); phone = (phone || '').trim();
  if (!name) fail('Name cannot be empty.');
  if (phone && !PHONE_RE.test(phone)) fail('Phone number may contain only digits, spaces, dashes and a leading +.');
  return patch('/api/v1/auth/me', { name, phone }).then((r) => r.user);
}

export async function changePassword({ currentPassword, newPassword, confirm }) {
  if (fb.signInMethod() !== 'password') fail('You sign in with Google, so your password is managed by your Google account.');
  if (!currentPassword) fail('Please enter your current password.');
  const p = passwordProblem(newPassword);
  if (p) fail(p);
  if (newPassword !== confirm) fail('New passwords do not match.');
  if (newPassword === currentPassword) fail('The new password must be different from the current one.');
  await fb.changeFirebasePassword(currentPassword, newPassword);
  try { await post('/api/v1/auth/logout-all'); } catch { /* the password is changed either way */ }
  clearSession();
  await fb.firebaseSignOut();
}

/** Re-confirm identity (password or Google), then delete everything. */
export async function deleteAccount(password) {
  const idToken = await fb.reauthenticate(password);
  const r = await del('/api/v1/auth/account', { idToken });
  if (!r.firebaseDeleted) { try { await fb.deleteFirebaseAccount(); } catch { /* server data is gone; Firebase login will simply find no account */ } }
  clearSession();
  await fb.firebaseSignOut();
  return r;
}

export const resendVerificationEmail = () => fb.resendVerification();
export const currentSignInMethod = () => fb.signInMethod();
export const getMe = () => api('/api/v1/auth/me').then((r) => r.user);
