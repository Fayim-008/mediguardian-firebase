/**
 * Toasts are shown by react-toastify (context/ToastContext.jsx). This helper lets non-React code raise one.
 * Persistent notifications come from the server (boxService.notifications).
 */
import { pushToast } from '../context/ToastContext';

export function notify(type, message) { pushToast(type, message); }
