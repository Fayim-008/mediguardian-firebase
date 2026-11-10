import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User, Phone, Eye, EyeOff, HeartHandshake } from 'lucide-react';
import { Button, Input } from '../components/ui';
import GoogleButton, { OrDivider } from '../components/GoogleButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { firebaseConfigError } from '../services/firebase';
import { EMAIL_RE, PHONE_RE, passwordProblem, isUserCancel } from '../services/errors';
import { siteConfig, siteImages } from '../config/siteConfig';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(null);
  const { register, loginWithGoogle, isAuthenticated, booting } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  if (!booting && isAuthenticated) return <Navigate to="/app/dashboard" replace />;

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Please enter your full name.';
    else if (form.name.trim().length > 100) e.name = 'Name is too long (100 characters max).';
    if (!form.email.trim()) e.email = 'Please enter your email address.';
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'That email address is not valid.';
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) e.phone = 'Use digits only (a leading + is allowed), e.g. +8801712345678.';
    const pw = passwordProblem(form.password);
    if (pw) e.password = pw;
    if (!form.confirmPassword) e.confirmPassword = 'Please re-enter your password.';
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    if (!validate()) { push('error', 'Please fix the highlighted fields.'); return; }
    setBusy('email');
    try {
      const r = await register(form);
      push('success', `Welcome to ${siteConfig.name}, ${form.name.trim().split(' ')[0]}! Your account is ready.`);
      if (r.verificationSent) push('info', `We sent a verification link to ${form.email.trim()}. Please confirm your email.`);
      else push('warning', 'Your account is ready, but the verification email could not be sent. You can resend it from Settings.');
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      push('error', err);
      if (err?.code === 'auth/email-already-in-use') setErrors((x) => ({ ...x, email: 'This email is already registered.' }));
      if (err?.code === 'auth/weak-password' || err?.code === 'auth/password-does-not-meet-requirements') setErrors((x) => ({ ...x, password: 'Choose a stronger password.' }));
    } finally { setBusy(null); }
  };

  const handleGoogle = async () => {
    if (busy) return;
    setBusy('google');
    try {
      const r = await loginWithGoogle();
      if (!r) return;
      push('success', r.isNewUser ? `Welcome to ${siteConfig.name}, ${r.user.name?.split(' ')[0] || ''}! Your account is ready.` : 'You already had an account — signed you in.');
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      if (isUserCancel(err)) push('info', 'Google sign-up was cancelled.');
      else push('error', err);
    } finally { setBusy(null); }
  };

  const disabled = !!busy || !!firebaseConfigError;

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <HeartHandshake size={40} color="#7FB2FF" style={{ marginBottom: 18 }} />
        <h2>Caring Beyond Distance</h2>
        <p>Create your free guardian account and start managing medicines for the people who matter most.</p>
      </div>
      <div className="auth-form-side">
        <div className="auth-box">
          <Link to="/" className="back-link"><ArrowLeft size={15} /> Back to home</Link>
          <div className="brand-row">
            <img src={siteImages.logo} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <strong>{siteConfig.name}</strong>
          </div>
          <h1>Create your account</h1>
          <p className="sub">It only takes a minute.</p>

          {firebaseConfigError && <div className="config-warning" role="alert">{firebaseConfigError}</div>}

          <GoogleButton onClick={handleGoogle} disabled={disabled} loading={busy === 'google'} label="Sign up with Google" />
          <OrDivider />

          <form onSubmit={handleSubmit} noValidate>
            <Input id="name" label="Full Name" icon={User} placeholder="Enter your name" autoComplete="name"
              value={form.name} error={errors.name} onChange={set('name')} required />
            <Input id="reg-email" label="Email Address" type="email" icon={Mail} placeholder="username@domain.com" autoComplete="email"
              value={form.email} error={errors.email} onChange={set('email')} required />
            <Input id="phone" label="Phone Number (optional)" icon={Phone} placeholder="+8801XXXXXXXXX" autoComplete="tel" inputMode="tel"
              value={form.phone} error={errors.phone} onChange={set('phone')} />
            <Input
              id="reg-password" label="Password" type={showPw ? 'text' : 'password'} icon={Lock} autoComplete="new-password"
              placeholder="At least 8 characters, letters + numbers" value={form.password} error={errors.password} onChange={set('password')}
              suffix={(
                <button type="button" className="input-suffix" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password visibility">
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              )}
              required
            />
            <Input id="confirm-password" label="Confirm Password" type={showPw ? 'text' : 'password'} icon={Lock} autoComplete="new-password"
              placeholder="Re-enter password" value={form.confirmPassword} error={errors.confirmPassword} onChange={set('confirmPassword')} required />
            <Button type="submit" variant="primary" className="btn-block" disabled={disabled}>
              {busy === 'email' ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>

          <p className="auth-foot">Already have an account? <Link to="/login">Login</Link></p>
        </div>
      </div>
    </div>
  );
}
