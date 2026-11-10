/**
 * firebase.js — the ONLY file that talks to Firebase Authentication.
 * Sign-up, sign-in (email/password + Google), password reset, password change and re-authentication.
 * After any Firebase sign-in, authService exchanges the Firebase ID token for a MediGuardian session.
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, browserLocalPersistence, setPersistence, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  sendPasswordResetEmail, sendEmailVerification, updateProfile as fbUpdateProfile,
  verifyPasswordResetCode, confirmPasswordReset,
  EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, updatePassword, deleteUser,
} from 'firebase/auth';

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  ...(env.VITE_FIREBASE_STORAGE_BUCKET ? { storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET } : {}),
  ...(env.VITE_FIREBASE_MESSAGING_SENDER_ID ? { messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID } : {}),
};

const REQUIRED = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missing = REQUIRED.filter((k) => !firebaseConfig[k]);
export const firebaseConfigError = missing.length
  ? `Sign-in is not configured: missing ${missing.map((k) => `VITE_FIREBASE_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`).join(', ')} in frontend/.env. Restart "npm run dev" after editing it.`
  : null;

let auth = null;
function getFirebaseAuth() {
  if (firebaseConfigError) {
    const e = new Error(firebaseConfigError); e.code = 'app/not-configured'; throw e;
  }
  if (!auth) {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    auth = getAuth(app);
    auth.useDeviceLanguage();
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }
  return auth;
}

const googleProvider = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
};

/** Resolves once Firebase has restored any previous sign-in (or immediately when Firebase isn't configured). */
export function firebaseReady() {
  if (firebaseConfigError) return Promise.resolve(null);
  const a = getFirebaseAuth();
  return new Promise((resolve) => { const off = onAuthStateChanged(a, (u) => { off(); resolve(u); }, () => { off(); resolve(null); }); });
}

export const currentFirebaseUser = () => (firebaseConfigError ? null : getFirebaseAuth().currentUser);
export const freshIdToken = async (force = false) => {
  const u = currentFirebaseUser();
  if (!u) { const e = new Error('Not signed in with Firebase.'); e.code = 'auth/no-current-user'; throw e; }
  return u.getIdToken(force);
};

export async function emailSignUp({ name, email, password }) {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  try { if (name) await fbUpdateProfile(cred.user, { displayName: name }); } catch { /* not critical */ }
  let verificationSent = true;
  try { await sendEmailVerification(cred.user); } catch { verificationSent = false; }
  return { user: cred.user, verificationSent };
}

export async function emailSignIn({ email, password }) {
  return (await signInWithEmailAndPassword(getFirebaseAuth(), email, password)).user;
}

/**
 * Google sign-in. Uses a popup; if the browser blocks popups (common on phones / in-app browsers)
 * it falls back to a full-page redirect and the result is picked up by completeGoogleRedirect() on return.
 * Returns the Firebase user, or null when a redirect has started.
 */
export async function googleSignIn() {
  const a = getFirebaseAuth();
  try {
    return (await signInWithPopup(a, googleProvider())).user;
  } catch (e) {
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(a, googleProvider());
      return null;
    }
    throw e;
  }
}

/** Call on page load: finishes a Google redirect sign-in if one was in progress. */
export async function completeGoogleRedirect() {
  if (firebaseConfigError) return null;
  const r = await getRedirectResult(getFirebaseAuth());
  return r?.user || null;
}

export async function resetPasswordEmail(email) {
  const url = `${window.location.origin}/login`;
  try { await sendPasswordResetEmail(getFirebaseAuth(), email, { url }); }
  catch (e) {
    // The continue-URL domain must be authorised in Firebase; retry without it rather than fail.
    if (e?.code === 'auth/unauthorized-continue-uri' || e?.code === 'auth/invalid-continue-uri') await sendPasswordResetEmail(getFirebaseAuth(), email);
    else throw e;
  }
}

export const checkResetCode = (code) => verifyPasswordResetCode(getFirebaseAuth(), code);
export const applyNewPassword = (code, password) => confirmPasswordReset(getFirebaseAuth(), code, password);

export const resendVerification = async () => { const u = currentFirebaseUser(); if (u && !u.emailVerified) await sendEmailVerification(u); };

/** Which way did this person sign in? 'password' | 'google.com' | null */
export function signInMethod() {
  const u = currentFirebaseUser();
  if (!u) return null;
  const ids = u.providerData.map((p) => p.providerId);
  return ids.includes('password') ? 'password' : ids.includes('google.com') ? 'google.com' : ids[0] || null;
}

/** Ask the person to prove it's them again (password or Google). Returns a fresh ID token. */
export async function reauthenticate(password) {
  const u = currentFirebaseUser();
  if (!u) { const e = new Error('Please sign in again.'); e.code = 'auth/no-current-user'; throw e; }
  if (signInMethod() === 'password') {
    if (!password) { const e = new Error('Enter your current password.'); e.code = 'auth/missing-password'; throw e; }
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
  } else {
    await reauthenticateWithPopup(u, googleProvider());
  }
  return u.getIdToken(true);
}

export async function changeFirebasePassword(currentPassword, newPassword) {
  await reauthenticate(currentPassword);
  await updatePassword(currentFirebaseUser(), newPassword);
}

export async function deleteFirebaseAccount() { const u = currentFirebaseUser(); if (u) await deleteUser(u); }

export async function firebaseSignOut() { if (!firebaseConfigError) { try { await signOut(getFirebaseAuth()); } catch { /* ignore */ } } }
