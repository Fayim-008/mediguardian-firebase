import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Button, Input } from '../components/ui';
import { adminRegisterBoxes } from '../services/boxService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function QR({ text }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) QRCode.toCanvas(ref.current, text, { width: 180, margin: 1 }); }, [text]);
  return <canvas ref={ref} />;
}

/** Manufacturing screen (admin accounts only). Secrets are shown ONCE and are not stored in plaintext anywhere. */
export default function AdminBoxes() {
  const { user } = useAuth(); const { push } = useToast();
  const [count, setCount] = useState(1); const [label, setLabel] = useState(''); const [out, setOut] = useState([]); const [busy, setBusy] = useState(false);
  if (user?.role !== 'admin') return <Navigate to="/app/dashboard" replace />;
  const go = async () => { setBusy(true); try { setOut((await adminRegisterBoxes(Number(count), label || undefined)).boxes); } catch (e) { push('error', e); } finally { setBusy(false); } };
  return (
    <>
      <div className="page-head"><div><h1>Box registration</h1><p className="mb-0">Register new boxes at manufacturing time. Print the QR label; flash the device token into that box's firmware. Both are shown only once.</p></div></div>
      <div className="card card-pad" style={{ maxWidth: 480, marginBottom: 20 }}>
        <Input id="ad-count" label="How many boxes" type="number" min="1" max="50" value={count} onChange={(e) => setCount(e.target.value)} />
        <Input id="ad-label" label="Batch label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button variant="primary" disabled={busy} onClick={go}>{busy ? 'Registering…' : 'Register boxes'}</Button>
      </div>
      {out.map((b) => (
        <div key={b.boxId} className="card card-pad flex-gap" style={{ marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <QR text={b.qrUrl} />
          <div style={{ minWidth: 260 }}>
            <p className="mb-0"><strong>Box code:</strong> {b.boxCode}</p>
            <p className="mb-0"><strong>Pairing code (under QR):</strong> {b.pairingCode}</p>
            <p className="mb-0" style={{ wordBreak: 'break-all' }}><strong>Device token (firmware only, never print):</strong> {b.deviceToken}</p>
            <p className="hint">Pairing valid {Math.round(b.expiresInHours / 24)} days, single use.</p>
          </div>
        </div>))}
    </>
  );
}
