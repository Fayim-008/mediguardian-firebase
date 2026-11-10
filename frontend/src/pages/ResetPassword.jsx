import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button, Input, LoadingState } from '../components/ui';
import { resetPassword, checkResetLink } from '../services/authService';
import { passwordProblem, friendlyError } from '../services/errors';
import { useToast } from '../context/ToastContext';
import { siteConfig, siteImages } from '../config/siteConfig';

/**
 * Only used if you set a custom action URL in Firebase (Authentication → Templates → Password reset →
 * Customize action URL = https://<your-site>/reset-password). By default Firebase shows its own reset page.
 */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const code = params.get('oobCode') || '';
  const [state, setState] = useState({ checking: true, email: '', linkError: '' });
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { push } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) { setState({ checking: false, email: '', linkError: 'This page needs the link from the password-reset email.' }); return; }
    checkResetLink(code)
      .then((email) => setState({ checking: false, email, linkError: '' }))
      .catch((e) => { const m = friendlyError(e); setState({ checking: false, email: '', linkError: m }); push('error', m); });
  }, [code, push]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const er = {};
    const p = passwordProblem(form.newPassword); if (p) er.newPassword = p;
    if (form.newPassword !== form.confirmPassword) er.confirmPassword = 'Passwords do not match.';
    setErrors(er);
    if (Object.keys(er).length) { push('error', Object.values(er)[0]); return; }
    setLoading(true);
    try {
      await resetPassword({ code, ...form });
      push('success', 'Password updated. Please log in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) { push('error', err); } finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <ShieldCheck size={40} color="#7FB2FF" style={{ marginBottom: 18 }} />
        <h2>Choose a new password</h2>
        <p>At least 8 characters, with letters and numbers.</p>
      </div>
      <div className="auth-form-side">
        <div className="auth-box">
          <Link to="/login" className="back-link"><ArrowLeft size={15} /> Back to login</Link>
          <div className="brand-row">
            <img src={siteImages.logo} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <strong>{siteConfig.name}</strong>
          </div>
          <h1>Reset Password</h1>
          {state.checking ? <LoadingState message="Checking your link…" /> : state.linkError ? (
            <>
              <div className="config-warning" role="alert">{state.linkError}</div>
              <Link to="/forgot-password" className="btn btn-primary btn-block">Request a new link</Link>
            </>
          ) : (
            <>
              <p className="sub">New password for <strong>{state.email}</strong>.</p>
              <form onSubmit={handleSubmit} noValidate>
                <Input id="rp-new" label="New Password" type={showPw ? 'text' : 'password'} icon={Lock} autoComplete="new-password"
                  placeholder="At least 8 characters" value={form.newPassword} error={errors.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  suffix={(
                    <button type="button" className="input-suffix" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password visibility">
                      {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  )} required />
                <Input id="rp-confirm" label="Confirm New Password" type={showPw ? 'text' : 'password'} icon={Lock} autoComplete="new-password"
                  placeholder="Re-enter password" value={form.confirmPassword} error={errors.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
                <Button type="submit" variant="primary" className="btn-block" disabled={loading}>{loading ? 'Saving…' : 'Save new password'}</Button>
              </form>
            </>
          )}
          <p className="auth-foot">Remembered it? <Link to="/login">Login</Link></p>
        </div>
      </div>
    </div>
  );
}
