import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Users, Pill, AlertTriangle, TrendingUp, Plus, RefreshCw, FileBarChart, PackageX, Package, Wifi, Activity } from 'lucide-react';
import { StatCard, Button, EmptyState, LoadingState, ErrorState, Badge } from '../components/ui';
import PatientCard from '../components/PatientCard';
import AlertCard from '../components/AlertCard';
import ScheduleItem from '../components/ScheduleCard';
import PatientFormModal from '../components/PatientFormModal';
import BoxCard from '../components/BoxCard';
import { getPatients } from '../services/patientService';
import { getTodaySchedule, fmtDateTime } from '../services/medicineService';
import { getDashboard, buildReport } from '../services/reportService';
import { getBoxes } from '../services/boxService';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

function PatientToday({ patient, onChange }) {
  const navigate = useNavigate();
  const { data } = useApi(() => getTodaySchedule(patient.id), [patient.id], { live: true });
  if (!data || data.length === 0) return null;
  return (
    <div className="card list-panel">
      <div className="section-card-head"><h3>Today's Schedule — {patient.name}</h3><button className="muted-link" onClick={() => navigate(`/app/patients/${patient.id}`)}>See More</button></div>
      <div>{data.slice(0, 5).map((d) => <ScheduleItem key={d.id} dose={d} timezone={patient.timezone} onChange={onChange} />)}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { demoMode } = useOutletContext();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const { data, error, loading, reload, stale } = useApi(
    () => Promise.all([getDashboard(), getPatients(), getBoxes(), buildReport(null, '7D')]), [], { live: true });
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const [dash, allPatients, boxes, overall] = data;
  const patients = allPatients.filter((p) => p.status === 'Active');
  const firstName = (user?.name || 'Guardian').split(' ')[0];
  const t = dash.today;

  return (
    <>
      <div className="page-head">
        <div><h1>Welcome back, {firstName} 👋</h1><p className="mb-0">Here's how your patients are doing today.</p></div>
        <div className="actions">
          <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>Add Patient</Button>
          <Button variant="secondary" icon={Package} onClick={() => navigate('/app/add-box')}>Add Box</Button>
          <Button variant="outline" icon={Pill} onClick={() => navigate('/app/set-medicine')}>Set Medicine</Button>
          <Button variant="outline" icon={RefreshCw} onClick={() => navigate('/app/refill')}>Refill</Button>
          <Button variant="outline" icon={FileBarChart} onClick={() => navigate('/app/reports')}>Report</Button>
        </div>
      </div>
      {stale && <div className="card card-pad hint" style={{ marginBottom: 14 }}>Live updates are disconnected — figures may be out of date. Reconnecting…</div>}

      <div className="stat-row">
        <StatCard icon={Users} value={dash.patients} label="Active Patients" tone="info" />
        <StatCard icon={Wifi} value={`${dash.boxesOnline}/${dash.boxes}`} label="Boxes Online" tone={dash.boxesOffline ? 'danger' : 'success'} />
        <StatCard icon={AlertTriangle} value={dash.lowStock.length} label="Low Stock Alerts" tone="danger" />
        <StatCard icon={TrendingUp} value={`${overall.percentages.adherence}%`} label="Adherence (7d)" tone="warning" />
      </div>
      <div className="stat-row">
        <StatCard icon={Activity} value={t.scheduled} label="Doses today" tone="info" />
        <StatCard icon={Pill} value={t.onTime} label="On time" tone="success" />
        <StatCard icon={Pill} value={t.late} label="Late" tone="warning" />
        <StatCard icon={Pill} value={t.missed + t.awaiting} label={`Missed ${t.missed} · awaiting ${t.awaiting}`} tone="danger" />
      </div>
      <p className="hint" style={{ marginTop: -8 }}>{t.upcoming} upcoming today. Hardware-detected removal is shown separately from confirmed intake.</p>

      {patients.length === 0 ? (
        <div className="card list-panel-empty"><EmptyState icon={Users} title="No patients added yet." message="Add a patient, or scan a box's QR code to create one while pairing."
          action={<div className="flex-gap"><Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>+ Add Patient</Button><Button variant="secondary" icon={Package} onClick={() => navigate('/app/add-box')}>Scan box QR</Button></div>} /></div>
      ) : (
        <div className="patient-grid">{patients.map((p) => <PatientCard key={p.id} patient={p} onClick={() => navigate(`/app/patients/${p.id}`)} />)}</div>
      )}

      <div className="two-col">
        <div>
          {patients.map((p) => <PatientToday key={p.id} patient={p} onChange={reload} />)}
          {boxes.length > 0 && (<><h3 style={{ margin: '8px 0 12px' }}>Boxes</h3>{boxes.map((b) => <BoxCard key={b.id} box={b} demoMode={demoMode} onChange={reload} />)}</>)}
        </div>
        <div>
          <div className="card list-panel">
            <div className="section-card-head"><h3>Medicine Alerts</h3></div>
            {dash.lowStock.length === 0 ? <EmptyState icon={PackageX} title="No low-stock alerts" message="Every medicine is well stocked (estimates)." /> :
              dash.lowStock.map((m) => (
                <AlertCard key={m.medicineId} icon={PackageX} title={`${m.name} — about ${m.quantity} left`} subtitle={`${m.patientName} · Refill soon`}
                  action={<Button size="sm" variant="secondary" onClick={() => navigate('/app/refill', { state: { patientId: m.patientId } })}>Refill</Button>} />))}
          </div>
          <div className="card list-panel">
            <div className="section-card-head"><h3>Recent box activity</h3></div>
            {dash.recentEvents.length === 0 ? <p className="hint" style={{ padding: 16 }}>No box events yet.</p> : dash.recentEvents.map((e) => (
              <div className="alert-item" key={e.id}><div className="alert-body">
                <div className="alert-title">{e.type.replace(/_/g, ' ')}{e.drawerSlot ? ` · drawer ${e.drawerSlot}` : ''} {e.simulated && <Badge tone="info">SIMULATED</Badge>}</div>
                <div className="alert-sub">{e.patientName} · {fmtDateTime(e.occurredAt)} · {e.outcome.replace(/_/g, ' ')}</div></div></div>))}
          </div>
        </div>
      </div>
      <PatientFormModal open={addOpen} onClose={() => setAddOpen(false)} patient={null} onSaved={reload} />
    </>
  );
}
