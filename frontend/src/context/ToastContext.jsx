import React, { createContext, useContext, useMemo } from 'react';
import { ToastContainer, toast, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { friendlyError } from '../services/errors';

/**
 * App-wide notifications with react-toastify.
 *   const { push, toastError, toastPromise } = useToast();
 *   push('success' | 'error' | 'warning' | 'info', 'message' | Error)
 *   toastError(err)                       -> friendly message for Firebase / API / network errors
 * The same message is never stacked twice (toastId = text), errors stay a little longer.
 */
const ToastContext = createContext(null);

function show(type, msg) {
  const text = msg instanceof Error || (msg && typeof msg === 'object') ? friendlyError(msg) : String(msg ?? '');
  if (!text) return null;
  const fn = { success: toast.success, error: toast.error, warning: toast.warning, info: toast.info }[type] || toast;
  return fn(text, { toastId: `${type}:${text}`, autoClose: type === 'error' ? 6500 : 4000 });
}

export const pushToast = show;

export function ToastProvider({ children }) {
  const value = useMemo(() => ({
    push: show,
    toastError: (e, fallback) => show('error', friendlyError(e, fallback)),
    toastPromise: (promise, msgs) => toast.promise(promise, {
      pending: msgs.pending,
      success: msgs.success,
      error: { render: ({ data }) => friendlyError(data, msgs.error) },
    }),
    dismissAll: () => toast.dismiss(),
  }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer
        position="top-right"
        transition={Slide}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        pauseOnHover
        draggable
        limit={4}
        theme="colored"
        className="mg-toasts"
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
