import React, { useState } from 'react';
import { Package, FlaskConical, Wifi, WifiOff, Wrench, BellRing, RefreshCw, Radio } from 'lucide-react';
import { Badge, Button } from './ui';
import { CONNECTION_LABEL, CONNECTION_TONE } from '../services/hardwareService';
import { simulate, sendBoxCommand } from '../services/boxService';
import { fmtDateTime } from '../services/medicineService';
import { useToast } from '../context/ToastContext';

const SCENARIOS = [
  ['power_on', 'Power on'], ['on_time_dose', 'Dose on time'], ['late_dose', 'Late dose'], ['missed_dose', 'Missed dose'],
  ['drawer_open_no_hand', 'Drawer open, no hand'], ['refill_mode', 'Refill mode'], ['duplicate_event', 'Duplicate event'],
  ['go_offline', 'Go offline'], ['reconnect', 'Reconnect'],
];
const SYNC = { synced: ['success', 'Settings synced'], pending: ['warning', 'Waiting for the box to confirm'], failed: ['danger', 'Box failed to apply'], none: ['neutral', 'No settings yet'] };

/** Everything shown here is what the box last REPORTED to the server — never assumed. */
export default function BoxCard({ box, demoMode, onChange, actions }) {
  const { push } = useToast();
  const [slot, setSlot] = useState(1);
  const [busy, setBusy] = useState(false);
  const c = box.connection;
  const [syncTone, syncLabel] = SYNC[box.config.sync] || SYNC.none;

  const command = async (cmd, label) => {
    setBusy(true);
    try { const r = await sendBoxCommand(box.id, cmd); push(r.delivered ? 'success' : 'warning', r.delivered ? `${label}: sent to the box.` : r.message); }
    catch (e) { push('error', e); } finally { setBusy(false); }
  };

  const run = async (scenario) => {
    setBusy(true);
    try { await simulate(box.id, scenario, slot); push('success', `Simulated: ${scenario.replace(/_/g, ' ')}`); onChange?.(); }
    catch (e) { push('error', e); } finally { setBusy(false); }
  };

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="flex-gap">
          <div className="med-icon"><Package size={19} /></div>
          <div>
            <strong>{box.label || 'MediGuardian box'}</strong>{' '}
            {box.simulated && <Badge tone="info" icon={FlaskConical}>SIMULATED — not real hardware</Badge>}
            <div className="hint mb-0">…{box.boxCode.slice(-9)}{box.patientName ? ` · ${box.patientName}` : ''}{box.firmwareVersion ? ` · fw ${box.firmwareVersion}` : ''}</div>
          </div>
        </div>
        <div className="flex-gap" style={{ flexWrap: 'wrap' }}>
          <Badge tone={CONNECTION_TONE[c.state]} icon={c.state === 'online' ? Wifi : WifiOff}>{CONNECTION_LABEL[c.state] || c.state}</Badge>
          {box.live && <Badge tone="success" icon={Radio}>Live link</Badge>}
          {box.refillMode === true && c.state === 'online' && <Badge tone="warning" icon={Wrench}>Refill in progress</Badge>}
          <Badge tone={syncTone}>{syncLabel}</Badge>
        </div>
      </div>
      <p className="hint" style={{ margin: '10px 0 0' }}>
        {c.lastSeenAt ? `Last contact ${fmtDateTime(c.lastSeenAt)}` : 'The box has not contacted the server yet.'}
        {c.state === 'offline' && ' — reminders still run on the box itself; new events appear when it reconnects.'}
        {box.config.lastSyncedAt ? ` · settings v${box.config.deviceReportedVersion ?? '?'} confirmed ${fmtDateTime(box.config.lastSyncedAt)}` : ''}
        {box.config.error ? ` · error: ${box.config.error}` : ''}
      </p>
      <div className="flex-gap" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {box.drawers.map((d) => <Badge key={d.id} tone="neutral">{d.slot}. {d.name}</Badge>)}
      </div>
      {box.status === 'paired' && !box.simulated && (
        <div className="flex-gap" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <Button size="sm" variant="outline" icon={BellRing} disabled={busy || !box.live} onClick={() => command('ring', 'Ring')}
            title={box.live ? 'Beep the buzzer so the patient can find the box' : 'Needs a live connection from the box'}>Ring box</Button>
          <Button size="sm" variant="outline" icon={RefreshCw} disabled={busy || !box.live} onClick={() => command('sync_config', 'Sync')}>Sync now</Button>
          {!box.live && <span className="hint mb-0">Live controls appear when the box is connected.</span>}
        </div>
      )}
      {actions && <div className="flex-gap" style={{ marginTop: 12, flexWrap: 'wrap' }}>{actions}</div>}
      {demoMode && box.simulated && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
          <div className="flex-gap" style={{ flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '.82rem' }}>Simulator</strong>
            <select className="input" style={{ width: 'auto', maxWidth: '100%' }} value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
              {box.drawers.map((d) => <option key={d.id} value={d.slot}>Drawer {d.slot} · {d.name}</option>)}
            </select>
            {SCENARIOS.map(([k, l]) => <Button key={k} size="sm" variant="outline" disabled={busy} onClick={() => run(k)}>{l}</Button>)}
          </div>
        </div>
      )}
    </div>
  );
}
