import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, CheckCircle2, Clock, XCircle, ListTodo, Award, TrendingDown } from 'lucide-react';
import { Select, StatCard, Badge, LoadingState, ErrorState } from '../components/ui';
import { StatusDonut, AdherenceTrend, MedicinePerformanceBar } from '../components/ReportCharts';
import { getPatients } from '../services/patientService';
import { fmtDateTime } from '../services/medicineService';
import { useApi } from '../hooks/useApi';
import { buildReport } from '../services/reportService';
import { useToast } from '../context/ToastContext';

const RANGE_TABS = [
  { key: '1D', label: '1 Day' },
  { key: '7D', label: '7 Days' },
  { key: '30D', label: '30 Days' },
];

export default function Reports() {
  const location = useLocation();
  const { push } = useToast();
  const [patientId, setPatientId] = useState(location.state?.patientId || '');
  const [range, setRange] = useState('7D');
  const { data, error, loading, reload } = useApi(() => Promise.all([getPatients(), buildReport(patientId || null, range)]), [patientId, range], { live: true });
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const [patients, report] = data;
  const patientLabel = patientId ? patients.find((p) => p.id === patientId)?.name : 'All Patients';

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mediguardian-report-${range}.json`; a.click(); URL.revokeObjectURL(a.href);
    push('success', 'Report data downloaded (JSON).');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Check Report</h1>
          <p className="mb-0">Adherence for {patientLabel}, last {range === '1D' ? 'day' : range === '7D' ? '7 days' : '30 days'}.</p>
        </div>
        <div className="actions">
          <button className="btn btn-outline" onClick={handleExport}><Download size={16} /> Export Report</button>
        </div>
      </div>

      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 14, marginBottom: 8 }}>
        <div className="tabs-row mb-0">
          {RANGE_TABS.map((t) => (
            <button key={t.key} className={`tab-btn ${range === t.key ? 'active' : ''}`} onClick={() => setRange(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <Select
          id="report-patient" wrapperClassName="mb-0" style={{ minWidth: 220 }}
          options={patients.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="All Patients"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
        />
      </div>

      <div className="report-summary-grid">
        <StatCard icon={CheckCircle2} value={`${report.percentages.adherence}%`} label="Overall Adherence" tone="success" />
        <StatCard icon={Clock} value={report.totals.late} label="Doses Late" tone="warning" />
        <StatCard icon={XCircle} value={report.totals.missed} label="Doses Missed" tone="danger" />
        <StatCard icon={ListTodo} value={report.totals.completed} label="Doses completed" tone="info" />
      </div>

      <div className="two-col" style={{ marginBottom: 22 }}>
        <div className="card chart-card">
          <h4>{range === '1D' ? "Today's Status Breakdown" : 'Status Breakdown'}</h4>
          <StatusDonut data={report.statusBreakdown} />
        </div>
        <div className="card chart-card">
          <h4>{range === '1D' ? 'Todays Snapshot' : 'Adherence Trend'}</h4>
          {range === '1D' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 6 }}>
              {report.recentActivity.length === 0 ? (
                <p className="hint">No doses logged yet today.</p>
              ) : (
                report.recentActivity.map((e) => (
                  <div key={e.id} className="flex-between" style={{ fontSize: '.86rem' }}>
                    <span>{e.medicineName} · {fmtDateTime(e.scheduledAt)}</span>
                    <Badge tone={e.status === 'on_time' ? 'success' : e.status === 'late' ? 'warning' : 'danger'}>{e.status.replace('_', ' ')}</Badge>
                  </div>
                ))
              )}
            </div>
          ) : (
            <AdherenceTrend data={report.dailyTrend} />
          )}
        </div>
      </div>

      <div className="two-col" style={{ marginBottom: 22 }}>
        <div className="card chart-card">
          <h4>Medicine-wise Performance</h4>
          <MedicinePerformanceBar data={report.medicineWise} />
        </div>
        <div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="flex-gap" style={{ marginBottom: 6 }}>
              <Award size={16} color="var(--success)" />
              <strong style={{ fontSize: '.88rem' }}>Best Performing Medicine</strong>
            </div>
            <p className="mb-0">{report.bestMedicine ? `${report.bestMedicine.name} — ${report.bestMedicine.adherence}% adherence` : 'Not enough data yet.'}</p>
          </div>
          <div className="card card-pad">
            <div className="flex-gap" style={{ marginBottom: 6 }}>
              <TrendingDown size={16} color="var(--danger)" />
              <strong style={{ fontSize: '.88rem' }}>Most Frequently Missed</strong>
            </div>
            <p className="mb-0">{report.mostMissed && report.mostMissed.missed > 0 ? `${report.mostMissed.name} — ${report.mostMissed.missed} missed dose(s)` : 'No missed doses in this period.'}</p>
          </div>
        </div>
      </div>

      <div className="card list-panel">
        <div className="section-card-head"><h3>Recent Medicine Activity</h3></div>
        <div style={{ padding: 6 }}>
          {report.recentActivity.length === 0 ? (
            <p className="hint" style={{ padding: 16 }}>No activity in this period yet.</p>
          ) : (
            report.recentActivity.map((e) => (
              <div className="alert-item" key={e.id}>
                <div className="alert-icon" style={{
                  background: e.status === 'on_time' ? 'var(--success-100)' : e.status === 'late' ? 'var(--warning-100)' : 'var(--danger-100)',
                  color: e.status === 'on_time' ? 'var(--success)' : e.status === 'late' ? '#B4790C' : 'var(--danger)',
                }}>
                  {e.status === 'on_time' ? <CheckCircle2 size={16} /> : e.status === 'late' ? <Clock size={16} /> : <XCircle size={16} />}
                </div>
                <div className="alert-body">
                  <div className="alert-title">{e.medicineName} — {e.status.replace('_', ' ')} {e.simulated && <Badge tone="info">SIMULATED</Badge>}</div>
                  <div className="alert-sub">{fmtDateTime(e.scheduledAt)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="card card-pad" style={{ marginTop: 22 }}>
        <h4 style={{ marginTop: 0 }}>How these numbers are calculated</h4>
        <p className="hint">{report.definition}. “Completed” means the box detected a qualifying removal or a caregiver confirmed intake; {report.totals.hardwareOnly} completed dose(s) were hardware-detected only (no human confirmation). Doses still awaiting confirmation: {report.totals.awaiting}; upcoming: {report.totals.upcoming}.</p>
      </div>
      <div className="two-col" style={{ marginTop: 22 }}>
        <div className="card list-panel"><div className="section-card-head"><h3>Stock &amp; refill history</h3></div>
          {report.refillHistory.length === 0 ? <p className="hint" style={{ padding: 16 }}>No stock changes in this period.</p> : report.refillHistory.map((r) => (
            <div className="alert-item" key={r.id}><div className="alert-body"><div className="alert-title">{r.medicineName}: {r.delta > 0 ? '+' : ''}{r.delta} ({r.reason})</div><div className="alert-sub">{fmtDateTime(r.createdAt)} · balance {r.balanceAfter}</div></div></div>))}
        </div>
        <div className="card list-panel"><div className="section-card-head"><h3>Box events</h3></div>
          {report.deviceEvents.length === 0 ? <p className="hint" style={{ padding: 16 }}>No box events in this period.</p> : report.deviceEvents.slice(0, 15).map((e) => (
            <div className="alert-item" key={e.id}><div className="alert-body"><div className="alert-title">{e.type.replace(/_/g, ' ')}{e.drawerSlot ? ` · drawer ${e.drawerSlot}` : ''} {e.simulated && <Badge tone="info">SIMULATED</Badge>}</div><div className="alert-sub">{fmtDateTime(e.occurredAt)} · {e.outcome.replace(/_/g, ' ')}</div></div></div>))}
        </div>
      </div>
    </>
  );
}
