import React, { useState } from 'react';
import { Check, FlaskConical } from 'lucide-react';
import { Badge } from './ui';
import { confirmDose, fmtTime } from '../services/medicineService';
import { useToast } from '../context/ToastContext';

const TONE = { on_time: 'success', late: 'warning', missed: 'danger', upcoming: 'info', awaiting_confirmation: 'neutral' };
const LABEL = { on_time: 'On time', late: 'Late', missed: 'Missed', upcoming: 'Upcoming', awaiting_confirmation: 'Awaiting confirmation' };

/**
 * One scheduled dose. "Removal detected" (hardware evidence) and "Intake confirmed" (a person said so)
 * are shown separately: a drawer event is evidence of an interaction, not proof of swallowing.
 */
export default function ScheduleItem({ dose, timezone, patientName, onChange }) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const label = dose.status === 'awaiting_confirmation' && dose.overdue ? 'Overdue' : LABEL[dose.status];
  const tone = dose.status === 'awaiting_confirmation' && dose.overdue ? 'warning' : TONE[dose.status];

  const confirm = async () => {
    setBusy(true);
    try { await confirmDose(dose.id); push('success', 'Intake confirmed.'); onChange?.(); }
    catch (e) { push('error', e); } finally { setBusy(false); }
  };

  return (
    <div className="schedule-item">
      <div className="schedule-time">{fmtTime(dose.scheduledAt, timezone)}</div>
      <div className="schedule-body">
        <div className="med-name">{dose.medicineName}{patientName ? ` · ${patientName}` : ''}</div>
        <div className="med-sub">
          {dose.doseLabel || ''}{dose.drawerName ? ` | ${dose.drawerName} drawer` : ' | not linked to a box'}
          {dose.hardwareDetected ? ` | removal detected ${fmtTime(dose.hardwareDetectedAt, timezone)}` : ''}
          {dose.intakeConfirmed ? ` | intake confirmed (${dose.confirmationSource})` : ''}
        </div>
      </div>
      {dose.simulated && <Badge tone="info" icon={FlaskConical}>SIMULATED</Badge>}
      <Badge tone={tone || 'neutral'}>{label}</Badge>
      {!dose.intakeConfirmed && ['awaiting_confirmation', 'late'].includes(dose.status) && (
        <div className="schedule-actions">
          <button className="btn btn-ghost btn-icon" title="Confirm the patient took this dose" disabled={busy} onClick={confirm}><Check size={15} /></button>
        </div>
      )}
    </div>
  );
}
