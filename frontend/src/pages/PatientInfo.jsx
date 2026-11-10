import React, { useState } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, MapPin, Droplet, AlertTriangle, ShieldAlert, Stethoscope,
  Pill, RefreshCw, FileBarChart, Edit2, Clock, Package,
} from 'lucide-react';
import { Button, Badge, EmptyState, ConfirmDialog, LoadingState, ErrorState } from '../components/ui';
import MedicineCard from '../components/MedicineCard';
import PatientFormModal from '../components/PatientFormModal';
import ScheduleItem from '../components/ScheduleCard';
import BoxCard from '../components/BoxCard';
import { getPatientById, calculateAge, getInitials, getPatientBoxes } from '../services/patientService';
import { getMedicines, deleteMedicine, toggleMedicineActive, getTodaySchedule, fmtDateTime } from '../services/medicineService';
import { buildReport } from '../services/reportService';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

export default function PatientInfo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { demoMode } = useOutletContext();
  const { push } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [medToDelete, setMedToDelete] = useState(null);

  const { data, error, loading, reload, stale } = useApi(
    () => Promise.all([getPatientById(id), getMedicines(id), buildReport(id, '7D'), getTodaySchedule(id), getPatientBoxes(id)]), [id], { live: true });
  if (loading && !data) return <LoadingState />;
  if (error) {
    return (
      <EmptyState icon={ShieldAlert} title="Patient not found" message="This patient may have been removed, or you don't have access."
        action={<Button variant="primary" onClick={() => navigate('/app/patients')}>Back to Patients</Button>} />
    );
  }
  const [patient, medicines, report, today, boxes] = data;

  const age = calculateAge(patient.dob);

  const bump = reload;
  const handleDeleteMed = async () => {
    if (!medToDelete) return;
    try { await deleteMedicine(medToDelete.id); } catch (e) { push('error', e); }
    setMedToDelete(null);
    reload();
  };

  return (
    <>
      <button className="back-link flex-gap" style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: 18, color: 'var(--text-muted)', fontWeight: 500 }} onClick={() => navigate('/app/patients')}>
        <ArrowLeft size={15} /> Back to Patients
      </button>

      <div className="two-col">
        <div>
          <div className="card card-pad" style={{ marginBottom: 22 }}>
            <div className="flex-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div className="flex-gap">
                <div className="patient-avatar" style={{ width: 64, height: 64, fontSize: '1.2rem' }}>{getInitials(patient.name)}</div>
                <div>
                  <h2 style={{ marginBottom: 2 }}>{patient.name}</h2>
                  <p className="mb-0">{patient.relationship}{age ? ` · ${age} years old` : ''} · {patient.gender}</p>
                  <Badge tone={patient.status === 'Active' ? 'success' : 'neutral'}>{patient.status}</Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" icon={Edit2} onClick={() => setEditOpen(true)}>Edit Patient</Button>
            </div>

            <hr className="divider" />

            <div className="form-grid">
              <div>
                <div className="hint" style={{ marginBottom: 4 }}><Phone size={13} /> Phone</div>
                <p className="mb-0">{patient.phone || '—'}</p>
              </div>
              <div>
                <div className="hint" style={{ marginBottom: 4 }}><Mail size={13} /> Email</div>
                <p className="mb-0">{patient.email || '—'}</p>
              </div>
              <div>
                <div className="hint" style={{ marginBottom: 4 }}><MapPin size={13} /> Address</div>
                <p className="mb-0">{patient.address || '—'}</p>
              </div>
              <div>
                <div className="hint" style={{ marginBottom: 4 }}><Droplet size={13} /> Blood Group</div>
                <p className="mb-0">{patient.bloodGroup || '—'}</p>
              </div>
              <div>
                <div className="hint" style={{ marginBottom: 4 }}><AlertTriangle size={13} /> Conditions</div>
                <p className="mb-0">{patient.conditions || 'None recorded'}</p>
              </div>
              <div>
                <div className="hint" style={{ marginBottom: 4 }}><ShieldAlert size={13} /> Allergies</div>
                <p className="mb-0">{patient.allergies || 'None known'}</p>
              </div>
              <div>
                <div className="hint" style={{ marginBottom: 4 }}>Emergency Contact</div>
                <p className="mb-0">{patient.emergencyName || '—'} {patient.emergencyPhone ? `(${patient.emergencyPhone})` : ''}</p>
              </div>
              <div>
                <div className="hint" style={{ marginBottom: 4 }}><Stethoscope size={13} /> Doctor</div>
                <p className="mb-0">{patient.doctorName || 'Not set'} {patient.doctorContact ? `· ${patient.doctorContact}` : ''}</p>
              </div>
            </div>
            {patient.notes && (
              <>
                <div className="hint" style={{ marginBottom: 4 }}>Notes</div>
                <p className="mb-0">{patient.notes}</p>
              </>
            )}
          </div>

          <div className="card list-panel" style={{ marginBottom: 22 }}>
            <div className="section-card-head"><h3>Today's Schedule</h3></div>
            {today.length === 0 ? <p className="hint" style={{ padding: 16 }}>No doses scheduled today.</p> :
              today.map((d) => <ScheduleItem key={d.id} dose={d} timezone={patient.timezone} onChange={reload} />)}
          </div>

          <div className="card card-pad" style={{ marginBottom: 22 }}>
            <div className="flex-between" style={{ marginBottom: 10 }}><h3 style={{ fontSize: '.98rem', margin: 0 }}>Medicine box</h3>
              <Button size="sm" variant="outline" icon={Package} onClick={() => navigate('/app/add-box')}>Add box</Button></div>
            {stale && <p className="hint">Live updates are disconnected — status may be out of date.</p>}
            {boxes.length === 0 ? <p className="hint mb-0">No box is linked to {patient.name} yet. Scan the QR code on a box to link one.</p> :
              boxes.map((b) => <BoxCard key={b.id} box={b} demoMode={demoMode} onChange={reload} />)}
          </div>

          <div className="card list-panel">
            <div className="section-card-head">
              <h3>Current Medicines</h3>
              <button className="muted-link" onClick={() => navigate('/app/set-medicine', { state: { patientId: patient.id } })}>+ Set Medicine</button>
            </div>
            <div style={{ padding: medicines.length ? 16 : 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {medicines.length === 0 ? (
                <EmptyState icon={Pill} title="No medicines set yet" message="Set a medicine schedule for this patient." />
              ) : (
                medicines.map((m) => (
                  <MedicineCard
                    key={m.id}
                    medicine={m}
                    onEdit={() => navigate('/app/set-medicine', { state: { patientId: patient.id, editMedicineId: m.id } })}
                    onDelete={() => setMedToDelete(m)}
                    onToggleActive={async () => { try { await toggleMedicineActive(m); reload(); } catch (e) { push('error', e); } }}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card card-pad" style={{ marginBottom: 22 }}>
            <h3 style={{ marginBottom: 14, fontSize: '.98rem' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button variant="secondary" icon={Pill} className="btn-block" onClick={() => navigate('/app/set-medicine', { state: { patientId: patient.id } })}>Set Medicine</Button>
              <Button variant="outline" icon={RefreshCw} className="btn-block" onClick={() => navigate('/app/refill', { state: { patientId: patient.id } })}>Refill Medicine</Button>
              <Button variant="outline" icon={FileBarChart} className="btn-block" onClick={() => navigate('/app/reports', { state: { patientId: patient.id } })}>Check Report</Button>
            </div>
          </div>

          <div className="card card-pad">
            <h3 style={{ marginBottom: 4, fontSize: '.98rem' }}>7-Day Adherence</h3>
            <p className="hint mb-0" style={{ marginBottom: 14 }}>{report.percentages.adherence}% of resolved doses completed (on time or late). {report.totals.awaiting + report.totals.upcoming} not yet resolved.</p>
            <div className="adherence-bar" style={{ height: 10, marginBottom: 18 }}>
              <div className="adherence-bar-fill" style={{ width: `${report.percentages.adherence}%` }} />
            </div>
            <h3 style={{ marginBottom: 10, fontSize: '.9rem' }}>Recent Activity</h3>
            {report.recentActivity.length === 0 ? (
              <p className="hint">No activity recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {report.recentActivity.slice(0, 6).map((e) => (
                  <div key={e.id} className="flex-gap" style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                    <Clock size={13} />
                    <span>{e.medicineName} · {fmtDateTime(e.scheduledAt, patient.timezone)} —</span>
                    <Badge tone={e.status === 'on_time' ? 'success' : e.status === 'late' ? 'warning' : 'danger'}>{e.status.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <PatientFormModal open={editOpen} onClose={() => setEditOpen(false)} patient={patient} onSaved={bump} />
      <ConfirmDialog
        open={!!medToDelete}
        title="Delete this medicine?"
        message={`${medToDelete?.name} will stop being scheduled; its history is kept.`}
        confirmLabel="Remove Medicine"
        onConfirm={handleDeleteMed}
        onCancel={() => setMedToDelete(null)}
      />
    </>
  );
}
