import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Package, Plus, FlaskConical } from 'lucide-react';
import { Button, EmptyState, ConfirmDialog, LoadingState, ErrorState, Modal } from '../components/ui';
import BoxCard from '../components/BoxCard';
import { getBoxes, unpairBox, createSimulatedBox, getBoxHistory } from '../services/boxService';
import { fmtDateTime } from '../services/medicineService';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

export default function Boxes() {
  const navigate = useNavigate();
  const { demoMode } = useOutletContext();
  const { push } = useToast();
  const [toUnpair, setToUnpair] = useState(null);
  const [handover, setHandover] = useState(null);
  const [history, setHistory] = useState(null);
  const { data: boxes, error, loading, reload, stale } = useApi(getBoxes, [], { live: true });
  if (loading && !boxes) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const doUnpair = async () => {
    try { const r = await unpairBox(toUnpair.id); setHandover(r); push('info', 'Box unpaired.'); } catch (e) { push('error', e); }
    setToUnpair(null); reload();
  };
  const addSim = async () => {
    try { const r = await createSimulatedBox(); navigate(`/app/add-box?code=${encodeURIComponent(r.boxCode)}&token=${encodeURIComponent(r.pairingCode)}`); } catch (e) { push('error', e); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>My Boxes</h1><p className="mb-0">Every MediGuardian box linked to your account, and what each one last reported.</p></div>
        <div className="actions">
          <Button variant="primary" icon={Plus} onClick={() => navigate('/app/add-box')}>Add Box (scan QR)</Button>
          {demoMode && <Button variant="outline" icon={FlaskConical} onClick={addSim}>Add simulated box</Button>}
        </div>
      </div>
      {stale && <div className="card card-pad hint" style={{ marginBottom: 14 }}>Live updates are disconnected — what you see may be out of date. Reconnecting…</div>}
      {boxes.length === 0 ? (
        <div className="card list-panel-empty"><EmptyState icon={Package} title="No boxes yet" message="Scan the QR code on your MediGuardian box to link it to a patient."
          action={<Button variant="primary" icon={Plus} onClick={() => navigate('/app/add-box')}>Scan QR code</Button>} /></div>
      ) : boxes.map((b) => (
        <BoxCard key={b.id} box={b} demoMode={demoMode} onChange={reload} actions={(<>
          <Button size="sm" variant="outline" onClick={() => navigate(`/app/patients/${b.patientId}`)}>Open patient</Button>
          <Button size="sm" variant="outline" onClick={async () => setHistory({ box: b, rows: await getBoxHistory(b.id) })}>Ownership history</Button>
          <Button size="sm" variant="danger" onClick={() => setToUnpair(b)}>Unpair / transfer</Button>
        </>)} />
      ))}
      <ConfirmDialog open={!!toUnpair} title="Unpair this box?" confirmLabel="Unpair"
        message="The box stops being linked to this patient and its drawers are cleared. Past doses stay in the history. You'll get a one-time code to hand the box to someone else."
        onConfirm={doUnpair} onCancel={() => setToUnpair(null)} />
      <Modal open={!!handover} onClose={() => setHandover(null)} title="Box unpaired" footer={<Button variant="primary" onClick={() => setHandover(null)}>Done</Button>}>
        <p>To give this box to another account, they scan its QR code or enter the box code with this pairing code (valid {handover?.expiresInHours} hours, single use):</p>
        <p style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}><strong>{handover?.transferPairingCode}</strong></p>
        <p className="hint">Box code: {handover?.boxCode}</p>
      </Modal>
      <Modal open={!!history} onClose={() => setHistory(null)} title="Ownership & pairing history" footer={<Button variant="primary" onClick={() => setHistory(null)}>Close</Button>}>
        {history?.rows.map((r, i) => <div key={i} className="hint">{fmtDateTime(r.created_at)} — {r.action.replace(/_/g, ' ')}{r.note ? ` (${r.note})` : ''}</div>)}
      </Modal>
    </>
  );
}
