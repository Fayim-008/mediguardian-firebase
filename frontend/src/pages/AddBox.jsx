import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import jsQR from 'jsqr';
import { Camera, Keyboard, ArrowLeft } from 'lucide-react';
import { Button, Input, Select } from '../components/ui';
import { pairBox, parsePairingText } from '../services/boxService';
import { getPatients, TIMEZONES } from '../services/patientService';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

/** Camera QR scanning with a manual-entry fallback. The QR carries only a box code + a one-time pairing code. */
function Scanner({ onFound }) {
  const videoRef = useRef(null); const [err, setErr] = useState(''); const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return undefined;
    let stream; let raf; let stopped = false;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot access the camera (camera access also needs HTTPS or localhost).');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = videoRef.current; v.srcObject = stream; await v.play();
        const tick = () => {
          if (stopped) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (code?.data) { const parsed = parsePairingText(code.data); if (parsed) { onFound(parsed); return; } }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) { setErr(e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser, or enter the codes manually.' : e.message); setOn(false); }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [on, onFound]);
  return (
    <div>
      {on ? <video ref={videoRef} playsInline muted style={{ width: '100%', maxWidth: 420, borderRadius: 12, background: '#000' }} /> :
        <Button variant="primary" icon={Camera} onClick={() => { setErr(''); setOn(true); }}>Scan QR code with camera</Button>}
      {err && <div className="error-text" style={{ marginTop: 10 }}>{err}</div>}
    </div>
  );
}

export default function AddBox() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const [codes, setCodes] = useState({ boxCode: params.get('code') || '', pairingCode: params.get('token') || '' });
  const [mode, setMode] = useState('existing');
  const [patientId, setPatientId] = useState('');
  const [np, setNp] = useState({ name: '', relationship: '', phone: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const { data: patients } = useApi(getPatients, []);
  const scanned = codes.boxCode && codes.pairingCode;
  useEffect(() => { if (patients && patients.length === 0) setMode('new'); }, [patients]);

  const submit = async () => {
    setError(''); setBusy(true);
    try {
      const body = { boxCode: codes.boxCode, pairingCode: codes.pairingCode, label: label || undefined };
      if (mode === 'existing') { if (!patientId) throw new Error('Choose which patient this box is for.'); body.patientId = patientId; }
      else { if (!np.name.trim()) throw new Error("Enter the patient's name."); body.newPatient = { name: np.name.trim(), relationship: np.relationship || undefined, phone: np.phone || undefined, timezone: np.timezone }; }
      const r = await pairBox(body);
      push('success', 'Box linked. It shows as “awaiting first connection” until it contacts the server.');
      navigate(`/app/patients/${r.patientId}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <button className="back-link flex-gap" style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: 18, color: 'var(--text-muted)' }} onClick={() => navigate('/app/boxes')}><ArrowLeft size={15} /> Back to My Boxes</button>
      <div className="page-head"><div><h1>Add a MediGuardian box</h1><p className="mb-0">Scan the QR code on the box, then choose the patient it is for.</p></div></div>
      <div className="two-col">
        <div className="card card-pad">
          <h3 style={{ fontSize: '.98rem' }}>1 · Identify the box</h3>
          {!scanned && <Scanner onFound={(p) => { setCodes(p); push('success', 'QR code read.'); }} />}
          {scanned && <p className="hint">Box <strong>…{codes.boxCode.slice(-9)}</strong> ready to link. <button className="muted-link" onClick={() => setCodes({ boxCode: '', pairingCode: '' })}>Scan a different one</button></p>}
          <hr className="divider" />
          <div className="flex-gap" style={{ marginBottom: 8 }}><Keyboard size={15} /><strong style={{ fontSize: '.86rem' }}>Camera not working? Type the codes printed under the QR</strong></div>
          <Input id="ab-code" label="Box code" placeholder="MG-XXXX-XXXX-XXXX" value={codes.boxCode} onChange={(e) => setCodes({ ...codes, boxCode: e.target.value })} />
          <Input id="ab-pair" label="Pairing code" placeholder="XXXX-XXXX-XXXX" value={codes.pairingCode} onChange={(e) => setCodes({ ...codes, pairingCode: e.target.value })} />
        </div>
        <div className="card card-pad">
          <h3 style={{ fontSize: '.98rem' }}>2 · Who is this box for?</h3>
          <div className="tabs-row">
            <button className={`tab-btn ${mode === 'existing' ? 'active' : ''}`} onClick={() => setMode('existing')} disabled={!patients?.length}>Existing patient</button>
            <button className={`tab-btn ${mode === 'new' ? 'active' : ''}`} onClick={() => setMode('new')}>New patient</button>
          </div>
          {mode === 'existing' ? (
            <Select id="ab-patient" label="Patient" placeholder="Choose a patient" options={(patients || []).map((p) => ({ value: p.id, label: p.name }))} value={patientId} onChange={(e) => setPatientId(e.target.value)} />
          ) : (
            <>
              <Input id="ab-name" label="Full name" placeholder="e.g. Rahela Begum (Mother)" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
              <Input id="ab-rel" label="Relationship" placeholder="Mother, Father…" value={np.relationship} onChange={(e) => setNp({ ...np, relationship: e.target.value })} />
              <Input id="ab-phone" label="Phone (optional)" value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} />
              <Select id="ab-tz" label="Time zone" options={[...new Set([np.timezone, ...TIMEZONES])]} value={np.timezone} onChange={(e) => setNp({ ...np, timezone: e.target.value })} />
              <p className="hint">You can add health and emergency details later from the patient page.</p>
            </>
          )}
          <Input id="ab-label" label="Box nickname (optional)" placeholder="e.g. Mum's bedroom" value={label} onChange={(e) => setLabel(e.target.value)} />
          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
          <Button variant="primary" className="btn-block" disabled={busy || !scanned} onClick={submit}>{busy ? 'Linking…' : 'Confirm & link box'}</Button>
        </div>
      </div>
    </>
  );
}
