import React, { useState } from 'react';
import { Trash2, ShieldAlert, KeyRound, MailWarning, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, ConfirmDialog, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useDemoMode } from '../hooks/useDemoMode';
import { useToast } from '../context/ToastContext';
import { updateProfile, resendVerificationEmail, currentSignInMethod } from '../services/authService';
import { PHONE_RE, passwordProblem, isUserCancel } from '../services/errors';

export default function Settings() {
  const { user, logout, setUser, changePassword, deleteAccount } = useAuth();
  const { demoMode, toggleDemoMode, devToolsAvailable } = useDemoMode();
  const { push } = useToast();
  const navigate = useNavigate();
  const method = currentSignInMethod() || user?.provider;
  const isGoogle = method === 'google.com';
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [pErr, setPErr] = useState({});
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErr, setPwErr] = useState({});
  const [del, setDel] = useState({ open: false, password: '' });
  const [busy, setBusy] = useState('');

  const dirty = profile.name.trim() !== (user?.name || '') || profile.phone.trim() !== (user?.phone || '');

  const saveProfile = async () => {
    const e = {};
    if (!profile.name.trim()) e.name = 'Name cannot be empty.';
    if (profile.phone.trim() && !PHONE_RE.test(profile.phone.trim())) e.phone = 'Use digits only (a leading + is allowed).';
    setPErr(e);
    if (Object.keys(e).length) return push('error', Object.values(e)[0]);
    if (!dirty) return push('info', 'Nothing to save — no changes.');
    setBusy('profile');
    try { setUser(await updateProfile(profile)); push('success', 'Your profile was updated.'); }
    catch (err) { push('error', err); } finally { setBusy(''); }
  };

  const savePw = async () => {
    const e = {};
    if (!pw.currentPassword) e.currentPassword = 'Enter your current password.';
    const p = passwordProblem(pw.newPassword); if (p) e.newPassword = p;
    if (!e.newPassword && pw.newPassword === pw.currentPassword) e.newPassword = 'The new password must be different.';
    if (pw.newPassword !== pw.confirm) e.confirm = 'New passwords do not match.';
    setPwErr(e);
    if (Object.keys(e).length) return push('error', Object.values(e)[0]);
    setBusy('pw');
    try {
      await changePassword(pw);
      push('success', 'Password changed. You were signed out on all devices — please log in again.');
      navigate('/login', { replace: true });
    } catch (err) {
      if (['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(err?.code)) {
        setPwErr({ currentPassword: 'Current password is incorrect.' });
        push('error', 'Your current password is incorrect.');
      } else push('error', err);
    } finally { setBusy(''); }
  };

  const resend = async () => {
    setBusy('verify');
    try { await resendVerificationEmail(); push('success', `Verification email sent to ${user.email}.`); }
    catch (err) { push('error', err); } finally { setBusy(''); }
  };

  const doDelete = async () => {
    if (!isGoogle && !del.password) return push('error', 'Enter your password to confirm.');
    setBusy('delete');
    try {
      await deleteAccount(del.password);
      setDel({ open: false, password: '' });
      push('info', 'Your account and all its data were deleted. Goodbye!');
      navigate('/', { replace: true });
    } catch (err) {
      if (isUserCancel(err)) push('info', 'Deletion cancelled.');
      else if (['auth/invalid-credential', 'auth/wrong-password'].includes(err?.code)) push('error', 'Password is incorrect. Your account was NOT deleted.');
      else push('error', err);
    } finally { setBusy(''); }
  };

  const doLogout = async () => {
    setBusy('logout');
    try { await logout(); push('info', 'You have been logged out.'); navigate('/login', { replace: true }); }
    finally { setBusy(''); }
  };

  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p className="mb-0">Your account, security and data.</p></div></div>
      <div className="two-col">
        <div>
          <div className="card card-pad" style={{ marginBottom: 22 }}>
            <div className="flex-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: '.98rem', margin: 0 }}>Account</h3>
              <Badge tone="neutral">{isGoogle ? 'Signed in with Google' : 'Email & password'}</Badge>
            </div>
            <Input id="s-name" label="Name" value={profile.name} error={pErr.name} onChange={(e) => { setProfile({ ...profile, name: e.target.value }); setPErr({}); }} />
            <Input id="s-email" label="Email" type="email" value={user?.email || ''} readOnly disabled
              hint={isGoogle ? 'Managed by your Google account.' : 'Your sign-in email (managed by Firebase).'} />
            {!user?.emailVerified && !isGoogle ? (
              <div className="config-warning flex-gap" style={{ flexWrap: 'wrap' }}>
                <MailWarning size={16} /> Your email is not verified yet.
                <Button size="sm" variant="outline" disabled={busy === 'verify'} onClick={resend}>{busy === 'verify' ? 'Sending…' : 'Resend verification email'}</Button>
              </div>
            ) : (
              <p className="hint flex-gap"><BadgeCheck size={14} color="var(--success)" /> Email verified</p>
            )}
            <Input id="s-phone" label="Phone" placeholder="+8801XXXXXXXXX" inputMode="tel" value={profile.phone} error={pErr.phone}
              onChange={(e) => { setProfile({ ...profile, phone: e.target.value }); setPErr({}); }} />
            <div className="flex-gap" style={{ flexWrap: 'wrap' }}>
              <Button variant="primary" disabled={!!busy} onClick={saveProfile}>{busy === 'profile' ? 'Saving…' : 'Save changes'}</Button>
              <Button variant="outline" disabled={!!busy} onClick={doLogout}>{busy === 'logout' ? 'Logging out…' : 'Log out'}</Button>
            </div>
          </div>

          <div className="card card-pad" style={{ marginBottom: 22 }}>
            <div className="flex-gap" style={{ marginBottom: 12 }}><KeyRound size={16} /><h3 style={{ fontSize: '.98rem', margin: 0 }}>Change password</h3></div>
            {isGoogle ? (
              <p className="mb-0">You sign in with Google, so there is no MediGuardian password. Change it in your Google account.</p>
            ) : (
              <>
                <Input id="s-cur" label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} error={pwErr.currentPassword}
                  onChange={(e) => { setPw({ ...pw, currentPassword: e.target.value }); setPwErr({}); }} />
                <Input id="s-new" label="New password (min 8, letters + numbers)" type="password" autoComplete="new-password" value={pw.newPassword} error={pwErr.newPassword}
                  onChange={(e) => { setPw({ ...pw, newPassword: e.target.value }); setPwErr({}); }} />
                <Input id="s-conf" label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} error={pwErr.confirm}
                  onChange={(e) => { setPw({ ...pw, confirm: e.target.value }); setPwErr({}); }} />
                <Button variant="outline" disabled={!!busy} onClick={savePw}>{busy === 'pw' ? 'Changing…' : 'Change password'}</Button>
                <p className="hint" style={{ marginTop: 8 }}>You'll be signed out on all devices.</p>
              </>
            )}
          </div>

          {devToolsAvailable && (
            <div className="card card-pad">
              <h3 style={{ fontSize: '.98rem', marginBottom: 6 }}>Simulator (development)</h3>
              <p style={{ marginBottom: 14 }}>Shows simulator controls on SIMULATED boxes so you can demonstrate MediGuardian without hardware. They never act on real boxes, and every simulated record is labelled.</p>
              <Button variant={demoMode ? 'primary' : 'outline'} onClick={toggleDemoMode}>Simulator is {demoMode ? 'ON' : 'OFF'} — tap to turn {demoMode ? 'off' : 'on'}</Button>
            </div>
          )}
        </div>
        <div>
          <div className="card card-pad" style={{ marginBottom: 22, borderColor: 'var(--danger-100)' }}>
            <div className="flex-gap" style={{ marginBottom: 8 }}><Trash2 size={16} color="var(--danger)" /><h3 style={{ fontSize: '.94rem', margin: 0 }}>Delete my account</h3></div>
            <p>Permanently deletes your account, the patients only you manage (with their medicines and history) and signs you out. Your boxes are unpaired, not destroyed.</p>
            <Button variant="danger" disabled={!!busy} onClick={() => setDel({ open: true, password: '' })}>Delete account…</Button>
          </div>
          <div className="card card-pad">
            <div className="flex-gap" style={{ marginBottom: 8 }}><ShieldAlert size={16} color="var(--warning)" /><h3 style={{ fontSize: '.94rem', margin: 0 }}>About your data</h3></div>
            <p className="mb-0">Sign-in is handled by Firebase Authentication; your passwords never reach the MediGuardian server. Patients, medicines and box data are stored on the MediGuardian server (MongoDB). MediGuardian records schedules and drawer activity; it is not a substitute for professional medical care and never changes prescriptions.</p>
          </div>
        </div>
      </div>
      <ConfirmDialog open={del.open} title="Delete your account?" confirmLabel={busy === 'delete' ? 'Deleting…' : 'Delete everything'} loading={busy === 'delete'}
        onConfirm={doDelete} onCancel={() => busy !== 'delete' && setDel({ open: false, password: '' })}
        message={isGoogle
          ? <p>For your security, a Google window will ask you to confirm your account. This cannot be undone.</p>
          : <><p>Enter your password to confirm. This cannot be undone.</p><Input id="s-del" type="password" autoComplete="current-password" placeholder="Password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></>} />
    </>
  );
}
