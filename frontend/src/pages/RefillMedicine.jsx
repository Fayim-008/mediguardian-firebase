import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Package, Plus, Minus } from 'lucide-react';
import { Button, EmptyState, Badge, LoadingState, ErrorState } from '../components/ui';
import { getPatients } from '../services/patientService';
import { getMedicines, refillMedicine, isLowStock, scheduleSummary } from '../services/medicineService';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

export default function RefillMedicine() {
  const location = useLocation();
  const { push } = useToast();
  const [amounts, setAmounts] = useState({});
  const { data, error, loading, reload } = useApi(() => Promise.all([getPatients(), getMedicines(location.state?.patientId)]), [], { live: true });
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const [patients, all] = data;
  const medicines = all.filter((m) => m.active);
  const patientName = (pid) => patients.find((p) => p.id === pid)?.name || 'Unknown patient';
  const setAmount = (id, val) => setAmounts((a) => ({ ...a, [id]: Math.max(1, val) }));

  const handleRefill = async (med) => {
    const amount = amounts[med.id] ?? 10;
    try { await refillMedicine(med.id, amount, 'refill from the app'); push('success', `Added ${amount} to ${med.name}.`); setAmounts((a) => ({ ...a, [med.id]: undefined })); reload(); }
    catch (e) { push('error', e); }
  };

  return (
    <>
      <div className="page-head"><div><h1>Refill Medicine</h1><p className="mb-0">Record what you put in the drawer. Stock shown is an estimate — the box cannot count tablets. Switch the box to refill mode first so drawer activity isn't counted as doses.</p></div></div>
      {medicines.length === 0 ? (
        <div className="card list-panel-empty"><EmptyState icon={Package} title="No medicines to refill" message="Set a medicine first, then come back here to top it up." /></div>
      ) : (
        <div className="card list-panel"><div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {medicines.map((m) => {
            const low = isLowStock(m); const amount = amounts[m.id] ?? 10;
            return (
              <div className="card" key={m.id} style={{ padding: '16px 18px' }}>
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div className="flex-gap"><strong style={{ fontSize: '.94rem' }}>{m.name}</strong>{low && <Badge tone="danger">Low stock</Badge>}</div>
                    <div className="hint" style={{ marginTop: 2 }}>{scheduleSummary(m)} | {patientName(m.patientId)} · {m.drawerName || 'no drawer'}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--navy)' }}>~{m.quantity} {m.unit || 'tablets'} left</div>
                </div>
                <hr className="divider" />
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: 14 }}>
                  <div className="qty-box">
                    <button className="qty-btn" onClick={() => setAmount(m.id, amount - 1)} aria-label="Decrease amount"><Minus size={15} /></button>
                    <span className="qty-val">{amount}</span>
                    <button className="qty-btn" onClick={() => setAmount(m.id, amount + 1)} aria-label="Increase amount"><Plus size={15} /></button>
                    <span className="hint mb-0">to add</span>
                  </div>
                  <Button variant="primary" size="sm" icon={Plus} onClick={() => handleRefill(m)}>Add {amount}</Button>
                </div>
              </div>
            );
          })}
        </div></div>
      )}
    </>
  );
}
