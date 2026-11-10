import React from 'react';
import { X, Inbox, AlertOctagon, Loader2 } from 'lucide-react';

/* ------------------------------- Button ------------------------------- */
export function Button({ variant = 'primary', size, icon: Icon, iconRight, className = '', children, ...rest }) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {Icon && !iconRight && <Icon size={17} />}
      {children}
      {Icon && iconRight && <Icon size={17} />}
    </button>
  );
}

/* -------------------------------- Input -------------------------------- */
export function Input({ label, hint, error, icon: Icon, suffix, className = '', wrapperClassName = '', ...rest }) {
  const input = (
    <input className={`input ${error ? 'has-error' : ''} ${className}`} {...rest} />
  );
  return (
    <div className={`field ${wrapperClassName}`}>
      {label && <label htmlFor={rest.id}>{label}</label>}
      {Icon || suffix ? (
        <div className="input-group">
          {Icon && <span className="input-icon"><Icon size={17} /></span>}
          {input}
          {suffix}
        </div>
      ) : (
        input
      )}
      {error && <div className="error-text">{error}</div>}
      {!error && hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/* -------------------------------- Select -------------------------------- */
export function Select({ label, hint, error, options = [], placeholder, className = '', wrapperClassName = '', ...rest }) {
  return (
    <div className={`field ${wrapperClassName}`}>
      {label && <label htmlFor={rest.id}>{label}</label>}
      <select className={`select ${error ? 'has-error' : ''} ${className}`} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
            {typeof opt === 'string' ? opt : opt.label}
          </option>
        ))}
      </select>
      {error && <div className="error-text">{error}</div>}
      {!error && hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/* ------------------------------- Textarea ------------------------------- */
export function Textarea({ label, hint, error, className = '', ...rest }) {
  return (
    <div className="field">
      {label && <label htmlFor={rest.id}>{label}</label>}
      <textarea className={`textarea ${error ? 'has-error' : ''} ${className}`} {...rest} />
      {error && <div className="error-text">{error}</div>}
      {!error && hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/* -------------------------------- Badge -------------------------------- */
export function Badge({ tone = 'neutral', icon: Icon, children }) {
  return (
    <span className={`badge badge-${tone}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

/* ------------------------------- StatCard ------------------------------- */
export function StatCard({ icon: Icon, value, label, tone = 'info' }) {
  const bg = { info: 'var(--primary-100)', success: 'var(--success-100)', warning: 'var(--warning-100)', danger: 'var(--danger-100)' }[tone];
  const fg = { info: 'var(--primary-700)', success: 'var(--success)', warning: '#B4790C', danger: 'var(--danger)' }[tone];
  return (
    <div className="card stat-card">
      <div className="icon" style={{ background: bg, color: fg }}>
        <Icon size={22} />
      </div>
      <div>
        <div className="value">{value}</div>
        <div className="label">{label}</div>
      </div>
    </div>
  );
}

/* -------------------------------- Modal -------------------------------- */
export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal-box" style={wide ? { maxWidth: 720 } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------------------- ConfirmDialog ---------------------------- */
export function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}>
      <div className="modal-box" style={{ maxWidth: 400 }} role="alertdialog" aria-modal="true">
        <div className="modal-body text-center" style={{ paddingTop: 28 }}>
          <div className="confirm-icon-danger" style={{ margin: '0 auto 14px' }}>
            <AlertOctagon size={24} />
          </div>
          <h3 style={{ marginBottom: 8 }}>{title}</h3>
          {typeof message === 'string' ? <p>{message}</p> : <div style={{ color: 'var(--text-muted)', fontSize: '.92rem' }}>{message}</div>}
        </div>
        <div className="modal-foot" style={{ justifyContent: 'center' }}>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Please wait…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ EmptyState ------------------------------ */
export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, action }) {
  return (
    <div className="state-block">
      <div className="state-icon"><Icon size={26} /></div>
      <h4>{title}</h4>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

/* ----------------------------- LoadingState ----------------------------- */
export function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="state-block">
      <div className="spinner" />
      <p className="mb-0">{message}</p>
    </div>
  );
}

/* ------------------------------ ErrorState ------------------------------ */
export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state-block error">
      <div className="state-icon"><AlertOctagon size={24} /></div>
      <h4>{title}</h4>
      {message && <p>{message}</p>}
      {onRetry && <Button variant="outline" onClick={onRetry} icon={Loader2}>Try again</Button>}
    </div>
  );
}
