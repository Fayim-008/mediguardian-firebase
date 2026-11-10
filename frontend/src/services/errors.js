/**
 * errors.js — turns ANY error (Firebase, API, network, code bug) into one clear sentence for a toast.
 * Pages call friendlyError(e) instead of showing raw messages like "Firebase: Error (auth/invalid-credential)."
 */

const FIREBASE = {
  // sign up
  'auth/email-already-in-use': 'An account with this email already exists. Log in instead, or use "Forgot password".',
  'auth/invalid-email': 'That email address is not valid. Please check it.',
  'auth/weak-password': 'That password is too weak. Use at least 8 characters with letters and numbers.',
  'auth/password-does-not-meet-requirements': 'That password does not meet the security rules. Use at least 8 characters with upper- and lower-case letters and a number.',
  'auth/missing-password': 'Please enter your password.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/operation-not-allowed': 'This sign-in method is turned off in Firebase. The administrator must enable it (Firebase console → Authentication → Sign-in method).',
  'auth/admin-restricted-operation': 'New sign-ups are currently disabled. Please contact the administrator.',
  // sign in
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'No account found with this email. Please create an account first.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/too-many-requests': 'Too many attempts. For your security, please wait a few minutes or reset your password.',
  'auth/user-token-expired': 'Your sign-in has expired. Please log in again.',
  'auth/requires-recent-login': 'For your security, please confirm your password (or Google account) again.',
  'auth/user-mismatch': 'Please confirm with the same account you are signed in with.',
  'auth/no-current-user': 'Please log in again.',
  // Google
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled because another sign-in window opened.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  'auth/user-cancelled': 'Google sign-in was cancelled.',
  'auth/account-exists-with-different-credential': 'This email already has an account with a different sign-in method. Log in with email and password instead.',
  'auth/credential-already-in-use': 'This Google account is already linked to another user.',
  'auth/unauthorized-domain': 'This website address is not allowed to use Google sign-in. Add it in Firebase console → Authentication → Settings → Authorized domains.',
  'auth/operation-not-supported-in-this-environment': 'Google sign-in is not supported in this browser. Open the site in Chrome, Safari or Firefox.',
  'auth/web-storage-unsupported': 'Your browser blocks storage that sign-in needs (private mode or cookies blocked). Please allow it and try again.',
  // reset password
  'auth/expired-action-code': 'This link has expired. Please request a new one.',
  'auth/invalid-action-code': 'This link is invalid or was already used. Please request a new one.',
  'auth/invalid-continue-uri': 'The reset link could not be created (invalid return address). Please contact the administrator.',
  'auth/unauthorized-continue-uri': 'The reset link could not be created (domain not authorised in Firebase).',
  'auth/missing-continue-uri': 'The reset link could not be created. Please try again.',
  // configuration / network
  'auth/network-request-failed': 'No internet connection, or Firebase could not be reached. Check your connection and try again.',
  'auth/internal-error': 'Firebase had a temporary problem. Please try again.',
  'auth/invalid-api-key': 'Sign-in is misconfigured (invalid Firebase API key). Please contact the administrator.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Sign-in is misconfigured (invalid Firebase API key). Please contact the administrator.',
  'auth/configuration-not-found': 'Firebase Authentication is not set up for this project. Enable it in the Firebase console.',
  'auth/app-not-authorized': 'This app is not authorised for the Firebase project. Please contact the administrator.',
  'auth/quota-exceeded': 'Too many requests to the sign-in service right now. Please try again later.',
  'auth/timeout': 'The request timed out. Please try again.',
};

const HTTP = {
  0: 'Cannot reach the server. Check your internet connection, or the server may be down.',
  400: 'Some information is invalid. Please check the form.',
  401: 'Your session has ended. Please log in again.',
  403: 'You do not have permission to do that.',
  404: 'That item was not found. It may have been deleted.',
  409: 'That conflicts with existing data. Please refresh and try again.',
  413: 'That is too large to upload.',
  422: 'Some information is invalid. Please check the form.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on the server. Please try again.',
  502: 'The server is not responding (bad gateway). Please try again in a minute.',
  503: 'The service is temporarily unavailable. Please try again in a minute.',
  504: 'The server took too long to respond. Please try again.',
};

/** Silent errors: the user did it on purpose, so a red toast would be wrong. */
export const isUserCancel = (e) => ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'].includes(e?.code);

export function friendlyError(e, fallback = 'Something went wrong. Please try again.') {
  if (!e) return fallback;
  if (typeof e === 'string') return e;
  const code = e.code || '';
  if (code === 'app/not-configured') return e.message;
  if (code.startsWith('auth/')) {
    if (FIREBASE[code]) return FIREBASE[code];
    return fallback.replace(/\.$/, '') + ` (${code.replace('auth/', '')}).`;
  }
  if (typeof e.status === 'number') {
    // The server already writes a clear sentence; use it. Fall back to the status meaning.
    if (e.message && !/^Request failed/.test(e.message)) return e.message;
    return HTTP[e.status] || fallback;
  }
  if (e.name === 'TypeError' && /fetch|network/i.test(e.message)) return HTTP[0];
  return e.message || fallback;
}

/* ---- client-side form checks (instant feedback before anything is sent) ---- */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\+?[0-9][0-9\s-]{5,18}$/;

export function passwordProblem(pw) {
  if (!pw) return 'Please enter a password.';
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 128) return 'Password must be at most 128 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain both letters and numbers.';
  return null;
}
