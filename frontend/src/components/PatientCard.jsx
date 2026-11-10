import React from 'react';
import { ChevronRight } from 'lucide-react';
import { getInitials } from '../services/patientService';
import { buildReport } from '../services/reportService';
import { useApi } from '../hooks/useApi';

export default function PatientCard({ patient, onClick }) {
  const { data } = useApi(() => buildReport(patient.id, '7D'), [patient.id], { live: true });
  const adherence = data?.percentages.adherence ?? 0;
  const barColor = adherence >= 75 ? 'var(--success)' : adherence >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="card patient-card" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick?.()}>
      <div className="patient-card-top">
        <div className="patient-avatar">{getInitials(patient.name)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="p-name">{patient.name}</div>
          <div className="p-rel">{patient.relationship}</div>
        </div>
      </div>
      <div className="adherence-bar"><div className="adherence-bar-fill" style={{ width: `${adherence}%`, background: barColor }} /></div>
      <div className="p-foot"><span>{data ? `${adherence}% this week` : '…'}</span><ChevronRight size={16} /></div>
    </div>
  );
}
