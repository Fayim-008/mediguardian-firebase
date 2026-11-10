import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, KeyRound, MailCheck } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { requestPasswordReset } from '../services/authService';
import { firebaseConfigError } from '../services/firebase';
import { EMAIL_RE } from '../services/errors';
import { useToast } from '../context/ToastContext';
import { siteConfig, siteImages } from '../config/siteConfig';

const COOLDOWN_S = 60;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const { push } = useToast();

  const startCooldown = () => {
    setCooldown(COOLDOWN_S);
    const t = setInterval(() => setCooldown((s) => { if (s <= 1) { clearInterval(t); return 0; } return s - 1; }), 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || cooldown) return;
    const v = email.trim();
    if (!v) { setError('Please enter your email address.'); push('error', 'Please enter your email address.'); return; }
    if (!EMAIL_RE.test(v)) { setError('That email address is not valid.'); push('error', 'That email address is not valid. Please check it.'); return; }
    setError(''); setLoading(true);
    try {
      await requestPasswordReset(v);
      setSentTo(v);
      startCooldown();
      push('success', 'If an account exists for this email, a reset link is on its way. Check your inbox and spam folder.');
    } catch (err) {
      push('error', err);
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <KeyRound size={40} color="#7FB2FF" style={{ marginBottom: 18 }} />
        <h2>Forgot your password?</h2>
        <p>No worries — enter your account email and we'll send you a reset link.</p>
      </div>
      <div className="auth-form-side">
        <div className="auth-box">
          <Link to="/login" className="back-link"><ArrowLeft size={15} /> Back to login</Link>
          <div className="brand-row">
            <img src={siteImages.logo} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <strong>{siteConfig.name}</strong>
          </div>
          <h1>Reset Password</h1>
          <p className="sub">Enter the email on your account. If you signed up with Google, use "Continue with Google" instead — Google manages that password.</p>
          {firebaseConfigError && <div className="config-warning" role="alert">{firebaseConfigError}</div>}

          {sentTo && (
            <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
              <MailCheck size={20} color="var(--success)" style={{ flexShrink: 0 }} />
              <span className="hint mb-0">Reset link sent to <strong>{sentTo}</strong> (if it has an account). The link expires in 1 hour.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <Input
              id="reset-email" label="Email address" type="email" icon={Mail} autoComplete="email" error={error}
              placeholder="username@domain.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} required
            />
            <Button type="submit" variant="primary" className="btn-block" disabled={loading || !!cooldown || !!firebaseConfigError}>
              {loading ? 'Sending…' : cooldown ? `Resend in ${cooldown}s` : sentTo ? 'Resend link' : 'Send reset link'}
            </Button>
          </form>

          <p className="auth-foot">Remembered it? <Link to="/login">Login</Link></p>
        </div>
      </div>
    </div>
  );
}
