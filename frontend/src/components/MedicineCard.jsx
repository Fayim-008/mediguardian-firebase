import React from 'react';
import { Pill, Edit2, Trash2, Power } from 'lucide-react';
import { Badge } from './ui';
import { isLowStock, scheduleSummary } from '../services/medicineService';

export default function MedicineCard({ medicine, patientName, onEdit, onDelete, onToggleActive }) {
  const low = isLowStock(medicine);
  return (
    <div className="card med-card">
      <div className="med-icon"><Pill size={19} /></div>
      <div className="med-info">
        <div className="m-name">
          {medicine.name}{' '}
          {!medicine.active && <Badge tone="neutral">Paused</Badge>}
          {low && medicine.active && <Badge tone="danger">Low stock</Badge>}
        </div>
        <div className="m-meta">
          {scheduleSummary(medicine)} {patientName ? `| ${patientName}` : ''} · {medicine.drawerName ? `${medicine.drawerName} drawer` : 'no drawer'} · ~{medicine.quantity} {medicine.unit || 'tablets'} left (estimate)
        </div>
      </div>
      <div className="med-actions">
        {onToggleActive && <button className="btn btn-ghost btn-icon" title={medicine.active ? 'Pause' : 'Resume'} onClick={() => onToggleActive(medicine)}><Power size={15} /></button>}
        {onEdit && <button className="btn btn-ghost btn-icon" title="Edit medicine" onClick={() => onEdit(medicine)}><Edit2 size={15} /></button>}
        {onDelete && <button className="btn btn-ghost btn-icon" title="Remove medicine" onClick={() => onDelete(medicine)}><Trash2 size={15} /></button>}
      </div>
    </div>
  );
}
