import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button, Input } from '../components/ui';
import GoogleButton, { OrDivider } from '../components/GoogleButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { firebaseConfigError } from '../services/firebase';
import { EMAIL_RE, isUserCancel } from '../services/errors';
import { siteConfig, siteImages } from '../config/siteConfig';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(null);          // 'email' | 'google' | null
  const { login, loginWithGoogle, isAuthenticated, booting } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const goNext = () => navigate(location.state?.from || '/app/dashboard', { replace: true });

  if (!booting && isAuthenticated) return <Navigate to={location.state?.from || '/app/dashboard'} replace />;

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Please enter your email address.';
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'That email address is not valid.';
    if (!form.password) e.password = 'Please enter your password.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    if (!validate()) { push('error', 'Please fix the highlighted fields.'); return; }
    setBusy('email');
    try {
      const r = await login(form);
      push('success', `Welcome back, ${r.user.name?.split(' ')[0] || 'there'}!`);
      goNext();
    } catch (err) {
      push('error', err);
      if (['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(err?.code)) setForm((f) => ({ ...f, password: '' }));
    } finally { setBusy(null); }
  };

  const handleGoogle = async () => {
    if (busy) return;
    setBusy('google');
    try {
      const r = await loginWithGoogle();
      if (!r) return;                                  // redirected to Google; we finish when the page comes back
      push('success', r.isNewUser ? `Welcome to ${siteConfig.name}, ${r.user.name?.split(' ')[0] || ''}!` : `Welcome back, ${r.user.name?.split(' ')[0] || 'there'}!`);
      goNext();
    } catch (err) {
      if (isUserCancel(err)) push('info', 'Google sign-in was cancelled.');
      else push('error', err);
    } finally { setBusy(null); }
  };

  const disabled = !!busy || !!firebaseConfigError;

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <ShieldCheck size={40} color="#7FB2FF" style={{ marginBottom: 18 }} />
        <h2>Welcome back to {siteConfig.name}</h2>
        <p>Sign in to check today's schedule, review adherence, and keep every drawer stocked.</p>
      </div>
      <div className="auth-form-side">
        <div className="auth-box">
          <Link to="/" className="back-link"><ArrowLeft size={15} /> Back to home</Link>
          <div className="brand-row">
            <img src={siteImages.logo} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <strong>{siteConfig.name}</strong>
          </div>
          <h1>Welcome back</h1>
          <p className="sub">Log in to your guardian dashboard.</p>

          {firebaseConfigError && <div className="config-warning" role="alert">{firebaseConfigError}</div>}

          <GoogleButton onClick={handleGoogle} disabled={disabled} loading={busy === 'google'} />
          <OrDivider />

          <form onSubmit={handleSubmit} noValidate>
            <Input
              id="email" label="Email address" type="email" icon={Mail} autoComplete="email"
              placeholder="username@domain.com" value={form.email} error={errors.email}
              onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: undefined }); }}
              required
            />
            <Input
              id="password" label="Password" type={showPw ? 'text' : 'password'} icon={Lock} autoComplete="current-password"
              placeholder="Your password" value={form.password} error={errors.password}
              onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors({ ...errors, password: undefined }); }}
              suffix={(
                <button type="button" className="input-suffix" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password visibility">
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              )}
              required
            />
            <div className="flex-between" style={{ marginBottom: 20 }}>
              <span />
              <Link to="/forgot-password" className="muted-link">Forgot password?</Link>
            </div>
            <Button type="submit" variant="primary" className="btn-block" disabled={disabled}>
              {busy === 'email' ? 'Logging in…' : 'Login'}
            </Button>
          </form>

          <p className="auth-foot">Don't have an account? <Link to="/register">Create Account</Link></p>
        </div>
      </div>
    </div>
  );
}
